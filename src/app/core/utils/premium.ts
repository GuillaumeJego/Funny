/** Rôles qui ont toujours le Premium, sans date de fin (même règle que functions/shared/premium.js). */
const ALWAYS_PREMIUM = ['user_premium', 'admin', 'developer'];

/** Le membre a-t-il le Premium ? Seule règle utilisée par l'affichage. */
export function isPremiumMember(
  member: { role?: string | null; subscription_end_date?: string | null } | null | undefined,
): boolean {
  if (!member) return false;
  if (ALWAYS_PREMIUM.includes(member.role ?? '')) return true;
  return !!member.subscription_end_date && new Date(member.subscription_end_date) > new Date();
}
