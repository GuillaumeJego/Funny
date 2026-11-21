// Invitations aux sorties, réservées aux organisateurs abonnés (sortie pour abonnés ou non).
// L'organisateur abonné invite des membres (abonnés ou non) : chaque invité reçoit une
// notification, et sa place lui est gardée (statut « invited ») jusqu'à ce qu'il refuse.
// En acceptant, il devient participant, même sans abonnement. Une invitation sans réponse
// reste valable jusqu'au début de la sortie.

import {
  Permission,
  Query,
  Role,
  fail,
  isAdmin,
  notify,
  uniqueId,
  usernameOf,
} from './appwrite.js';
import { isPremium } from './premium.js';
import { TAKEN, promoteFromWaitingList } from './sorties.js';
import { syncSortieChat } from './conversations.js';

/** Invités au plus par envoi. */
export const MAX_INVITES = 100;

async function blockedBetween(api, a, b) {
  const block = await api.findRow('blocks', [
    Query.or([
      Query.and([Query.equal('blocker_id', a), Query.equal('blocked_id', b)]),
      Query.and([Query.equal('blocker_id', b), Query.equal('blocked_id', a)]),
    ]),
  ]);
  return !!block;
}

/**
 * Qui peut lire une sortie : tout membre, ou pour une sortie réservée aux abonnés, les abonnés,
 * les admins, l'organisateur et les membres non abonnés invités ou inscrits (les abonnés la
 * voient déjà grâce à leur équipe).
 */
export async function sortieReaders(api, sortie, organizerId) {
  if (!sortie.is_premium) return [Permission.read(Role.verifiedUsers())];
  const roles = [Role.team('abonnes'), Role.team('admins'), Role.user(organizerId)];
  if (sortie.$id) {
    const rows = await api.listAllRows('inscriptions', [
      Query.equal('sortie_id', sortie.$id),
      Query.notEqual('status', 'cancelled'),
    ]);
    for (const row of rows) {
      if (row.user_id === organizerId) continue;
      if (isPremium(await api.getRow('member_status', row.user_id))) continue;
      roles.push(Role.user(row.user_id));
    }
  }
  return [...new Set(roles)].map(Permission.read);
}

/** Message quand l'organisateur n'est pas (ou plus) abonné. */
const SUBSCRIBERS_ONLY = 'Les invitations sont réservées aux organisateurs abonnés.';

/**
 * Seul l'organisateur (ou un admin) invite, et seulement si l'organisateur est abonné, que la
 * sortie soit réservée aux abonnés ou non.
 */
export async function checkCanInvite(api, sortie, userId) {
  if (sortie.created_by !== userId && !(await isAdmin(api, userId))) {
    fail(403, "Seul l'organisateur peut inviter à cette sortie.");
  }
  if (!(await api.isTeamMember('abonnes', sortie.created_by))) fail(403, SUBSCRIBERS_ONLY);
}

/** Remet à jour les droits de lecture d'une sortie (après une invitation ou un refus). */
export async function refreshReaders(api, sortie) {
  if (!sortie.is_premium) return;
  await api.updateRow(
    'sorties',
    sortie.$id,
    {},
    await sortieReaders(api, sortie, sortie.created_by),
  );
}

/**
 * Invite des membres à une sortie d'un organisateur abonné. Ignore l'organisateur, les membres
 * inconnus ou bloqués, et ceux qui sont déjà invités ou inscrits. Refuse s'il n'y a pas assez
 * de places libres. Ne touche pas aux droits de lecture : voir refreshReaders.
 */
