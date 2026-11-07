import { fail } from './appwrite.js';

/**
 * Le compte développeur est protégé : un admin ne peut ni le bannir, ni changer
 * son Premium ou son accès aux profils. Personne ne peut non plus se bannir soi-même.
 */
export async function requireEditable(api, myId, memberId) {
  if (memberId === myId) fail(403, 'Impossible de faire cette action sur ton propre compte.');
  const [mine, theirs] = await Promise.all([
    api.getRow('member_status', myId),
    api.getRow('member_status', memberId),
  ]);
  if (theirs?.role === 'developer' && mine?.role !== 'developer') {
    fail(403, 'Le compte développeur est protégé.');
  }
}
