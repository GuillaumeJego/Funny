import { describe, expect, it } from 'vitest';
import { HttpError } from '../shared/appwrite.js';
import { nextHeartDate, recordAffinity, sendAffinityQuestions } from '../shared/affinites.js';
import { createFakeApi } from './fake-api.js';

// Le faux serveur date ses lignes au 1er janvier 2026 : on se place juste après.
const NOW = new Date('2026-01-02T12:00:00Z');
const hoursAgo = (h) => new Date(NOW.getTime() - h * 3600 * 1000).toISOString();
const inscrit = (sortie_id, user_id, status = 'confirmed') => ({ sortie_id, user_id, status });

function setup({ relationships = {}, settings = {} } = {}) {
  return createFakeApi({
    sorties: [
      { $id: 'finie', title: 'Bowling', status: 'published', date: hoursAgo(6) },
      { $id: 'encours', title: 'Ciné', status: 'published', date: hoursAgo(1) },
      { $id: 'vieille', title: 'Resto', status: 'published', date: hoursAgo(100) },
      { $id: 'seul', title: 'Rando', status: 'published', date: hoursAgo(6) },
    ],
    inscriptions: [
      inscrit('finie', 'alice'),
      inscrit('finie', 'bob', 'pending'),
      inscrit('finie', 'carla'),
      inscrit('finie', 'dan', 'cancelled'),
      inscrit('encours', 'alice'),
      inscrit('encours', 'bob'),
      inscrit('seul', 'alice'),
    ],
    profiles: Object.entries(relationships).map(([$id, relationship]) => ({ $id, relationship })),
    app_settings: Object.entries(settings).map(([$id, value]) => ({
      $id,
      value: JSON.stringify(value),
    })),
  });
}

async function openQuestion(api) {
  await sendAffinityQuestions(api, NOW);
  return api.getRow('sorties', 'finie');
}

async function errorOf(promise) {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  return null;
}

describe('sendAffinityQuestions', () => {
  it('pose la question une seule fois, aux participants des sorties finies depuis peu', async () => {
    const api = setup();
    await sendAffinityQuestions(api, NOW);
    await sendAffinityQuestions(api, NOW);
    const notifs = api.tables.get('notifications');
    expect(notifs.map((n) => n.user_id).sort()).toEqual(['alice', 'bob', 'carla']);
    expect(notifs[0].link).toBe('/sorties/finie/affinites');
    expect((await api.getRow('sorties', 'finie')).affinites_jusqua).toBe(
      new Date(NOW.getTime() + 24 * 3600 * 1000).toISOString(),
    );
    expect((await api.getRow('sorties', 'encours')).affinites_jusqua).toBeUndefined();
    expect((await api.getRow('sorties', 'vieille')).affinites_jusqua).toBeUndefined();
  });
});

describe('recordAffinity', () => {
  it('prévient les deux membres quand le choix est réciproque', async () => {
    const api = setup();
    const sortie = await openQuestion(api);
    const first = await recordAffinity(api, {
      sortie,
      fromId: 'alice',
      toId: 'bob',
      choice: 'amitie',
      now: NOW,
    });
    expect(first.mutual).toBe(false);
    const second = await recordAffinity(api, {
      sortie,
      fromId: 'bob',
      toId: 'alice',
      choice: 'amitie',
      now: NOW,
    });
    expect(second.mutual).toBe(true);
    const mutualNotifs = api.tables
      .get('notifications')
      .filter((n) => n.link?.startsWith('/membres'));
    expect(mutualNotifs.map((n) => n.user_id).sort()).toEqual(['alice', 'bob']);
  });

  it('ne prévient personne si les choix diffèrent', async () => {
    const api = setup();
    const sortie = await openQuestion(api);
    await recordAffinity(api, { sortie, fromId: 'alice', toId: 'bob', choice: 'amitie', now: NOW });
    const res = await recordAffinity(api, {
      sortie,
      fromId: 'bob',
      toId: 'alice',
      choice: 'autre_sortie',
      now: NOW,
    });
    expect(res.mutual).toBe(false);
  });

  it('refuse une deuxième réponse, un non-participant et un délai dépassé', async () => {
    const api = setup();
    const sortie = await openQuestion(api);
    await recordAffinity(api, { sortie, fromId: 'alice', toId: 'bob', choice: 'none', now: NOW });
    const again = await errorOf(
      recordAffinity(api, { sortie, fromId: 'alice', toId: 'bob', choice: 'amitie', now: NOW }),
    );
    expect(again).toBeInstanceOf(HttpError);
    const outsider = await errorOf(
      recordAffinity(api, { sortie, fromId: 'dan', toId: 'bob', choice: 'amitie', now: NOW }),
    );
    expect(outsider.status).toBe(403);
    const late = await errorOf(
      recordAffinity(api, {
        sortie,
        fromId: 'carla',
        toId: 'bob',
        choice: 'amitie',
        now: new Date(NOW.getTime() + 25 * 3600 * 1000),
      }),
    );
    expect(late.status).toBe(400);
  });

  it('réserve le coup de cœur aux célibataires en recherche', async () => {
    const api = setup({ relationships: { alice: 'Célibataire', bob: 'Célibataire en recherche' } });
    const sortie = await openQuestion(api);
    const refused = await errorOf(
      recordAffinity(api, {
        sortie,
        fromId: 'alice',
        toId: 'bob',
        choice: 'coup_de_coeur',
        now: NOW,
      }),
    );
    expect(refused.status).toBe(403);
    const ok = await recordAffinity(api, {
      sortie,
      fromId: 'bob',
      toId: 'alice',
      choice: 'coup_de_coeur',
      now: NOW,
    });
    expect(ok.affinite.choice).toBe('coup_de_coeur');
  });

  it('limite les coups de cœur selon le réglage de l’admin', async () => {
    const api = setup({ relationships: { bob: 'Célibataire en recherche' } });
    const sortie = await openQuestion(api);
    await recordAffinity(api, {
      sortie,
      fromId: 'bob',
      toId: 'alice',
      choice: 'coup_de_coeur',
      now: NOW,
    });
    const second = await errorOf(
      recordAffinity(api, {
        sortie,
        fromId: 'bob',
        toId: 'carla',
        choice: 'coup_de_coeur',
        now: NOW,
      }),
    );
    expect(second.status).toBe(400);
    expect(await nextHeartDate(api, 'bob', NOW)).toBeInstanceOf(Date);

    // Deux coups de cœur permis : le second passe.
    await api.createRow('app_settings', 'coeurs_par_periode', { value: '2' });
    const ok = await recordAffinity(api, {
      sortie,
      fromId: 'bob',
      toId: 'carla',
      choice: 'coup_de_coeur',
      now: NOW,
    });
    expect(ok.affinite.to_user).toBe('carla');
  });
});
