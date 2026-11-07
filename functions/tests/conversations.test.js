import { describe, expect, it } from 'vitest';
import { deleteSortieChat, sortieChatId, syncSortieChat } from '../shared/conversations.js';
import { promoteFromWaitingList } from '../shared/sorties.js';
import { createFakeApi } from './fake-api.js';

const sortie = { $id: 'bowling', title: 'Bowling', max_participants: 2 };

function setup() {
  return createFakeApi(
    {
      inscriptions: [
        { $id: 'i1', sortie_id: 'bowling', user_id: 'orga', status: 'confirmed' },
        { $id: 'i2', sortie_id: 'bowling', user_id: 'alice', status: 'pending' },
        { $id: 'i3', sortie_id: 'bowling', user_id: 'bob', status: 'waiting' },
      ],
    },
    {},
  );
}

describe('discussion de groupe d’une sortie', () => {
  it('n’existe qu’après une première ouverture', async () => {
    const api = setup();
    expect(await syncSortieChat(api, sortie)).toBeNull();
    const chat = await syncSortieChat(api, sortie, { create: true });
    expect(chat.$id).toBe(sortieChatId('bowling'));
    expect(chat.sortie_id).toBe('bowling');
    expect(chat.participant_ids.sort()).toEqual(['alice', 'orga']);
    expect(api.teams[chat.$id].sort()).toEqual(['alice', 'orga']);
  });

  it('suit les arrivées et les départs', async () => {
    const api = setup();
    const id = (await syncSortieChat(api, sortie, { create: true })).$id;
    // Alice se désinscrit, Bob sort de la liste d'attente.
    await api.updateRow('inscriptions', 'i2', { status: 'cancelled' });
    await promoteFromWaitingList(api, sortie);
    expect(api.teams[id].sort()).toEqual(['bob', 'orga']);
    expect((await api.getRow('conversations', id)).participant_ids.sort()).toEqual(['bob', 'orga']);
  });

  it('disparaît avec ses messages', async () => {
    const api = setup();
    const id = (await syncSortieChat(api, sortie, { create: true })).$id;
    await api.createRow('messages', 'm1', { conversation_id: id, sender_id: 'orga' });
    await deleteSortieChat(api, 'bowling');
    expect(await api.getRow('conversations', id)).toBeNull();
    expect(await api.getRow('messages', 'm1')).toBeNull();
  });
});
