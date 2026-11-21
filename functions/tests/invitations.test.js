import { describe, expect, it } from 'vitest';
import { HttpError } from '../shared/appwrite.js';
import { checkPlaces, cleanSortie } from '../shared/sortie-rules.js';
import {
  acceptInvitation,
  checkCanInvite,
  declineInvitation,
  inviteCandidates,
  inviteMembers,
  sortieReaders,
} from '../shared/invitations.js';
import { confirmPlace } from '../shared/sorties.js';
import { createFakeApi } from './fake-api.js';

const NOW = new Date('2026-11-14T12:00:00Z');
const valid = {
  title: 'Karaoké du vendredi',
  theme_id: 'restaurant',
  date: '2026-11-20T19:30',
  location: 'Rennes',
};

const errorOf = async (fn) => {
  try {
    await fn();
  } catch (error) {
    return error;
  }
  return null;
};

describe('thème « Autre »', () => {
  const photo = { image_source: 'custom', image_url: 'https://x/v1/storage/f' };

  it('garde le nom écrit par l’organisateur', () => {
    const data = cleanSortie(
      { ...valid, ...photo, theme_id: 'autre', theme_custom: ' Karaoké ' },
      NOW,
    );
    expect(data.theme_custom).toBe('Karaoké');
  });

  it('exige un nom et une photo', async () => {
    expect(
      await errorOf(() => cleanSortie({ ...valid, ...photo, theme_id: 'autre' }, NOW)),
    ).toBeInstanceOf(HttpError);
    const noPhoto = await errorOf(() =>
      cleanSortie({ ...valid, theme_id: 'autre', theme_custom: 'Karaoké' }, NOW),
    );
    expect(noPhoto?.message).toContain('photo');
  });

  it('ignore le nom libre pour un thème normal', () => {
    expect(cleanSortie({ ...valid, theme_custom: 'X' }, NOW).theme_custom).toBeNull();
  });
});

describe('places des non-abonnés', () => {
  const ok = (args) => expect(() => checkPlaces(args)).not.toThrow();
  const ko = (args) => expect(() => checkPlaces(args)).toThrow(HttpError);

  it('10 places au plus à la création, illimité pour un abonné', () => {
    ok({ places: 10, subscriber: false });
    ko({ places: 11, subscriber: false });
    ko({ places: null, subscriber: false });
    ok({ places: null, subscriber: true });
    ok({ places: 500, subscriber: true });
  });

  it('une sortie garde ses places si l’abonnement a pris fin', () => {
    ok({ places: 30, previous: 30, subscriber: false });
    ok({ places: 20, previous: 30, subscriber: false });
    ko({ places: 31, previous: 30, subscriber: false });
    ok({ places: null, previous: null, subscriber: false });
    ok({ places: 8, previous: 6, subscriber: false });
  });
});

function invitationsApi(extra = {}) {
  return createFakeApi(
    {
      profiles: [
        { $id: 'orga', username: 'Orga' },
        { $id: 'alice', username: 'Alice' },
        { $id: 'bob', username: 'Bob' },
        { $id: 'zoe', username: 'Zoé' },
      ],
      member_status: [{ $id: 'bob', role: 'user_premium' }],
      sorties: [extra.sortie],
      inscriptions: [
        { $id: 'i0', sortie_id: 's1', user_id: 'orga', status: 'confirmed' },
        ...(extra.inscriptions ?? []),
      ],
      blocks: extra.blocks ?? [],
    },
    // L'organisateur est abonné (sauf mention contraire).
    { abonnes: extra.subscribers ?? ['orga'] },
  );
}

const premiumSortie = {
  $id: 's1',
  ...valid,
  date: '2026-11-20T19:30:00Z',
  created_by: 'orga',
  is_premium: true,
  max_participants: 3,
};
const rows = (api) => api.tables.get('inscriptions');
const notifs = (api) => api.tables.get('notifications') ?? [];

