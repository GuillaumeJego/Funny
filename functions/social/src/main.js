// Fonction « social » : demandes d'amis et ouverture des conversations privées.
import {
  Permission,
  Query,
  Role,
  fail,
  handler,
  notify,
  uniqueId,
  usernameOf,
} from './shared/appwrite.js';

async function friendshipBetween(api, a, b) {
  return api.findRow('friendships', [
    Query.or([
      Query.and([Query.equal('requester_id', a), Query.equal('receiver_id', b)]),
      Query.and([Query.equal('requester_id', b), Query.equal('receiver_id', a)]),
    ]),
  ]);
}

async function isBlocked(api, a, b) {
  const block = await api.findRow('blocks', [
    Query.or([
      Query.and([Query.equal('blocker_id', a), Query.equal('blocked_id', b)]),
      Query.and([Query.equal('blocker_id', b), Query.equal('blocked_id', a)]),
    ]),
  ]);
  return !!block;
}

async function friendRequest({ api, userId, input }) {
  const otherId = String(input.userId ?? '');
  if (!otherId || otherId === userId) fail(400, 'Membre invalide.');
  if (!(await api.getRow('profiles', otherId))) fail(404, 'Membre introuvable.');
  if (await isBlocked(api, userId, otherId)) fail(403, 'Impossible de contacter ce membre.');

  const existing = await friendshipBetween(api, userId, otherId);
  if (existing && existing.status !== 'declined') return { friendship: existing };
  if (existing) await api.deleteRow('friendships', existing.$id);

  const friendship = await api.createRow(
    'friendships',
    uniqueId(),
    { requester_id: userId, receiver_id: otherId, status: 'pending' },
    [userId, otherId].flatMap((id) => [Permission.read(Role.user(id))]),
  );
  const actor = await usernameOf(api, userId);
  await notify(api, [
    {
      user_id: otherId,
      actor_id: userId,
      title: "👥 Demande d'ami",
      message: `${actor} vous a envoyé une demande d'ami`,
    },
  ]);
  return { friendship };
}

async function friendRespond({ api, userId, input }) {
  const friendship = await api.getRow('friendships', String(input.friendshipId ?? ''));
  if (!friendship || friendship.receiver_id !== userId || friendship.status !== 'pending') {
    fail(404, 'Demande introuvable.');
  }
  const status = input.accept ? 'accepted' : 'declined';
  const updated = await api.updateRow('friendships', friendship.$id, { status });
  if (input.accept) {
    const actor = await usernameOf(api, userId);
    await notify(api, [
      {
        user_id: friendship.requester_id,
        actor_id: userId,
        title: '🤝 Demande acceptée',
        message: `${actor} a accepté votre demande d'ami`,
      },
    ]);
  }
  return { friendship: updated };
}

async function friendRemove({ api, userId, input }) {
  const friendship = await api.getRow('friendships', String(input.friendshipId ?? ''));
  if (!friendship || ![friendship.requester_id, friendship.receiver_id].includes(userId)) {
    fail(404, 'Lien introuvable.');
  }
  await api.deleteRow('friendships', friendship.$id);
  return {};
}

/**
 * Ouvre (ou retrouve) la conversation avec un ami. Chaque conversation est une équipe
 * Appwrite à deux membres : messages et fichiers sont lisibles par cette équipe seulement.
 */
async function openConversation({ api, userId, input }) {
  const otherId = String(input.userId ?? '');
  const friendship = await friendshipBetween(api, userId, otherId);
  if (!friendship || friendship.status !== 'accepted') {
    fail(403, 'Vous devez être amis pour discuter.');
  }
  if (await isBlocked(api, userId, otherId)) fail(403, 'Impossible de contacter ce membre.');

  const existing = await api.findRow('conversations', [
    Query.contains('participant_ids', userId),
    Query.contains('participant_ids', otherId),
  ]);
  if (existing) return { conversationId: existing.$id };

  const conversationId = uniqueId();
  await api.call('POST', '/teams', { body: { teamId: conversationId, name: 'Conversation' } });
  for (const id of [userId, otherId]) await api.addTeamMember(conversationId, id);
  await api.createRow('conversations', conversationId, { participant_ids: [userId, otherId] }, [
    Permission.read(Role.team(conversationId)),
  ]);
  return { conversationId };
}

export default handler({ friendRequest, friendRespond, friendRemove, openConversation });
