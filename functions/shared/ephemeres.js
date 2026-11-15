// Messages éphémères (« voir une fois ») : texte, photo ou vidéo.
//
// Le message visible par la conversation ne contient rien : seulement son type et le drapeau
// `ephemeral`. Le vrai contenu est rangé dans `ephemeral_contents`, que seul le serveur lit, et
// le fichier du stockage n'est lisible par aucun membre. Chaque participant (sauf l'expéditeur)
// peut l'ouvrir une fois ; ensuite, il peut demander à le revoir, et l'expéditeur autorise
// (une vue de plus) ou refuse. Le fichier n'est jamais effacé : les admins le voient dans
// Appwrite, et il sert en cas de signalement.

import { Permission, Query, Role, fail, notify, uniqueId, usernameOf } from './appwrite.js';

/** Longueur maximale d'un texte éphémère. */
export const MAX_TEXT = 4000;
/** Durée de validité du lien qui sert la photo ou la vidéo à son ouverture. */
const MEDIA_LINK_MS = 2 * 60 * 1000;

const filePath = (fileId) => `/storage/buckets/chat-media/files/${encodeURIComponent(fileId)}`;

/** La conversation, si `userId` en fait partie ; sinon refus. */
async function conversationOf(api, conversationId, userId) {
  const conversation = await api.getRow('conversations', String(conversationId ?? ''));
  if (!conversation || !(conversation.participant_ids ?? []).includes(userId)) {
    fail(403, 'Conversation introuvable.');
  }
  return conversation;
}

async function blockedBetween(api, a, b) {
  const block = await api.findRow('blocks', [
    Query.or([
      Query.and([Query.equal('blocker_id', a), Query.equal('blocked_id', b)]),
      Query.and([Query.equal('blocker_id', b), Query.equal('blocked_id', a)]),
    ]),
  ]);
  return !!block;
}

/** Le message éphémère, et sa conversation (que `userId` doit faire partie). */
async function ephemeralMessage(api, messageId, userId) {
  const message = await api.getRow('messages', String(messageId ?? ''));
  if (!message || !message.ephemeral) fail(404, 'Message introuvable.');
  const conversation = await conversationOf(api, message.conversation_id, userId);
  return { message, conversation };
}

async function viewOf(api, messageId, userId) {
  return api.findRow('ephemeral_views', [
    Query.equal('message_id', messageId),
    Query.equal('user_id', userId),
  ]);
}

/** Crée ou met à jour la ligne de vue d'un participant (lisible par la conversation). */
async function saveView(api, message, userId, existing, data) {
  if (existing) return api.updateRow('ephemeral_views', existing.$id, data);
  return api.createRow(
    'ephemeral_views',
    uniqueId(),
    {
      message_id: message.$id,
      conversation_id: message.conversation_id,
      user_id: userId,
      seen: 0,
      allowed: 1,
      ...data,
    },
    [Permission.read(Role.team(message.conversation_id))],
  );
}

/**
 * Envoie un message éphémère : un texte, ou une photo / vidéo déjà envoyée dans « chat-media ».
 * Le fichier devient illisible pour les membres (seul le serveur le sert, à l'ouverture).
 */
export async function sendEphemeral(api, { userId, conversationId, type, content, mediaFileId }) {
  const conversation = await conversationOf(api, conversationId, userId);
  if (!conversation.sortie_id) {
    for (const other of conversation.participant_ids.filter((id) => id !== userId)) {
      if (await blockedBetween(api, userId, other)) fail(403, 'Impossible d’écrire à ce membre.');
    }
  }
  const kind = ['text', 'image', 'video'].includes(type) ? type : 'text';
  const text = typeof content === 'string' ? content.trim() : '';
  let fileId = null;
  if (kind === 'text') {
    if (!text) fail(400, 'Le message est vide.');
    if (text.length > MAX_TEXT) fail(400, `${MAX_TEXT} caractères au maximum.`);
  } else {
    fileId = String(mediaFileId ?? '');
    let file;
    try {
      file = fileId ? await api.call('GET', filePath(fileId)) : null;
    } catch (error) {
      if (error.code !== 404) throw error;
    }
    if (!file) fail(400, 'Fichier introuvable : envoie-le à nouveau.');
    // Plus personne ne lit le fichier directement : il ne sort que par openEphemeral.
    await api.call('PUT', filePath(fileId), { body: { name: file.name, permissions: [] } });
  }

  const message = await api.createRow(
    'messages',
    uniqueId(),
    {
      conversation_id: conversation.$id,
      sender_id: userId,
      content: null,
      type: kind,
      media_file_id: null,
      reply_to_id: null,
      ephemeral: true,
    },
    [
      Permission.read(Role.team(conversation.$id)),
      Permission.update(Role.user(userId)),
      Permission.delete(Role.user(userId)),
    ],
  );
  await api.createRow('ephemeral_contents', message.$id, {
    conversation_id: conversation.$id,
    sender_id: userId,
    content: kind === 'text' ? text : null,
    media_file_id: fileId,
  });
  return { message };
}