describe('invitations', () => {
  it('garde la place de chaque invité et le prévient', async () => {
    const api = invitationsApi({ sortie: premiumSortie });
    const { invited } = await inviteMembers(api, {
      sortie: premiumSortie,
      organizerId: 'orga',
      userIds: ['alice', 'bob', 'orga', 'inconnu'],
      now: NOW,
    });
    expect(invited).toEqual(['alice', 'bob']);
    expect(rows(api).filter((r) => r.status === 'invited')).toHaveLength(2);
    expect(notifs(api).map((n) => n.user_id)).toEqual(['alice', 'bob']);
    // Les 3 places sont prises : un nouveau membre passe en liste d'attente.
    const late = await api.createRow('inscriptions', 'z', {
      sortie_id: 's1',
      user_id: 'zoe',
      status: 'pending',
    });
    expect(await confirmPlace(api, premiumSortie, late.$id)).toBe('waiting');
  });

  it('refuse plus d’invités que de places libres', async () => {
    const api = invitationsApi({ sortie: premiumSortie });
    const error = await errorOf(() =>
      inviteMembers(api, {
        sortie: premiumSortie,
        organizerId: 'orga',
        userIds: ['alice', 'bob', 'zoe'],
        now: NOW,
      }),
    );
    expect(error?.message).toContain('2 places');
    expect(rows(api)).toHaveLength(1);
  });

  it('un organisateur abonné invite aussi à une sortie ouverte à tous', async () => {
    const open = { ...premiumSortie, is_premium: false };
    const api = invitationsApi({ sortie: open });
    const { invited } = await inviteMembers(api, {
      sortie: open,
      organizerId: 'orga',
      userIds: ['alice'],
      now: NOW,
    });
    expect(invited).toEqual(['alice']);
    expect(rows(api).find((r) => r.user_id === 'alice').status).toBe('invited');
  });

  it('pas d’invitation par un organisateur non abonné, ni pour un membre bloqué', async () => {
    const notSubscriber = invitationsApi({ sortie: premiumSortie, subscribers: [] });
    expect(
      (
        await errorOf(() =>
          inviteMembers(notSubscriber, {
            sortie: premiumSortie,
            organizerId: 'orga',
            userIds: ['bob'],
            now: NOW,
          }),
        )
      )?.status,
    ).toBe(403);
    const api = invitationsApi({
      sortie: premiumSortie,
      blocks: [{ $id: 'b', blocker_id: 'alice', blocked_id: 'orga' }],
    });
    const result = await inviteMembers(api, {
      sortie: premiumSortie,
      organizerId: 'orga',
      userIds: ['alice'],
      now: NOW,
    });
    expect(result.invited).toEqual([]);
  });

  it('un invité non abonné peut lire la sortie, pas un invité déjà abonné', async () => {
    const api = invitationsApi({
      sortie: premiumSortie,
      inscriptions: [
        { $id: 'a', sortie_id: 's1', user_id: 'alice', status: 'invited' },
        { $id: 'b', sortie_id: 's1', user_id: 'bob', status: 'invited' },
        { $id: 'z', sortie_id: 's1', user_id: 'zoe', status: 'cancelled' },
      ],
    });
    const readers = await sortieReaders(api, premiumSortie, 'orga');
    expect(readers.some((p) => p.includes('user:alice'))).toBe(true);
    expect(readers.some((p) => p.includes('user:bob'))).toBe(false);
    expect(readers.some((p) => p.includes('user:zoe'))).toBe(false);
  });

  it('accepter rend participant ; refuser libère la place et prévient l’organisateur', async () => {
    const api = invitationsApi({
      sortie: premiumSortie,
      inscriptions: [
        { $id: 'a', sortie_id: 's1', user_id: 'alice', status: 'invited' },
        { $id: 'b', sortie_id: 's1', user_id: 'bob', status: 'invited' },
        { $id: 'z', sortie_id: 's1', user_id: 'zoe', status: 'waiting' },
      ],
    });
    const [alice, bob] = rows(api).slice(1, 3);
    expect(await acceptInvitation(api, { sortie: premiumSortie, inscription: alice })).toEqual({
      status: 'pending',
    });
    await declineInvitation(api, { sortie: premiumSortie, inscription: bob });
    const status = Object.fromEntries(rows(api).map((r) => [r.user_id, r.status]));
    expect(status).toEqual({
      orga: 'confirmed',
      alice: 'pending',
      bob: 'cancelled',
      zoe: 'pending',
    });
    expect(notifs(api).map((n) => n.title)).toContain('❌ Invitation refusée');
  });
});

