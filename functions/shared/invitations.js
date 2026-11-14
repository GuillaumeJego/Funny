// Invitations aux sorties réservées aux abonnés.
// L'organisateur abonné invite des membres (abonnés ou non) : chaque invité reçoit une
// notification, et sa place lui est gardée (statut « invited ») jusqu'à ce qu'il refuse.
// En acceptant, il devient participant, même sans abonnement. Une invitation sans réponse
// reste valable jusqu'au début de la sortie.

import { Permission, Query, Role, fail, notify, uniqueId, usernameOf } from './appwrite.js';
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
 * Invite des membres à une sortie réservée aux abonnés. Ignore l'organisateur, les membres
 * inconnus ou bloqués, et ceux qui sont déjà invités ou inscrits. Refuse s'il n'y a pas assez
 * de places libres. Ne touche pas aux droits de lecture : voir refreshReaders.
 */
export async function inviteMembers(api, { sortie, organizerId, userIds, now = new Date() }) {
  const ids = [...new Set((Array.isArray(userIds) ? userIds : []).map(String))].filter(
    (id) => id && id !== organizerId,
  );
  if (ids.length === 0) return { invited: [] };
  if (!sortie.is_premium) fail(400, 'Les invitations sont réservées aux sorties pour abonnés.');
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
  if (fresh.length === 0) return { invited: [] };

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
  return { invited: fresh.map(({ id }) => id) };
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
