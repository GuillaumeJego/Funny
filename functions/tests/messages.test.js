import { describe, expect, it } from 'vitest';
import { deleteDeletedParts, deleteOwnMessage, editMessage } from '../shared/messages.js';
import { collectEvidence } from '../shared/moderation.js';
import { createFakeApi } from './fake-api.js';

function chatApi() {
  const api = createFakeApi(
    {
      profiles: [
        { $id: 'alice', username: 'Alice' },
        { $id: 'bob', username: 'Bob' },
      ],
      conversations: [{ $id: 'c1', participant_ids: ['alice', 'bob'] }],
      messages: [
        {
          $id: 'm1',
          $createdAt: '2026-11-15T10:00:00.000Z',
          conversation_id: 'c1',
          sender_id: 'alice',
          type: 'text',
          content: 'Salut',
        },
        {
          $id: 'm2',
          $createdAt: '2026-11-15T10:01:00.000Z',
          conversation_id: 'c1',
          sender_id: 'alice',
          type: 'image',
          content: null,
          media_file_id: 'f1',
        },
      ],
      conversation_reads: [],
    },
    { c1: ['alice', 'bob'] },
  );
  const files = new Map([
    ['f1', { $id: 'f1', name: 'photo.jpg', $permissions: ['read("team:c1")'] }],
  ]);
  api.files = files;
  api.call = async (method, path, { body } = {}) => {
    const fileId = path.split('/')[5];
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

describe('modifier un message', () => {
  it('modifie un texte pas encore lu', async () => {
    const api = chatApi();
    const { message } = await editMessage(api, {
      userId: 'alice',
      messageId: 'm1',
      content: ' Coucou ',
      now: new Date('2026-11-15T10:05:00Z'),
    });
    expect(message).toMatchObject({ content: 'Coucou', edited_at: '2026-11-15T10:05:00.000Z' });
  });

  it('refuse une fois lu par un autre participant', async () => {
    const api = chatApi();
    await api.createRow('conversation_reads', 'r1', {
      conversation_id: 'c1',
      user_id: 'bob',
      last_read_at: '2026-11-15T10:02:00.000Z',
    });
    expect(
      (await errorOf(() => editMessage(api, { userId: 'alice', messageId: 'm1', content: 'x' })))
        ?.status,
    ).toBe(409);
  });

  it("sa propre lecture n'empêche pas de modifier", async () => {
    const api = chatApi();
    await api.createRow('conversation_reads', 'r1', {
      conversation_id: 'c1',
      user_id: 'alice',
      last_read_at: '2026-11-15T10:02:00.000Z',
    });
    await editMessage(api, { userId: 'alice', messageId: 'm1', content: 'ok' });
    expect((await api.getRow('messages', 'm1')).content).toBe('ok');
  });

  it("refuse le message d'un autre, une photo ou un texte vide", async () => {
    const api = chatApi();
    expect(
      (await errorOf(() => editMessage(api, { userId: 'bob', messageId: 'm1', content: 'x' })))
        ?.status,
    ).toBe(404);
    expect(
      (await errorOf(() => editMessage(api, { userId: 'alice', messageId: 'm2', content: 'x' })))
        ?.status,
    ).toBe(400);
    expect(
      (await errorOf(() => editMessage(api, { userId: 'alice', messageId: 'm1', content: '  ' })))
        ?.status,
    ).toBe(400);
  });
});

describe('supprimer un message', () => {
  it('cache le contenu mais le garde à part, même déjà lu', async () => {
    const api = chatApi();
    await api.createRow('conversation_reads', 'r1', {
      conversation_id: 'c1',
      user_id: 'bob',
      last_read_at: '2026-11-15T11:00:00.000Z',
    });
    await deleteOwnMessage(api, { userId: 'alice', messageId: 'm1' });
    expect(await api.getRow('messages', 'm1')).toMatchObject({ deleted: true, content: null });
    expect((await api.getRow('deleted_contents', 'm1')).content).toBe('Salut');
  });

  it('le fichier reste dans le stockage mais plus aucun membre ne peut le lire', async () => {
    const api = chatApi();
    await deleteOwnMessage(api, { userId: 'alice', messageId: 'm2' });
    expect(await api.getRow('messages', 'm2')).toMatchObject({
      deleted: true,
      media_file_id: null,
    });
    expect(api.files.get('f1').$permissions).toEqual([]);
    expect((await api.getRow('deleted_contents', 'm2')).media_file_id).toBe('f1');
  });

  it('on ne supprime que ses propres messages, et un message supprimé ne se modifie plus', async () => {
    const api = chatApi();
    expect(
      (await errorOf(() => deleteOwnMessage(api, { userId: 'bob', messageId: 'm1' })))?.status,
    ).toBe(404);
    await deleteOwnMessage(api, { userId: 'alice', messageId: 'm1' });
    expect(
      (await errorOf(() => editMessage(api, { userId: 'alice', messageId: 'm1', content: 'x' })))
        ?.status,
    ).toBe(400);
  });

  it('un signalement montre le contenu supprimé aux admins, et le nettoyage efface tout', async () => {
    const api = chatApi();
    await deleteOwnMessage(api, { userId: 'alice', messageId: 'm2' });
    const evidence = await collectEvidence(api, 'c1', 'bob');
    expect(evidence.find((e) => e.id === 'm2')).toMatchObject({
      media_file_id: 'f1',
      deleted: true,
    });
    await deleteDeletedParts(api, 'm2');
    expect(await api.getRow('deleted_contents', 'm2')).toBeNull();
    expect(api.files.has('f1')).toBe(false);
  });
});
