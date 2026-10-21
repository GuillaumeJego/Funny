// Fonction « account » : création du profil après l'inscription, et suppression
// du compte avec toutes ses données (droit RGPD).
import {
  Permission,
  Query,
  Role,
  deleteFile,
  fail,
  handler,
  notify,
  usernameOf,
} from './shared/appwrite.js';
import { deleteSortie, promoteFromWaitingList } from './shared/sorties.js';

const USERNAME = /^[\p{L}\p{N}._-]{3,40}$/u;

/** Crée le profil, la partie privée et le statut du membre. Sans effet s'ils existent déjà. */
async function init({ api, userId, input }) {
  const existing = await api.getRow('profiles', userId);
  if (existing) return { profile: existing };

  const username = String(input.username ?? '').trim();
  if (!USERNAME.test(username)) {
    fail(400, 'Pseudo invalide : 3 à 40 lettres, chiffres, points, tirets ou soulignés.');
  }
  if (await api.findRow('profiles', [Query.equal('username', username)])) {
    fail(409, 'Ce pseudo est déjà pris.');
  }
  const profile = await api.createRow('profiles', userId, { username }, [
    Permission.read(Role.users()),
    Permission.update(Role.user(userId)),
  ]);
  if (!(await api.getRow('profiles_private', userId))) {
    await api.createRow('profiles_private', userId, { birthdate: null }, [
      Permission.read(Role.user(userId)),
      Permission.update(Role.user(userId)),
    ]);
  }
  if (!(await api.getRow('member_status', userId))) {
    await api.createRow('member_status', userId, { role: 'user' });
  }
  return { profile };
}

/** Supprime une conversation entière : messages, réactions, fichiers et équipe. */
async function deleteConversation(api, conversation) {
  const messages = await api.listAllRows('messages', [
    Query.equal('conversation_id', conversation.$id),
  ]);
  for (const message of messages) {
    if (message.media_file_id) await deleteFile(api, 'chat-media', message.media_file_id);
    await api.deleteRow('messages', message.$id);
  }
  const reactions = await api.listAllRows('message_reactions', [
    Query.equal('conversation_id', conversation.$id),
  ]);
  for (const reaction of reactions) await api.deleteRow('message_reactions', reaction.$id);
  await api.deleteRow('conversations', conversation.$id);
  try {
    await api.call('DELETE', `/teams/${conversation.$id}`);
  } catch (error) {
    if (error.code !== 404) throw error;
  }
}

/** Supprime le compte du membre connecté et tout ce qui le concerne. */
async function remove({ api, userId, input }) {
  if (input.confirm !== 'SUPPRIMER') fail(400, 'Confirmation manquante.');
  const username = await usernameOf(api, userId);

  // Ses sorties : supprimées, inscrits et likeurs prévenus.
  for (const sortie of await api.listAllRows('sorties', [Query.equal('created_by', userId)])) {
    await deleteSortie(api, sortie);
  }

  // Ses inscriptions aux autres sorties : la place libérée profite à la liste d'attente.
  for (const inscription of await api.listAllRows('inscriptions', [
    Query.equal('user_id', userId),
  ])) {
    await api.deleteRow('inscriptions', inscription.$id);
    if (inscription.status !== 'pending') continue;
    const sortie = await api.getRow('sorties', inscription.sortie_id);
    if (!sortie) continue;
    await notify(api, [
      {
        user_id: sortie.created_by,
        title: '👋 Désinscription',
        message: `${username} a quitté la sortie « ${sortie.title} »`,
      },
    ]);
    await promoteFromWaitingList(api, sortie);
  }

  const byUser = (table, ...columns) =>
    api.listAllRows(table, [
      columns.length === 1
        ? Query.equal(columns[0], userId)
        : Query.or(columns.map((column) => Query.equal(column, userId))),
    ]);
  const deleteAll = async (table, rows) => {
    for (const row of rows) await api.deleteRow(table, row.$id);
  };

  await deleteAll('favoris', await byUser('favoris', 'user_id'));
  await deleteAll('friendships', await byUser('friendships', 'requester_id', 'receiver_id'));
  await deleteAll('blocks', await byUser('blocks', 'blocker_id', 'blocked_id'));
  await deleteAll('reports', await byUser('reports', 'reporter_id', 'target_user_id'));
  await deleteAll('notifications', await byUser('notifications', 'user_id'));
  await deleteAll('subscriptions', await byUser('subscriptions', 'user_id'));

  // Ses conversations : l'autre membre ne peut plus lui écrire, on les efface en entier.
  const conversations = await api.listAllRows('conversations', [
    Query.contains('participant_ids', userId),
  ]);
  for (const conversation of conversations) await deleteConversation(api, conversation);

  const profile = await api.getRow('profiles', userId);
  if (profile?.avatar_url) await deleteFile(api, 'avatars', profile.avatar_url);
  for (const table of ['profiles', 'profiles_private', 'member_status', 'moderation']) {
    await api.deleteRow(table, userId);
  }
  await api.call('DELETE', `/users/${userId}`);
  return {};
}

export default handler({ init, delete: remove });
