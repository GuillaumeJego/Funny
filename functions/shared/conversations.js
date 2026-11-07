// Conversations : à deux (entre amis) ou de groupe (les participants d'une sortie).
// Chaque conversation est une équipe Appwrite : messages et fichiers ne sont lisibles
// que par ses membres.
import { Permission, Query, Role, deleteFile, inBatches } from './appwrite.js';

/** Identifiant de la discussion de groupe d'une sortie (et de son équipe). */
export const sortieChatId = (sortieId) => `s_${sortieId}`;

/** Supprime une conversation entière : messages, réactions, fichiers et équipe. */
export async function deleteConversation(api, conversation) {
  const messages = await api.listAllRows('messages', [
    Query.equal('conversation_id', conversation.$id),
  ]);
  await inBatches(messages, async (message) => {
    if (message.media_file_id) await deleteFile(api, 'chat-media', message.media_file_id);
    await api.deleteRow('messages', message.$id);
  });
  const reactions = await api.listAllRows('message_reactions', [
    Query.equal('conversation_id', conversation.$id),
  ]);
  await inBatches(reactions, (reaction) => api.deleteRow('message_reactions', reaction.$id));
  const reads = await api.listAllRows('conversation_reads', [
    Query.equal('conversation_id', conversation.$id),
  ]);
  await inBatches(reads, (read) => api.deleteRow('conversation_reads', read.$id));
  await api.deleteRow('conversations', conversation.$id);
  try {
    await api.call('DELETE', `/teams/${conversation.$id}`);
  } catch (error) {
    if (error.code !== 404) throw error;
  }
}

/** Participants d'une sortie : inscrits et organisateur (pas la liste d'attente). */
async function participantIds(api, sortieId) {
  const rows = await api.listAllRows('inscriptions', [
    Query.equal('sortie_id', sortieId),
    Query.equal('status', ['pending', 'confirmed']),
  ]);
  return [...new Set(rows.map((r) => r.user_id))];
}

/**
 * Met la discussion de groupe d'une sortie à jour avec ses participants : ceux qui
 * arrivent y entrent, ceux qui partent n'y ont plus accès. Avec `create`, la crée si
 * elle n'existe pas encore ; sinon, ne fait rien tant que personne ne l'a ouverte.
 */
export async function syncSortieChat(api, sortie, { create = false } = {}) {
  const id = sortieChatId(sortie.$id);
  let conversation = await api.getRow('conversations', id);
  if (!conversation && !create) return null;
  const ids = await participantIds(api, sortie.$id);

  if (!conversation) {
    try {
      await api.call('POST', '/teams', {
        body: { teamId: id, name: `Sortie : ${sortie.title}`.slice(0, 128) },
      });
    } catch (error) {
      if (error.code !== 409) throw error; // déjà créée par un appel en même temps
    }
    try {
      conversation = await api.createRow(
        'conversations',
        id,
        { participant_ids: ids, sortie_id: sortie.$id },
        [Permission.read(Role.team(id))],
      );
    } catch (error) {
      if (error.code !== 409) throw error;
      conversation = await api.getRow('conversations', id);
    }
  }

  const before = conversation.participant_ids ?? [];
  for (const userId of ids) await api.addTeamMember(id, userId);
  for (const userId of before.filter((u) => !ids.includes(u))) {
    await api.removeTeamMember(id, userId);
  }
  const changed = before.length !== ids.length || before.some((u) => !ids.includes(u));
  if (changed) {
    conversation = await api.updateRow('conversations', id, { participant_ids: ids });
  }
  return conversation;
}

/** Supprime la discussion de groupe d'une sortie, si elle existe. */
export async function deleteSortieChat(api, sortieId) {
  const conversation = await api.getRow('conversations', sortieChatId(sortieId));
  if (conversation) await deleteConversation(api, conversation);
}
