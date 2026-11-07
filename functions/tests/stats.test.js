import { describe, expect, it } from 'vitest';
import { addDays, connexionStats, parisDayHour, recordVisit } from '../shared/stats.js';
import { createFakeApi } from './fake-api.js';

const visit = (user_id, day, hour) => ({ user_id, day, hour, at: `${day}T10:00:00Z` });

describe('recordVisit', () => {
  it('note une connexion au plus toutes les 30 minutes', async () => {
    const api = createFakeApi();
    const t0 = new Date('2026-11-07T08:00:00Z');
    expect((await recordVisit(api, 'alice', t0)).recorded).toBe(true);
    expect((await recordVisit(api, 'alice', new Date(t0.getTime() + 10 * 60000))).recorded).toBe(
      false,
    );
    expect((await recordVisit(api, 'alice', new Date(t0.getTime() + 45 * 60000))).recorded).toBe(
      true,
    );
    const rows = api.tables.get('connexions');
    expect(rows).toHaveLength(2);
    // 8 h UTC en novembre = 9 h à Paris.
    expect(rows[0]).toMatchObject({ day: '2026-11-07', hour: 9 });
  });
});

describe('connexionStats', () => {
  const api = createFakeApi({
    profiles: [
      { $id: 'alice', gender: 'Femme', relationship: 'Célibataire' },
      { $id: 'bob', gender: 'Homme', relationship: 'En couple' },
      { $id: 'carla', gender: null, relationship: 'secret' },
    ],
    connexions: [
      visit('alice', '2026-11-05', 20),
      visit('alice', '2026-11-06', 9),
      visit('alice', '2026-11-06', 21),
      visit('bob', '2026-11-06', 21),
      visit('carla', '2026-11-07', 12),
      visit('bob', '2026-10-01', 8),
    ],
  });

  it('compte les connexions et les membres différents par jour et par heure', async () => {
    const stats = await connexionStats(api, { from: '2026-11-05', to: '2026-11-07' });
    expect(stats.days).toEqual([
      { day: '2026-11-05', total: 1, unique: 1 },
      { day: '2026-11-06', total: 3, unique: 2 },
      { day: '2026-11-07', total: 1, unique: 1 },
    ]);
    expect(stats.total).toBe(5);
    expect(stats.unique).toBe(3);
    expect(stats.hours[21]).toBe(2);
  });

  it('filtre par genre et par situation', async () => {
    const hommes = await connexionStats(api, {
      from: '2026-11-05',
      to: '2026-11-07',
      gender: 'Homme',
    });
    expect(hommes.total).toBe(1);
    const secret = await connexionStats(api, {
      from: '2026-11-05',
      to: '2026-11-07',
      gender: 'secret',
      relationship: 'secret',
    });
    expect(secret.unique).toBe(1);
  });

  it('refuse une période invalide', async () => {
    await expect(connexionStats(api, { from: '2026-11-07', to: '2026-11-01' })).rejects.toThrow();
  });
});

describe('dates', () => {
  it('passe au jour suivant à minuit heure de Paris', () => {
    expect(parisDayHour(new Date('2026-11-07T23:30:00Z'))).toEqual({ day: '2026-11-08', hour: 0 });
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });
});
