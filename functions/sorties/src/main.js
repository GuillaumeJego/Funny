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
import { confirmPlace, deleteSortie, promoteFromWaitingList } from './shared/sorties.js';
import { cleanSortie, isSafeDefaultImage, sortieImageFileId } from './shared/sortie-rules.js';

/**
 * Qui peut voir une sortie : tout le monde, ou seulement les abonnés si elle est Premium.
 * Personne ne peut la modifier directement : tout changement passe par ce serveur.
 */
function sortiePermissions(sortie, organizerId) {
  const readers = sortie.is_premium
    ? [Role.team('abonnes'), Role.team('admins'), Role.user(organizerId)]
    : [Role.verifiedUsers()];
  return readers.map(Permission.read);
}

/** L'image choisie est-elle une image du thème, ou une photo envoyée dans notre stockage ? */
async function checkImage(api, data) {
  if (!data.image_url) {
    data.image_source = 'default';
    return;
  }
  if (data.image_source === 'default') {
    const known = await api.findRow('theme_images', [
      Query.equal('theme_id', data.theme_id),
      Query.equal('image_url', data.image_url),
    ]);
    if (!known && !isSafeDefaultImage(data.image_url)) fail(400, 'Image par défaut inconnue.');
    return;
  }
  const fileId = sortieImageFileId(data.image_url, process.env.APPWRITE_FUNCTION_API_ENDPOINT);
  if (!fileId) fail(400, 'Adresse d’image non autorisée.');
  try {
    await api.call('GET', `/storage/buckets/sorties-images/files/${fileId}`);
  } catch (error) {
    if (error.code === 404) fail(400, 'Image introuvable : envoie-la à nouveau.');
    throw error;
  }
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
  const data = cleanSortie(input.sortie);
  if (!(await api.getRow('themes', data.theme_id))) fail(400, 'Ce thème n’existe pas.');
  if (data.is_premium && !(await api.isTeamMember('abonnes', userId))) {
    if (!(await isAdmin(api, userId)))
      fail(403, 'Seuls les abonnés peuvent créer une sortie Premium.');
  }
  await checkImage(api, data);
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
  if (new Date(sortie.date).getTime() < Date.now()) fail(400, 'Cette sortie est déjà passée.');
  const blocked = await api.findRow('blocks', [
    Query.equal('blocker_id', sortie.created_by),
    Query.equal('blocked_id', userId),
  ]);
  if (blocked) fail(403, 'Impossible de rejoindre cette sortie.');

  const existing = await getInscription(api, sortie.$id, userId);
  if (existing && existing.status !== 'cancelled') return { status: existing.status };

  const taken = await api.countRows('inscriptions', [
    Query.equal('sortie_id', sortie.$id),
    Query.equal('status', 'pending'),
  ]);
  const full = sortie.max_participants != null && taken >= sortie.max_participants;
  let status = full ? 'waiting' : 'pending';
  const inscription = existing
    ? await api.updateRow('inscriptions', existing.$id, { status })
    : await api.createRow('inscriptions', uniqueId(), {
        sortie_id: sortie.$id,
        user_id: userId,
        status,
      });
  // Deux inscriptions au même moment ne doivent pas dépasser le nombre de places.
  if (status === 'pending') status = await confirmPlace(api, sortie, inscription.$id);

  const actor = await usernameOf(api, userId);
  await notify(api, [
    status === 'waiting'
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
