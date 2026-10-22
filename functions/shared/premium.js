// Premium : qui fait partie de l'équipe « abonnes » (seule à lire les sorties Premium).

import { Query } from './appwrite.js';

/** Rôles qui ont toujours le Premium, sans date de fin. */
const ALWAYS_PREMIUM = ['user_premium', 'admin', 'developer'];

export function isPremium(status) {
  if (!status) return false;
  if (ALWAYS_PREMIUM.includes(status.role)) return true;
  return !!status.subscription_end_date && new Date(status.subscription_end_date) > new Date();
}

/** Met l'équipe « abonnes » en accord avec le rôle et la date de fin du Premium. */
export async function syncPremium(api, memberId, status) {
  if (isPremium(status)) await api.addTeamMember('abonnes', memberId);
  else await api.removeTeamMember('abonnes', memberId);
}

/** Lancé chaque heure : retire de l'équipe « abonnes » les Premium arrivés à leur fin. */
export async function removeExpiredPremium(api) {
  const expired = await api.listAllRows('member_status', [
    Query.lessThan('subscription_end_date', new Date().toISOString()),
  ]);
  let removed = 0;
  for (const status of expired) {
    if (isPremium(status) || !(await api.isTeamMember('abonnes', status.$id))) continue;
    await api.removeTeamMember('abonnes', status.$id);
    removed++;
  }
  return removed;
}
