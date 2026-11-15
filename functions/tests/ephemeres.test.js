import { describe, expect, it } from 'vitest';
import {
  answerSeeAgain,
  askToSeeAgain,
  deleteEphemeralParts,
  openEphemeral,
  sendEphemeral,
} from '../shared/ephemeres.js';
import { collectEvidence } from '../shared/moderation.js';
import { createFakeApi } from './fake-api.js';

function chatApi(extra = {}) {
  const api = createFakeApi(
    {
      profiles: [
        { $id: 'alice', username: 'Alice' },
        { $id: 'bob', username: 'Bob' },
        { $id: 'zoe', username: 'Zoé' },
      ],
      conversations: [
        { $id: 'c1', participant_ids: ['alice', 'bob'] },
        { $id: 's_x', participant_ids: ['alice', 'bob', 'zoe'], sortie_id: 'x' },
      ],
      blocks: extra.blocks ?? [],
    },
    { c1: ['alice', 'bob'], s_x: ['alice', 'bob', 'zoe'] },
  );
  // Faux stockage : un fichier « f1 » envoyé par Alice, et les liens temporaires.
  const files = new Map([
    ['f1', { $id: 'f1', name: 'photo.jpg', $permissions: ['read("team:c1")'] }],
  ]);
  api.files = files;
  api.call = async (method, path, { body } = {}) => {
    const [, , , , , fileId] = path.split('/');
    if (path.startsWith('/tokens/')) return { secret: `jeton-${path.split('/').pop()}` };
    const file = files.get(fileId);
    if (method === 'GET') {
      if (!file) throw Object.assign(new Error('absent'), { code: 404 });
      return file;
    }
    if (method === 'PUT') Object.assign(file, { $permissions: body.permissions });
    if (method === 'DELETE') files.delete(fileId);
    return null;
  };
  return api;
}

const errorOf = async (fn) => {
  try {
    await fn();
  } catch (error) {
    return error;
  }
  return null;
};
const notifs = (api) => api.tables.get('notifications') ?? [];

describe('messages éphémères', () => {
  it('le message visible ne contient rien, le contenu est rangé à part', async () => {
    const api = chatApi();
    const { message } = await sendEphemeral(api, {
      userId: 'alice',
      conversationId: 'c1',
      type: 'text',
      content: ' Secret ',
    });
    expect(message).toMatchObject({ ephemeral: true, content: null, sender_id: 'alice' });
    expect((await api.getRow('ephemeral_contents', message.$id)).content).toBe('Secret');
  });

  it('une photo devient illisible pour les membres, sans être effacée', async () => {
    const api = chatApi();
    const { message } = await sendEphemeral(api, {
      userId: 'alice',
      conversationId: 'c1',
      type: 'image',
      mediaFileId: 'f1',
    });
    expect(api.files.get('f1').$permissions).toEqual([]);
    const opened = await openEphemeral(api, { userId: 'bob', messageId: message.$id });
    expect(opened).toMatchObject({ type: 'image', fileId: 'f1', token: 'jeton-f1' });
    expect(api.files.has('f1')).toBe(true);
  });

  it('refuse un membre extérieur ou bloqué', async () => {
    const api = chatApi({ blocks: [{ $id: 'b', blocker_id: 'bob', blocked_id: 'alice' }] });
    const send = (userId, conversationId) =>
      errorOf(() => sendEphemeral(api, { userId, conversationId, type: 'text', content: 'x' }));
    expect(await send('zoe', 'c1')).not.toBeNull();
    expect(await send('alice', 'c1')).not.toBeNull();
  });

  it('se voit une fois, puis se revoit seulement si l’expéditeur autorise', async () => {
    const api = chatApi();
    const { message } = await sendEphemeral(api, {
      userId: 'alice',
      conversationId: 'c1',
      type: 'text',
      content: 'Coucou',
    });
    const id = message.$id;
    expect(
      await errorOf(() => openEphemeral(api, { userId: 'alice', messageId: id })),
    ).not.toBeNull();
    expect(await openEphemeral(api, { userId: 'bob', messageId: id })).toEqual({
      type: 'text',
      content: 'Coucou',
    });
    expect(
      await errorOf(() => openEphemeral(api, { userId: 'bob', messageId: id })),
    ).not.toBeNull();

    // Demande refusée, puis redemandée et acceptée : une vue de plus.
    await askToSeeAgain(api, { userId: 'bob', messageId: id });
    expect(notifs(api).at(-1)).toMatchObject({ user_id: 'alice', title: '🔁 Demande pour revoir' });
    await answerSeeAgain(api, { userId: 'alice', messageId: id, memberId: 'bob', accept: false });
    expect(
      await errorOf(() => openEphemeral(api, { userId: 'bob', messageId: id })),
    ).not.toBeNull();
    await askToSeeAgain(api, { userId: 'bob', messageId: id });
    expect(
      await errorOf(() =>
        answerSeeAgain(api, { userId: 'bob', messageId: id, memberId: 'bob', accept: true }),
      ),
    ).not.toBeNull();
    await answerSeeAgain(api, { userId: 'alice', messageId: id, memberId: 'bob', accept: true });
    expect((await openEphemeral(api, { userId: 'bob', messageId: id })).content).toBe('Coucou');
    expect(
      await errorOf(() => openEphemeral(api, { userId: 'bob', messageId: id })),
    ).not.toBeNull();
    const [view] = await api.listAllRows('ephemeral_views');
    expect(view).toMatchObject({ user_id: 'bob', seen: 2, allowed: 2, request: null });
  });

  it('dans un groupe, chacun a sa propre vue', async () => {
    const api = chatApi();
    const { message } = await sendEphemeral(api, {
      userId: 'alice',
      conversationId: 's_x',
      type: 'text',
      content: 'Rdv 20h',
    });
    await openEphemeral(api, { userId: 'bob', messageId: message.$id });
    expect((await openEphemeral(api, { userId: 'zoe', messageId: message.$id })).content).toBe(
      'Rdv 20h',
    );
  });

  it('un signalement montre le vrai contenu ; la suppression efface tout', async () => {
    const api = chatApi();
    const { message } = await sendEphemeral(api, {
      userId: 'alice',
      conversationId: 'c1',
      type: 'image',
      mediaFileId: 'f1',
    });
    const evidence = await collectEvidence(api, 'c1', 'bob');
    expect(evidence[0]).toMatchObject({ media_file_id: 'f1', ephemeral: true });
    await openEphemeral(api, { userId: 'bob', messageId: message.$id });
    await deleteEphemeralParts(api, message.$id);
    expect(await api.getRow('ephemeral_contents', message.$id)).toBeNull();
    expect(await api.listAllRows('ephemeral_views')).toHaveLength(0);
    expect(api.files.has('f1')).toBe(false);
  });
});