export async function inviteMembers(api, { sortie, organizerId, userIds, now = new Date() }) {
  const ids = [...new Set((Array.isArray(userIds) ? userIds : []).map(String))].filter(
    (id) => id && id !== organizerId,
  );
  if (ids.length === 0) return { invited: [] };
  if (!(await api.isTeamMember('abonnes', organizerId))) fail(403, SUBSCRIBERS_ONLY);
  if (ids.length > MAX_INVITES) fail(400, `${MAX_INVITES} invitations au maximum à la fois.`);
  if (new Date(sortie.date).getTime() < now.getTime()) fail(400, 'Cette sortie est déjà passée.');

  const fresh = [];
  for (const id of ids) {
    if (!(await api.getRow('profiles', id))) continue;
    if (await blockedBetween(api, organizerId, id)) continue;
    const existing = await api.findRow('inscriptions', [
      Query.equal('sortie_id', sortie.$id),
      Query.equal('user_id', id),
    ]);
    if (existing && existing.status !== 'cancelled') continue;
    fresh.push({ id, existing });
  }
  // Ignorés : inconnus, bloqués, déjà invités ou inscrits (l'appli les affiche).
  const skipped = ids.filter((id) => !fresh.some((f) => f.id === id));
  if (fresh.length === 0) return { invited: [], skipped };

  if (sortie.max_participants != null) {
    const taken = await api.countRows('inscriptions', [
      Query.equal('sortie_id', sortie.$id),
      Query.equal('status', TAKEN),
    ]);
    const left = Math.max(0, sortie.max_participants - taken);
    if (fresh.length > left) {
      fail(
        400,
        left > 0
          ? `Il ne reste que ${left} place${left > 1 ? 's' : ''} : invite moins de monde ou ajoute des places.`
          : 'Plus aucune place libre pour inviter : ajoute des places.',
      );
    }
  }

  for (const { id, existing } of fresh) {
    if (existing) await api.updateRow('inscriptions', existing.$id, { status: 'invited' });
    else
      await api.createRow('inscriptions', uniqueId(), {
        sortie_id: sortie.$id,
        user_id: id,
        status: 'invited',
      });
  }
  const organizer = await usernameOf(api, organizerId);
  await notify(
    api,
    fresh.map(({ id }) => ({
      user_id: id,
      actor_id: organizerId,
      title: '💌 Tu es invité(e) à une sortie',
      message: `${organizer} t'invite à « ${sortie.title} ». Ta place est gardée : accepte ou refuse.`,
      link: `/dashboard?sortie=${sortie.$id}`,
    })),
  );
  return { invited: fresh.map(({ id }) => id), skipped };
}

/** Lignes dont `attribute` vaut l'une des valeurs (par paquets de 100, la limite d'Appwrite). */
async function listIn(api, table, attribute, values, queries = []) {
  const rows = [];
  const unique = [...new Set(values)];
  for (let i = 0; i < unique.length; i += 100) {
    rows.push(
      ...(await api.listAllRows(table, [
        Query.equal(attribute, unique.slice(i, i + 100)),
        ...queries,
      ])),
    );
  }
  return rows;
}

/** Ce qu'est un membre pour la sortie : invité, inscrit, en attente, ou libre (null). */
const STATE_OF = {
  invited: 'invited',
  pending: 'inscrit',
  confirmed: 'inscrit',
  waiting: 'waiting',
};

/**
 * Les membres que l'organisateur peut inviter : ses amis, et les personnes avec qui il a
 * participé à une sortie passée (sans les absents notés). Sans doublon, sans lui-même, sans
 * les membres bannis ni ceux qu'un blocage sépare de lui (dans un sens ou dans l'autre).
 * Chacun a son état pour cette sortie (déjà invité, inscrit…), et l'on donne les places libres.
 */
