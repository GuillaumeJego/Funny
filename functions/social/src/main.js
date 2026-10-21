// Fonction « social » : demandes d'amis, conversations privées, signalements et blocages.
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

function conversationBetween(api, a, b) {
  return api.findRow('conversations', [
    Query.contains('participant_ids', a),
    Query.contains('participant_ids', b),
  ]);
}

async function requireOtherMember(api, userId, otherId) {
  const id = String(otherId ?? '');
  if (!id || id === userId) fail(400, 'Membre invalide.');
  if (!(await api.getRow('profiles', id))) fail(404, 'Membre introuvable.');
  return id;
}

async function friendRequest({ api, userId, input }) {
  const otherId = await requireOtherMember(api, userId, input.userId);
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

  const existing = await conversationBetween(api, userId, otherId);
  if (existing) {
    // Après un blocage puis un déblocage, le membre bloqué doit retrouver l'accès.
    for (const id of [userId, otherId]) await api.addTeamMember(existing.$id, id);
    return { conversationId: existing.$id };
  }

  const conversationId = uniqueId();
  await api.call('POST', '/teams', { body: { teamId: conversationId, name: 'Conversation' } });
  for (const id of [userId, otherId]) await api.addTeamMember(conversationId, id);
  await api.createRow('conversations', conversationId, { participant_ids: [userId, otherId] }, [
    Permission.read(Role.team(conversationId)),
  ]);
  return { conversationId };
}

const REPORT_REASONS = [
  'harcelement',
  'comportement',
  'faux_profil',
  'contenu_choquant',
  'arnaque',
  'mineur',
  'autre',
];

/** Signale un membre aux admins. Un seul signalement ouvert par membre signalé. */
async function report({ api, userId, input }) {
  const targetId = await requireOtherMember(api, userId, input.userId);
  const reason = String(input.reason ?? '');
  if (!REPORT_REASONS.includes(reason)) fail(400, 'Motif invalide.');
  const details = String(input.details ?? '')
    .trim()
    .slice(0, 2000);

  const open = await api.findRow('reports', [
    Query.equal('reporter_id', userId),
    Query.equal('target_user_id', targetId),
    Query.equal('status', 'open'),
  ]);
  if (open) {
    await api.updateRow('reports', open.$id, { reason, details });
    return {};
  }
  await api.createRow('reports', uniqueId(), {
    reporter_id: userId,
    target_user_id: targetId,
    reason,
    details,
    status: 'open',
  });

  const target = await usernameOf(api, targetId);
  const admins = await api.call('GET', '/teams/admins/memberships', {
    queries: [Query.limit(100)],
  });
  await notify(
    api,
    admins.memberships.map((m) => ({
      user_id: m.userId,
      title: '🚩 Nouveau signalement',
      message: `${target} a été signalé. Voir l'espace admin.`,
    })),
  );
  return {};
}

/**
 * Bloque un membre : plus d'amitié, plus de demande d'ami possible dans un sens ou dans
 * l'autre, et il perd l'accès à la conversation. Celui qui bloque garde l'historique.
 */
async function block({ api, userId, input }) {
  const otherId = await requireOtherMember(api, userId, input.userId);
  const existing = await api.findRow('blocks', [
    Query.equal('blocker_id', userId),
    Query.equal('blocked_id', otherId),
  ]);
  if (!existing) {
    await api.createRow('blocks', uniqueId(), { blocker_id: userId, blocked_id: otherId }, [
      Permission.read(Role.user(userId)),
    ]);
  }
  const friendship = await friendshipBetween(api, userId, otherId);
  if (friendship) await api.deleteRow('friendships', friendship.$id);
  const conversation = await conversationBetween(api, userId, otherId);
  if (conversation) await api.removeTeamMember(conversation.$id, otherId);
  return {};
}

async function unblock({ api, userId, input }) {
  const otherId = String(input.userId ?? '');
  const existing = await api.findRow('blocks', [
    Query.equal('blocker_id', userId),
    Query.equal('blocked_id', otherId),
  ]);
  if (existing) await api.deleteRow('blocks', existing.$id);
  return {};
}

export default handler({
  friendRequest,
  friendRespond,
  friendRemove,
  openConversation,
  report,
  block,
  unblock,
});