describe('qui inviter : amis et personnes rencontrées', () => {
  const pastSortie = { $id: 'old', date: '2026-10-01T19:00:00Z', created_by: 'zoe' };
  function candidatesApi(extra = {}) {
    return createFakeApi(
      {
        profiles: [
          { $id: 'orga', username: 'Orga' },
          { $id: 'alice', username: 'Alice' },
          { $id: 'bob', username: 'Bob' },
          { $id: 'zoe', username: 'Zoé' },
          { $id: 'max', username: 'Max' },
          { $id: 'ben', username: 'Ben', is_banned: true },
          { $id: 'tom', username: 'Tom' },
          { $id: 'lea', username: 'Léa' },
        ],
        friendships: [
          { $id: 'f1', requester_id: 'orga', receiver_id: 'alice', status: 'accepted' },
          { $id: 'f2', requester_id: 'bob', receiver_id: 'orga', status: 'accepted' },
          { $id: 'f3', requester_id: 'orga', receiver_id: 'max', status: 'pending' },
          { $id: 'f4', requester_id: 'orga', receiver_id: 'ben', status: 'accepted' },
        ],
        sorties: [premiumSortie, pastSortie],
        inscriptions: [
          { $id: 'i0', sortie_id: 's1', user_id: 'orga', status: 'confirmed' },
          { $id: 'i1', sortie_id: 's1', user_id: 'bob', status: 'invited' },
          // Sortie passée : Orga, Zoé (organisatrice), Alice, Tom (absent), Léa (partie).
          { $id: 'o1', sortie_id: 'old', user_id: 'orga', status: 'pending', present: true },
          { $id: 'o2', sortie_id: 'old', user_id: 'zoe', status: 'confirmed' },
          { $id: 'o3', sortie_id: 'old', user_id: 'alice', status: 'pending' },
          { $id: 'o4', sortie_id: 'old', user_id: 'tom', status: 'pending', present: false },
          { $id: 'o5', sortie_id: 'old', user_id: 'lea', status: 'cancelled' },
          ...(extra.inscriptions ?? []),
        ],
        blocks: extra.blocks ?? [],
      },
      { admins: ['admin'], abonnes: extra.subscribers ?? ['orga'] },
    );
  }
  const ids = (list) => list.map((p) => p.id);

  it('donne les amis acceptés et les participants des sorties passées', async () => {
    const api = candidatesApi();
    const { friends, met, placesLeft } = await inviteCandidates(api, {
      sortie: premiumSortie,
      organizerId: 'orga',
      now: NOW,
    });
    // Pas les demandes en attente, ni les membres bannis.
    expect(ids(friends)).toEqual(['alice', 'bob']);
    // Ni les absents notés, ni ceux qui avaient quitté la sortie, ni soi-même.
    expect(ids(met)).toEqual(['alice', 'zoe']);
    // Bob est déjà invité : il est marqué, et sa place compte.
    expect(friends.find((p) => p.id === 'bob').state).toBe('invited');
    expect(friends.find((p) => p.id === 'alice').state).toBeNull();
    expect(placesLeft).toBe(1);
  });

  it('marche aussi avant la création de la sortie (formulaire)', async () => {
    const api = candidatesApi();
    const { friends, met, placesLeft } = await inviteCandidates(api, {
      sortie: { $id: null, max_participants: 5 },
      organizerId: 'orga',
      now: NOW,
    });
    expect(ids(friends)).toEqual(['alice', 'bob']);
    expect(ids(met)).toEqual(['alice', 'zoe']);
    // Personne n'est encore invité ; seule la place de l'organisateur est prise.
    expect(friends.every((p) => p.state === null)).toBe(true);
    expect(placesLeft).toBe(4);
  });

  it('cache les membres bloqués, dans un sens comme dans l’autre', async () => {
    const api = candidatesApi({
      blocks: [
        { $id: 'b1', blocker_id: 'orga', blocked_id: 'alice' },
        { $id: 'b2', blocker_id: 'zoe', blocked_id: 'orga' },
      ],
    });
    const { friends, met } = await inviteCandidates(api, {
      sortie: premiumSortie,
      organizerId: 'orga',
      now: NOW,
    });
    expect(ids(friends)).toEqual(['bob']);
    expect(ids(met)).toEqual([]);
  });

  it('une personne présente dans les deux listes ne reçoit qu’une invitation', async () => {
    const api = candidatesApi();
    const { invited, skipped } = await inviteMembers(api, {
      sortie: premiumSortie,
      organizerId: 'orga',
      userIds: ['alice', 'alice', 'bob'],
      now: NOW,
    });
    expect(invited).toEqual(['alice']);
    expect(skipped).toEqual(['bob']); // déjà invité
    expect(notifs(api).filter((n) => n.user_id === 'alice')).toHaveLength(1);
    // Un deuxième envoi (double clic) n'invite personne de plus.
    const again = await inviteMembers(api, {
      sortie: premiumSortie,
      organizerId: 'orga',
      userIds: ['alice'],
      now: NOW,
    });
    expect(again.invited).toEqual([]);
    expect(notifs(api).filter((n) => n.user_id === 'alice')).toHaveLength(1);
  });

  it('un membre bloqué est refusé même si l’appli l’envoie', async () => {
    const api = candidatesApi({ blocks: [{ $id: 'b1', blocker_id: 'zoe', blocked_id: 'orga' }] });
    const { invited, skipped } = await inviteMembers(api, {
      sortie: premiumSortie,
      organizerId: 'orga',
      userIds: ['zoe'],
      now: NOW,
    });
    expect(invited).toEqual([]);
    expect(skipped).toEqual(['zoe']);
  });

  it('seul l’organisateur abonné (ou un admin) peut inviter, à toute sortie', async () => {
    const api = candidatesApi();
    expect((await errorOf(() => checkCanInvite(api, premiumSortie, 'alice')))?.status).toBe(403);
    expect(await errorOf(() => checkCanInvite(api, premiumSortie, 'orga'))).toBeNull();
    expect(await errorOf(() => checkCanInvite(api, premiumSortie, 'admin'))).toBeNull();
    const ordinary = { ...premiumSortie, is_premium: false };
    expect(await errorOf(() => checkCanInvite(api, ordinary, 'orga'))).toBeNull();
    const notSubscriber = candidatesApi({ subscribers: [] });
    expect((await errorOf(() => checkCanInvite(notSubscriber, ordinary, 'orga')))?.status).toBe(
      403,
    );
  });
});