export async function inviteCandidates(api, { sortie, organizerId, now = new Date() }) {
  // Amis : amitiés acceptées, dans un sens ou dans l'autre.
  const friendships = await api.listAllRows('friendships', [
    Query.equal('status', 'accepted'),
    Query.or([Query.equal('requester_id', organizerId), Query.equal('receiver_id', organizerId)]),
  ]);
  const friendIds = friendships.map((f) =>
    f.requester_id === organizerId ? f.receiver_id : f.requester_id,
  );

  // Rencontrés : les autres participants de ses sorties déjà passées.
  const mine = await api.listAllRows('inscriptions', [
    Query.equal('user_id', organizerId),
    Query.equal('status', ['pending', 'confirmed']),
  ]);
  const attended = mine.filter((i) => i.present !== false && i.sortie_id !== sortie.$id);
  const past = (
    await listIn(
      api,
      'sorties',
      '$id',
      attended.map((i) => i.sortie_id),
    )
  ).filter((s) => new Date(s.date).getTime() < now.getTime());
  const together = await listIn(
    api,
    'inscriptions',
    'sortie_id',
    past.map((s) => s.$id),
    [Query.equal('status', ['pending', 'confirmed'])],
  );
  const metIds = together.filter((i) => i.present !== false).map((i) => i.user_id);

  // Blocages dans les deux sens : ces membres n'apparaissent pas.
  const blocks = await api.listAllRows('blocks', [
    Query.or([Query.equal('blocker_id', organizerId), Query.equal('blocked_id', organizerId)]),
  ]);
  const hidden = new Set([
    organizerId,
    ...blocks.map((b) => (b.blocker_id === organizerId ? b.blocked_id : b.blocker_id)),
  ]);

  const profiles = new Map(
    (
      await listIn(
        api,
        'profiles',
        '$id',
        [...friendIds, ...metIds].filter((id) => !hidden.has(id)),
      )
    )
      .filter((p) => !p.is_banned)
      .map((p) => [p.$id, p]),
  );
  const inscriptions = await api.listAllRows('inscriptions', [
    Query.equal('sortie_id', sortie.$id),
    Query.notEqual('status', 'cancelled'),
  ]);
  const stateOf = new Map(inscriptions.map((i) => [i.user_id, STATE_OF[i.status] ?? null]));

  const people = (ids) =>
    [...new Set(ids)]
      .filter((id) => profiles.has(id))
      .map((id) => ({
        id,
        username: profiles.get(id).username ?? '',
        avatar_url: profiles.get(id).avatar_url ?? null,
        state: stateOf.get(id) ?? null,
      }))
      .sort((a, b) => a.username.localeCompare(b.username, 'fr'));

  const taken = inscriptions.filter((i) => TAKEN.includes(i.status)).length;
  return {
    friends: people(friendIds),
    met: people(metIds),
    placesLeft:
      sortie.max_participants == null ? null : Math.max(0, sortie.max_participants - taken),
  };
}

/** L'invité accepte : il devient participant (sa place était déjà gardée). */
export async function acceptInvitation(api, { sortie, inscription }) {
  await api.updateRow('inscriptions', inscription.$id, { status: 'pending' });
  await syncSortieChat(api, sortie);
  const actor = await usernameOf(api, inscription.user_id);
  await notify(api, [
    {
      user_id: sortie.created_by,
      actor_id: inscription.user_id,
      category: 'organisateur',
      title: '🎉 Invitation acceptée',
      message: `${actor} a accepté ton invitation à « ${sortie.title} »`,
      link: `/dashboard?sortie=${sortie.$id}`,
    },
  ]);
  return { status: 'pending' };
}

/** L'invité refuse : sa place se libère et l'organisateur est prévenu. */
export async function declineInvitation(api, { sortie, inscription }) {
  await api.updateRow('inscriptions', inscription.$id, { status: 'cancelled' });
  const actor = await usernameOf(api, inscription.user_id);
  await notify(api, [
    {
      user_id: sortie.created_by,
      actor_id: inscription.user_id,
      category: 'organisateur',
      title: '❌ Invitation refusée',
      message: `${actor} a refusé ton invitation à « ${sortie.title} »`,
      link: `/dashboard?sortie=${sortie.$id}`,
    },
  ]);
  await promoteFromWaitingList(api, sortie);
  await refreshReaders(api, sortie);
  return { status: 'none' };
}