/**
 * Ouvre un message éphémère reçu : renvoie son texte, ou un lien de quelques minutes vers la
 * photo / vidéo. Compte une vue ; refuse quand toutes les vues autorisées sont utilisées.
 */
export async function openEphemeral(api, { userId, messageId, now = new Date() }) {
  const { message } = await ephemeralMessage(api, messageId, userId);
  if (message.sender_id === userId) fail(403, 'C’est ton propre message éphémère.');
  const view = await viewOf(api, message.$id, userId);
  const seen = view?.seen ?? 0;
  const allowed = view?.allowed ?? 1;
  if (seen >= allowed) fail(403, 'Tu as déjà vu ce message. Demande à le revoir.');
  const secret = await api.getRow('ephemeral_contents', message.$id);
  if (!secret) fail(404, 'Ce message n’est plus disponible.');

  await saveView(api, message, userId, view, {
    seen: seen + 1,
    seen_at: now.toISOString(),
    request: null,
  });
  if (message.type === 'text') return { type: 'text', content: secret.content };
  const token = await api.call(
    'POST',
    `/tokens/buckets/chat-media/files/${encodeURIComponent(secret.media_file_id)}`,
    { body: { expire: new Date(now.getTime() + MEDIA_LINK_MS).toISOString() } },
  );
  return { type: message.type, fileId: secret.media_file_id, token: token.secret };
}

/** Après l'avoir vu, le destinataire demande à revoir le message : l'expéditeur est prévenu. */
export async function askToSeeAgain(api, { userId, messageId }) {
  const { message } = await ephemeralMessage(api, messageId, userId);
  if (message.sender_id === userId) fail(403, 'C’est ton propre message éphémère.');
  const view = await viewOf(api, message.$id, userId);
  if (!view || view.seen < view.allowed) fail(400, 'Tu peux encore voir ce message.');
  if (view.request === 'pending') return { request: 'pending' };
  await saveView(api, message, userId, view, { request: 'pending' });
  const name = await usernameOf(api, userId);
  await notify(api, [
    {
      user_id: message.sender_id,
      actor_id: userId,
      title: '🔁 Demande pour revoir',
      message: `${name} demande à revoir ton message éphémère.`,
      link: `/messages/${message.conversation_id}`,
    },
  ]);
  return { request: 'pending' };
}

/** L'expéditeur autorise (une vue de plus) ou refuse la demande d'un participant. */
export async function answerSeeAgain(api, { userId, messageId, memberId, accept }) {
  const { message } = await ephemeralMessage(api, messageId, userId);
  if (message.sender_id !== userId) fail(403, 'Seul l’expéditeur peut répondre.');
  const view = await viewOf(api, message.$id, String(memberId ?? ''));
  if (!view || view.request !== 'pending') fail(400, 'Aucune demande en attente.');
  const ok = accept === true;
  await saveView(
    api,
    message,
    view.user_id,
    view,
    ok ? { allowed: view.allowed + 1, request: null } : { request: 'refused' },
  );
  const name = await usernameOf(api, userId);
  await notify(api, [
    {
      user_id: view.user_id,
      actor_id: userId,
      title: ok ? '👁 Tu peux revoir le message' : '🙈 Demande refusée',
      message: ok
        ? `${name} t'autorise à revoir son message éphémère une fois.`
        : `${name} préfère que tu ne revoies pas son message éphémère.`,
      link: `/messages/${message.conversation_id}`,
    },
  ]);
  return { accepted: ok };
}

/** Message éphémère supprimé (conversation, signalement) : son contenu et ses vues aussi. */
export async function deleteEphemeralParts(api, messageId) {
  const secret = await api.getRow('ephemeral_contents', messageId);
  if (secret) {
    if (secret.media_file_id) {
      try {
        await api.call('DELETE', filePath(secret.media_file_id));
      } catch (error) {
        if (error.code !== 404) throw error;
      }
    }
    await api.deleteRow('ephemeral_contents', messageId);
  }
  const views = await api.listAllRows('ephemeral_views', [Query.equal('message_id', messageId)]);
  for (const view of views) await api.deleteRow('ephemeral_views', view.$id);
}
