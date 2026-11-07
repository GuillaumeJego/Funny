import { describe, expect, it } from 'vitest';
import { frenchDate, sendReminders } from '../shared/rappels.js';
import { createFakeApi } from './fake-api.js';

const NOW = new Date('2026-11-06T18:00:00Z');
const inHours = (h) => new Date(NOW.getTime() + h * 3600 * 1000).toISOString();

describe('sendReminders', () => {
  it('prévient une seule fois les participants des sorties des prochaines 24 h', async () => {
    const api = createFakeApi({
      sorties: [
        {
          $id: 'demain',
          title: 'Bowling',
          status: 'published',
          date: inHours(20),
          location: 'Dinan',
        },
        {
          $id: 'plus-tard',
          title: 'Ciné',
          status: 'published',
          date: inHours(30),
          location: 'Dinard',
        },
        {
          $id: 'passee',
          title: 'Resto',
          status: 'published',
          date: inHours(-2),
          location: 'Cancale',
        },
      ],
      inscriptions: [
        { sortie_id: 'demain', user_id: 'alice', status: 'confirmed' },
        { sortie_id: 'demain', user_id: 'bob', status: 'pending' },
        { sortie_id: 'demain', user_id: 'carla', status: 'waiting' },
        { sortie_id: 'plus-tard', user_id: 'alice', status: 'confirmed' },
      ],
    });
    await sendReminders(api, NOW);
    await sendReminders(api, NOW);
    const notifs = api.tables.get('notifications');
    expect(notifs.map((n) => n.user_id).sort()).toEqual(['alice', 'bob']);
    expect(notifs[0].message).toContain('Dinan');
    expect(notifs[0].link).toBe('/dashboard?sortie=demain');
    expect((await api.getRow('sorties', 'plus-tard')).rappel_envoye).toBeUndefined();
  });

  it('écrit la date à l’heure de Paris', () => {
    expect(frenchDate('2026-11-14T18:30:00Z')).toBe('samedi 14 novembre à 19:30');
  });
});
