// Modifier et supprimer ses propres messages.
//
// Modifier : seulement un texte, et tant qu'aucun autre participant ne l'a lu (sa date de
// lecture, dans conversation_reads, est antérieure au message).
// Supprimer : à tout moment. Tout le monde voit « Message supprimé » à sa place ; le contenu
// et le fichier sont gardés dans deleted_contents et le stockage, lisibles par le serveur
// (et les admins dans Appwrite) seulement.

import { Query, fail } from './appwrite.js';

/** Longueur maximale d'un message texte. */
export const MAX_TEXT = 4000;

const filePath = (fileId) => `/storage/buckets/chat-media/files/${encodeURIComponent(fileId)}`;

/** Le message, s'il a bien été écrit par `userId`. */
async function ownMessage(api, messageId, userId) {
  const message = await api.getRow('messages', String(messageId ?? ''));
  if (!message || message.sender_id !== userId) fail(404, 'Message introuvable.');
  return message;
}

/** Un autre participant a-t-il ouvert la conversation depuis l'envoi du message ? */
export async function readByOthers(api, message) {
  const reads = await api.listAllRows('conversation_reads', [
    Query.equal('conversation_id', message.conversation_id),
  ]);
  return reads.some((r) => r.user_id !== message.sender_id && r.last_read_at >= message.$createdAt);
}

/** Modifie le texte d'un message pas encore lu. */
export async function editMessage(api, { userId, messageId, content, now = new Date() }) {
  const message = await ownMessage(api, messageId, userId);
  if (message.deleted) fail(400, 'Ce message a été supprimé.');
  if (message.ephemeral || message.type !== 'text') {
    fail(400, 'Seuls les messages texte peuvent être modifiés.');
  }
  const text = typeof content === 'string' ? content.trim() : '';
  if (!text) fail(400, 'Le message est vide.');
  if (text.length > MAX_TEXT) fail(400, `${MAX_TEXT} caractères au maximum.`);
  if (await readByOthers(api, message)) {
    fail(409, 'Ce message a déjà été lu : il ne peut plus être modifié.');
  }
  const updated = await api.updateRow('messages', message.$id, {
    content: text,
    edited_at: now.toISOString(),
  });
  return { message: updated };
}

/**
 * Supprime un message pour tous les participants. Son contenu (et son fichier, rendu illisible
 * par les membres) est gardé à part. Un message éphémère garde son contenu déjà rangé à part.
 */
export async function deleteOwnMessage(api, { userId, messageId, now = new Date() }) {
  const message = await ownMessage(api, messageId, userId);
  if (message.deleted) return { deleted: true };
  if (!message.ephemeral) {
    await api.createRow('deleted_contents', message.$id, {
      conversation_id: message.conversation_id,
      sender_id: message.sender_id,
      type: message.type ?? 'text',
      content: message.content ?? null,
      media_file_id: message.media_file_id || null,
      deleted_at: now.toISOString(),
    });
    if (message.media_file_id) {
      try {
        const file = await api.call('GET', filePath(message.media_file_id));
        await api.call('PUT', filePath(message.media_file_id), {
          body: { name: file.name, permissions: [] },
        });
      } catch (error) {
        if (error.code !== 404) throw error;
      }
    }
  }
  await api.updateRow('messages', message.$id, {
    content: null,
    media_file_id: null,
    deleted: true,
  });
  return { deleted: true };
}

/** Message supprimé effacé pour de bon (conversation supprimée, signalement) : son contenu aussi. */
export async function deleteDeletedParts(api, messageId) {
  const kept = await api.getRow('deleted_contents', messageId);
  if (!kept) return;
  if (kept.media_file_id) {
    try {
      await api.call('DELETE', filePath(kept.media_file_id));
    } catch (error) {
      if (error.code !== 404) throw error;
    }
  }
  await api.deleteRow('deleted_contents', messageId);
}
