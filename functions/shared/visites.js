// Visites de profil : qui est venu voir le profil d'un membre.
// Une ligne par couple (visiteur, membre visité), mise à jour à chaque visite.
// Seul le serveur lit la table : un membre non Premium ne doit pas pouvoir découvrir
// qui l'a visité, la liste lui arrive donc floutée (sans le visiteur).

import { Query, notify, uniqueId, usernameOf } from './appwrite.js';
import { isPremium } from './premium.js';

/** Visites gardées 30 jours. */
export const KEEP_VISITS_MS = 30 * 24 * 3600 * 1000;
/** Au plus une notification par visiteur et par jour. */
const NOTIFY_EVERY_MS = 24 * 3600 * 1000;

async function blockedBetween(api, a, b) {
  const block = await api.findRow('blocks', [
    Query.or([
      Query.and([Query.equal('blocker_id', a), Query.equal('blocked_id', b)]),
      Query.and([Query.equal('blocker_id', b), Query.equal('blocked_id', a)]),
    ]),
  ]);
  return !!block;
}

async function premiumOf(api, userId) {
  return isPremium(await api.getRow('member_status', userId));
}

/**
 * Enregistre la visite de `visitorId` sur le profil de `visitedId` et prévient le membre
 * visité (au plus une fois par jour pour un même visiteur). Le nom du visiteur n'apparaît
 * dans la notification que si le membre visité est Premium.
 */
export async function recordProfileVisit(api, { visitorId, visitedId, now = new Date() }) {
  if (!visitedId || visitedId === visitorId) return { recorded: false };
  if (!(await api.getRow('profiles', visitedId))) return { recorded: false };
  if (await blockedBetween(api, visitorId, visitedId)) return { recorded: false };

  const at = now.toISOString();
  const existing = await api.findRow('profile_visits', [
    Query.equal('visitor_id', visitorId),
    Query.equal('visited_id', visitedId),
  ]);
  const notifyNow =
    !existing?.notified_at ||
    now.getTime() - new Date(existing.notified_at).getTime() >= NOTIFY_EVERY_MS;
  const data = { at, ...(notifyNow ? { notified_at: at } : {}) };
  if (existing) await api.updateRow('profile_visits', existing.$id, data);
  else
    await api.createRow(
      'profile_visits',
      uniqueId(),
      { visitor_id: visitorId, visited_id: visitedId, ...data },
      [],
    );

  if (notifyNow) {
    const link = '/notifications?onglet=visites';
    if (await premiumOf(api, visitedId)) {
      const name = await usernameOf(api, visitorId);
      await notify(api, [
        {
          user_id: visitedId,
          actor_id: visitorId,
          title: '👀 Visite de ton profil',
          message: `${name} a visité ton profil.`,
          link,
        },
      ]);
    } else {
      await notify(api, [
        {
          user_id: visitedId,
          title: '👀 Quelqu’un a visité ton profil',
          message: 'Passe Premium pour découvrir qui.',
          link,
        },
      ]);
    }
  }
  return { recorded: true };
}

/**
 * Visites des 30 derniers jours sur le profil de `userId`, la plus récente d'abord.
 * Pour un membre non Premium, les visiteurs ne sont pas révélés (seulement la date).
 */
export async function listProfileVisits(api, { userId, now = new Date() }) {
  const since = new Date(now.getTime() - KEEP_VISITS_MS).toISOString();
  const rows = await api.listRows('profile_visits', [
    Query.equal('visited_id', userId),
    Query.greaterThan('at', since),
    Query.orderDesc('at'),
    Query.limit(100),
  ]);
  const premium = await premiumOf(api, userId);
  if (!premium) return { premium, visits: rows.map((r) => ({ at: r.at })) };
  return { premium, visits: rows.map((r) => ({ at: r.at, visitor_id: r.visitor_id })) };
}

/** Lancé chaque jour : efface les visites de plus de 30 jours. */
export async function purgeOldVisits(api, now = new Date()) {
  const before = new Date(now.getTime() - KEEP_VISITS_MS).toISOString();
  const old = await api.listAllRows('profile_visits', [Query.lessThan('at', before)]);
  for (const row of old) await api.deleteRow('profile_visits', row.$id);
  return { visitsPurged: old.length };
}
