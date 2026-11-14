import { describe, expect, it } from 'vitest';
import { listProfileVisits, purgeOldVisits, recordProfileVisit } from '../shared/visites.js';
import { notify } from '../shared/appwrite.js';
import { createFakeApi } from './fake-api.js';

const NOW = new Date('2026-11-14T12:00:00Z');
const at = (h) => new Date(NOW.getTime() + h * 3600 * 1000);

function visitsApi(extra = {}) {
  return createFakeApi({
    profiles: [
      { $id: 'alice', username: 'Alice' },
      { $id: 'bob', username: 'Bob' },
      { $id: 'zoe', username: 'Zoé' },
    ],
    member_status: [
      { $id: 'alice', role: 'user' },
      { $id: 'bob', role: 'user_premium' },
    ],
    blocks: extra.blocks ?? [],
    profile_visits: extra.visits ?? [],
  });
}

const notifs = (api) => api.tables.get('notifications') ?? [];
const visits = (api) => api.tables.get('profile_visits') ?? [];

describe('visites de profil', () => {
  it('prévient un membre non Premium sans révéler le visiteur', async () => {
    const api = visitsApi();
    await recordProfileVisit(api, { visitorId: 'zoe', visitedId: 'alice', now: NOW });
    expect(visits(api)).toHaveLength(1);
    expect(notifs(api)).toHaveLength(1);
    expect(notifs(api)[0].user_id).toBe('alice');
    expect(notifs(api)[0].actor_id).toBeUndefined();
    expect(notifs(api)[0].message).not.toContain('Zoé');
  });

  it('donne le nom du visiteur à un membre Premium', async () => {
    const api = visitsApi();
    await recordProfileVisit(api, { visitorId: 'zoe', visitedId: 'bob', now: NOW });
    expect(notifs(api)[0].actor_id).toBe('zoe');
    expect(notifs(api)[0].message).toContain('Zoé');
  });

  it('ne prévient qu’une fois par jour pour un même visiteur', async () => {
    const api = visitsApi();
    await recordProfileVisit(api, { visitorId: 'zoe', visitedId: 'alice', now: NOW });
    await recordProfileVisit(api, { visitorId: 'zoe', visitedId: 'alice', now: at(3) });
    expect(notifs(api)).toHaveLength(1);
    expect(visits(api)).toHaveLength(1);
    expect(visits(api)[0].at).toBe(at(3).toISOString());
    await recordProfileVisit(api, { visitorId: 'zoe', visitedId: 'alice', now: at(25) });
    expect(notifs(api)).toHaveLength(2);
  });

  it('ignore sa propre visite et les membres bloqués', async () => {
    const api = visitsApi({ blocks: [{ $id: 'b1', blocker_id: 'alice', blocked_id: 'zoe' }] });
    await recordProfileVisit(api, { visitorId: 'alice', visitedId: 'alice', now: NOW });
    await recordProfileVisit(api, { visitorId: 'zoe', visitedId: 'alice', now: NOW });
    expect(visits(api)).toHaveLength(0);
    expect(notifs(api)).toHaveLength(0);
  });

  it('liste floutée pour un non Premium, visible pour un Premium', async () => {
    const rows = [
      { $id: 'v1', visitor_id: 'zoe', visited_id: 'alice', at: at(-2).toISOString() },
      { $id: 'v2', visitor_id: 'bob', visited_id: 'alice', at: at(-1).toISOString() },
      { $id: 'v3', visitor_id: 'zoe', visited_id: 'bob', at: at(-1).toISOString() },
      { $id: 'v4', visitor_id: 'bob', visited_id: 'alice', at: at(-24 * 40).toISOString() },
    ];
    const api = visitsApi({ visits: rows });
    const forAlice = await listProfileVisits(api, { userId: 'alice', now: NOW });
    expect(forAlice.premium).toBe(false);
    expect(forAlice.visits).toHaveLength(2);
    expect(forAlice.visits.every((v) => v.visitor_id === undefined)).toBe(true);

    const forBob = await listProfileVisits(api, { userId: 'bob', now: NOW });
    expect(forBob.premium).toBe(true);
    expect(forBob.visits).toEqual([{ at: at(-1).toISOString(), visitor_id: 'zoe' }]);
  });

  it('efface les visites de plus de 30 jours', async () => {
    const api = visitsApi({
      visits: [
        { $id: 'old', visitor_id: 'zoe', visited_id: 'alice', at: at(-24 * 31).toISOString() },
        { $id: 'new', visitor_id: 'bob', visited_id: 'alice', at: at(-24).toISOString() },
      ],
    });
    expect(await purgeOldVisits(api, NOW)).toEqual({ visitsPurged: 1 });
    expect(visits(api).map((v) => v.$id)).toEqual(['new']);
  });
});

describe('notifications coupées par le membre', () => {
  it('n’envoie pas une catégorie coupée, mais toujours les notifications importantes', async () => {
    const api = createFakeApi({
      profiles: [
        { $id: 'alice', username: 'Alice' },
        { $id: 'zoe', username: 'Zoé' },
      ],
      profiles_private: [{ $id: 'alice', notif_off: ['visites'] }],
    });
    await recordProfileVisit(api, { visitorId: 'zoe', visitedId: 'alice', now: NOW });
    await notify(api, [
      { user_id: 'alice', category: 'amis', title: 'Ami', message: 'm' },
      { user_id: 'alice', title: 'Sortie annulée', message: 'm' },
    ]);
    const titles = (api.tables.get('notifications') ?? []).map((n) => n.title);
    expect(titles).toEqual(['Ami', 'Sortie annulée']);
    expect((api.tables.get('notifications') ?? []).some((n) => 'category' in n)).toBe(false);
  });
});
