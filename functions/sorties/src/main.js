// Fonction « sorties » : tout ce qui crée, rejoint, quitte ou supprime une sortie.
// Remplace rejoindre_sortie, quitter_sortie et les déclencheurs de Supabase.
import {
  Permission,
  Query,
  Role,
  fail,
  handler,
  isAdmin,
  notify,
  uniqueId,
  usernameOf,
} from './shared/appwrite.js';
import { deleteSortie, promoteFromWaitingList } from './shared/sorties.js';

const SORTIE_FIELDS = [
  'title',
  'description',
  'theme_id',
  'date',
  'location',
  'price',
  'max_participants',
  'is_premium',
  'image_url',
  'image_source',
];

/** Qui peut voir une sortie : tout le monde, ou seulement les abonnés si elle est Premium. */
function sortiePermissions(sortie, organizerId) {
  const readers = sortie.is_premium
    ? [Role.team('abonnes'), Role.team('admins'), Role.user(organizerId)]
    : [Role.verifiedUsers()];
  return [...readers.map(Permission.read), Permission.update(Role.user(organizerId))];
}

async function canCreateSortie(api, userId) {
  if (await isAdmin(api, userId)) return true;
  const setting = await api.getRow('app_settings', 'sortie_creation_access');
  const access = setting ? JSON.parse(setting.value) : 'all';
  if (access === 'all') return true;
  if (access === 'admin') return false;
  return api.isTeamMember('abonnes', userId); // « premium »
}

async function getSortie(api, sortieId) {
  const sortie = await api.getRow('sorties', String(sortieId ?? ''));
  if (!sortie || sortie.status !== 'published') fail(404, 'Sortie introuvable.');
  return sortie;
}

async function getInscription(api, sortieId, userId) {
  return api.findRow('inscriptions', [
    Query.equal('sortie_id', sortieId),
    Query.equal('user_id', userId),
  ]);
}

async function create({ api, userId, input }) {
  if (!(await canCreateSortie(api, userId))) fail(403, "Tu n'as pas le droit de créer une sortie.");
  const data = {};
  for (const field of SORTIE_FIELDS)
    if (input.sortie?.[field] !== undefined) data[field] = input.sortie[field];
  if (!data.title?.trim() || !data.theme_id || !data.date || !data.location?.trim()) {
    fail(400, 'Titre, thème, date et lieu sont obligatoires.');
  }
  data.created_by = userId;
  data.status = 'published';
  const sortie = await api.createRow('sorties', uniqueId(), data, sortiePermissions(data, userId));
  // L'organisateur est inscrit d'office (statut « confirmed »).
  await api.createRow('inscriptions', uniqueId(), {
    sortie_id: sortie.$id,
    user_id: userId,
    status: 'confirmed',
  });
  return { sortie };
}

async function join({ api, userId, input }) {
  const sortie = await getSortie(api, input.sortieId);
  if (sortie.is_premium && !(await api.isTeamMember('abonnes', userId))) {
    if (!(await isAdmin(api, userId))) fail(403, 'Sortie réservée aux abonnés.');
  }
  const existing = await getInscription(api, sortie.$id, userId);
  if (existing && existing.status !== 'cancelled') return { status: existing.status };

  const taken = await api.countRows('inscriptions', [
    Query.equal('sortie_id', sortie.$id),
    Query.equal('status', 'pending'),
  ]);
  const full = sortie.max_participants != null && taken >= sortie.max_participants;
  const status = full ? 'waiting' : 'pending';
  if (existing) await api.updateRow('inscriptions', existing.$id, { status });
  else
    await api.createRow('inscriptions', uniqueId(), {
      sortie_id: sortie.$id,
      user_id: userId,
      status,
    });

  const actor = await usernameOf(api, userId);
  await notify(api, [
    full
      ? {
          user_id: sortie.created_by,
          actor_id: userId,
          title: "⏳ Liste d'attente",
          message: `${actor} est en liste d'attente pour « ${sortie.title} »`,
        }
      : {
          user_id: sortie.created_by,
          actor_id: userId,
          title: '✅ Nouvelle inscription',
          message: `${actor} a rejoint votre sortie « ${sortie.title} »`,
        },
  ]);
  return { status };
}

async function leave({ api, userId, input }) {
  const sortie = await getSortie(api, input.sortieId);
  const inscription = await getInscription(api, sortie.$id, userId);
  if (!inscription || inscription.status === 'cancelled') return { status: 'none' };
  if (inscription.status === 'confirmed')
    fail(400, "L'organisateur ne peut pas quitter sa sortie.");

  await api.updateRow('inscriptions', inscription.$id, { status: 'cancelled' });
  if (inscription.status === 'pending') {
    const actor = await usernameOf(api, userId);
    await notify(api, [
      {
        user_id: sortie.created_by,
        actor_id: userId,
        title: '🚪 Désinscription',
        message: `${actor} a quitté votre sortie « ${sortie.title} »`,
      },
    ]);
    await promoteFromWaitingList(api, sortie);
  }
  return { status: 'none' };
}

async function like({ api, userId, input }) {
  const sortie = await getSortie(api, input.sortieId);
  const existing = await api.findRow('favoris', [
    Query.equal('user_id', userId),
    Query.equal('sortie_id', sortie.$id),
  ]);
  if (existing) return { liked: true };
  await api.createRow('favoris', uniqueId(), { user_id: userId, sortie_id: sortie.$id }, [
    Permission.read(Role.verifiedUsers()),
    Permission.delete(Role.user(userId)),
  ]);
  const actor = await usernameOf(api, userId);
  await notify(api, [
    {
      user_id: sortie.created_by,
      actor_id: userId,
      title: '❤️ Nouveau like',
      message: `${actor} a aimé votre sortie « ${sortie.title} »`,
    },
  ]);
  return { liked: true };
}

async function remove({ api, userId, input }) {
  const sortie = await api.getRow('sorties', String(input.sortieId ?? ''));
  if (!sortie) fail(404, 'Sortie introuvable.');
  if (sortie.created_by !== userId && !(await isAdmin(api, userId))) {
    fail(403, "Seul l'organisateur peut supprimer cette sortie.");
  }
  await deleteSortie(api, sortie);
  return {};
}

export default handler({ create, join, leave, like, delete: remove });
