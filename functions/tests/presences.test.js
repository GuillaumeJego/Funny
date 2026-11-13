import { describe, expect, it } from 'vitest';
import { sendPresenceReminders, validatePresences } from '../shared/presences.js';
import { createFakeApi } from './fake-api.js';

const NOW = new Date('2026-11-13T08:00:00Z');
const hours = (h) => new Date(NOW.getTime() + h * 3600 * 1000);
const iso = (h) => hours(h).toISOString();

function sortiesApi(extra = {}) {
  return createFakeApi({
    sorties: [
      // Finie hier soir : à valider.
      { $id: 'finie', title: 'Bowling', status: 'published', created_by: 'orga', date: iso(-12) },
      // Commencée il y a 2 h : pas encore finie.
      { $id: 'en-cours', title: 'Ciné', status: 'published', created_by: 'orga', date: iso(-2) },
      // Déjà validée.
      {
        $id: 'validee',
        title: 'Resto',
        status: 'published',
        created_by: 'orga',
        date: iso(-30),
        presences_validees: iso(-20),
      },
      // Seul l'organisateur y était.
      { $id: 'seul', title: 'Balade', status: 'published', created_by: 'orga', date: iso(-10) },
      ...(extra.sorties ?? []),
    ],
    inscriptions: [
      { $id: 'i1', sortie_id: 'finie', user_id: 'orga', status: 'confirmed' },
      { $id: 'i2', sortie_id: 'finie', user_id: 'alice', status: 'pending' },
      { $id: 'i3', sortie_id: 'finie', user_id: 'bob', status: 'pending' },
      { $id: 'i4', sortie_id: 'finie', user_id: 'carla', status: 'waiting' },
      { $id: 'i5', sortie_id: 'en-cours', user_id: 'alice', status: 'pending' },
      { $id: 'i6', sortie_id: 'validee', user_id: 'alice', status: 'pending' },
      { $id: 'i7', sortie_id: 'seul', user_id: 'orga', status: 'confirmed' },
    ],
  });
}

describe('sendPresenceReminders', () => {
  it("prévient l'organisateur une fois par jour tant que ce n'est pas validé", async () => {
    const api = sortiesApi();
    await sendPresenceReminders(api, NOW);
    await sendPresenceReminders(api, hours(1)); // une heure plus tard : pas de doublon
    let notifs = api.tables.get('notifications');
    expect(notifs).toHaveLength(1);
    expect(notifs[0].user_id).toBe('orga');
    expect(notifs[0].link).toBe('/sorties/finie/presences');

    // Le lendemain : nouveau rappel (et un premier pour « en-cours », finie entre-temps).
    await sendPresenceReminders(api, hours(24));
    notifs = api.tables.get('notifications');
    expect(notifs.filter((n) => n.link === '/sorties/finie/presences')).toHaveLength(2);
    expect(notifs.filter((n) => n.link === '/sorties/en-cours/presences')).toHaveLength(1);
  });

  it("valide d'office une sortie sans autre participant que l'organisateur", async () => {
    const api = sortiesApi();
    await sendPresenceReminders(api, NOW);
    expect((await api.getRow('sorties', 'seul')).presences_validees).toBe(NOW.toISOString());
  });

  it('ne relance plus un mois après la sortie', async () => {
    const api = createFakeApi({
      sorties: [
        {
          $id: 'vieille',
          title: 'Expo',
          status: 'published',
          created_by: 'orga',
          date: iso(-24 * 40),
        },
      ],
      inscriptions: [{ $id: 'i1', sortie_id: 'vieille', user_id: 'alice', status: 'pending' }],
    });
    await sendPresenceReminders(api, NOW);
    expect(api.tables.get('notifications') ?? []).toHaveLength(0);
  });
});

describe('validatePresences', () => {
  it('enregistre présents et absents, organisateur toujours présent', async () => {
    const api = sortiesApi();
    const sortie = await api.getRow('sorties', 'finie');
    const result = await validatePresences(api, {
      sortie,
      userId: 'orga',
      absentIds: ['bob', 'orga'],
      now: NOW,
    });
    expect(result).toEqual({ present: 2, absent: 1 });
    const byUser = Object.fromEntries(
      api.tables.get('inscriptions').map((i) => [`${i.sortie_id}/${i.user_id}`, i.present]),
    );
    expect(byUser['finie/orga']).toBe(true);
    expect(byUser['finie/alice']).toBe(true);
    expect(byUser['finie/bob']).toBe(false);
    expect(byUser['finie/carla']).toBeUndefined(); // liste d'attente : pas concernée
    expect((await api.getRow('sorties', 'finie')).presences_validees).toBe(NOW.toISOString());
  });

  it("refuse un autre membre que l'organisateur, une sortie à venir ou déjà validée", async () => {
    const api = sortiesApi({
      sorties: [
        { $id: 'demain', title: 'Jeux', status: 'published', created_by: 'orga', date: iso(20) },
      ],
    });
    const finie = await api.getRow('sorties', 'finie');
    await expect(
      validatePresences(api, { sortie: finie, userId: 'alice', absentIds: [], now: NOW }),
    ).rejects.toThrow('organisateur');
    const demain = await api.getRow('sorties', 'demain');
    await expect(
      validatePresences(api, { sortie: demain, userId: 'orga', absentIds: [], now: NOW }),
    ).rejects.toThrow('pas encore eu lieu');
    const validee = await api.getRow('sorties', 'validee');
    await expect(
      validatePresences(api, { sortie: validee, userId: 'orga', absentIds: [], now: NOW }),
    ).rejects.toThrow('déjà validées');
  });
});
