// Preuves jointes à un signalement fait depuis une conversation : les derniers messages,
// copiés au moment du signalement, et l'accès des admins aux photos et vidéos concernées.
// Les admins ne lisent jamais les conversations : seulement ce qu'un participant leur signale.
import { Query, fail } from './appwrite.js';

/** Nombre de messages joints, et longueur gardée de chacun (la colonne a une taille limite). */
export const EVIDENCE_MESSAGES = 25;
const MAX_CONTENT = 400;

/**
 * Derniers messages de la conversation, du plus ancien au plus récent.
 * Refuse si celui qui signale ne fait pas partie de la conversation.
 */
export async function collectEvidence(api, conversationId, reporterId) {
  const id = String(conversationId ?? '');
  if (!id) return [];
  const conversation = await api.getRow('conversations', id);
  if (!conversation || !(await api.isTeamMember(id, reporterId))) {
    fail(403, 'Conversation introuvable.');
  }
  const rows = await api.listRows('messages', [
    Query.equal('conversation_id', id),
    Query.orderDesc('$createdAt'),
    Query.limit(EVIDENCE_MESSAGES),
  ]);
  return rows.reverse().map((m) => ({
    id: m.$id,
    sender_id: m.sender_id,
    content: String(m.content ?? '').slice(0, MAX_CONTENT),
    type: m.type ?? 'text',
    media_file_id: m.media_file_id || null,
    at: m.$createdAt,
  }));
}

/** Donne aux admins le droit de voir les photos et vidéos jointes au signalement. */
export async function shareMediaWithAdmins(api, evidence) {
  for (const { media_file_id: fileId } of evidence) {
    if (!fileId) continue;
    const path = `/storage/buckets/chat-media/files/${encodeURIComponent(fileId)}`;
    try {
      const file = await api.call('GET', path);
      const permissions = file?.$permissions ?? [];
      const admins = 'read("team:admins")';
      if (permissions.includes(admins)) continue;
      await api.call('PUT', path, { body: { permissions: [...permissions, admins] } });
    } catch (error) {
      // Fichier déjà supprimé : le message reste lisible, sans son média.
      if (error.code !== 404) throw error;
    }
  }
}
