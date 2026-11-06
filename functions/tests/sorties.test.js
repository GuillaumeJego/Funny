import { describe, expect, it } from 'vitest';
import { HttpError } from '../shared/appwrite.js';
import {
  confirmPlace,
  deleteSortie,
  premiumPreview,
  promoteFromWaitingList,
  savePremiumPreview,
} from '../shared/sorties.js';
import { cleanSortie, isSafeDefaultImage, sortieImageFileId } from '../shared/sortie-rules.js';
import { isPremium } from '../shared/premium.js';
import { createFakeApi } from './fake-api.js';

const NOW = new Date('2026-11-06T12:00:00Z');
const valid = {
  title: 'Resto entre amis',
  theme_id: 'restaurant',
  date: '2026-11-20T19:30',
  location: 'Lyon',
  price: 25,
  max_participants: 6,
};

const errorOf = (fn) => {
  try {
    fn();
  } catch (error) {
    return error;
  }
  return null;
};

describe('cleanSortie', () => {
  it('garde une sortie correcte et nettoie les champs', () => {
    const sortie = cleanSortie({ ...valid, title: '  Resto  ', extra: 'ignoré' }, NOW);
    expect(sortie.title).toBe('Resto');
    expect(sortie).not.toHaveProperty('extra');
    expect(sortie).not.toHaveProperty('created_by');
    expect(sortie.is_premium).toBe(false);
  });

  it.each([
    ['titre trop court', { title: 'A' }],
    ['date passée', { date: '2026-10-01T10:00' }],
    ['date invalide', { date: 'demain' }],
    ['prix négatif', { price: -5 }],
    ['zéro place', { max_participants: 0 }],
    ['places non entières', { max_participants: 2.5 }],
    ['lieu vide', { location: '  ' }],
    ['thème manquant', { theme_id: '' }],
  ])('refuse : %s', (_label, change) => {
    const error = errorOf(() => cleanSortie({ ...valid, ...change }, NOW));
    expect(error).toBeInstanceOf(HttpError);
    expect(error.status).toBe(400);
  });

  it('accepte un nombre de places vide (illimité)', () => {
    expect(cleanSortie({ ...valid, max_participants: '' }, NOW).max_participants).toBeNull();
  });
});

describe('images des sorties', () => {
  const endpoint = 'https://appwrite.metanafr.fr/v1';

  it('reconnaît une photo de notre stockage', () => {
    const url = `${endpoint}/storage/buckets/sorties-images/files/abc123/view?project=funny`;
    expect(sortieImageFileId(url, endpoint)).toBe('abc123');
  });

  it("refuse une image d'un autre site ou d'un autre stockage", () => {
    expect(
      sortieImageFileId(
        'https://pirate.example/v1/storage/buckets/sorties-images/files/abc/view',
        endpoint,
      ),
    ).toBeNull();
    expect(
      sortieImageFileId(`${endpoint}/storage/buckets/chat-media/files/abc/view`, endpoint),
    ).toBeNull();
  });

  it('accepte seulement les images de thème du site', () => {
    expect(isSafeDefaultImage('/images/themes/restaurant-1.svg')).toBe(true);
    expect(isSafeDefaultImage('/images/themes/../../secret.svg')).toBe(false);
    expect(isSafeDefaultImage('https://pirate.example/x.png')).toBe(false);
  });
});

describe('places limitées', () => {
  const sortie = { $id: 's1', title: 'Rando', created_by: 'orga', max_participants: 1 };

  it('deux inscriptions simultanées pour la dernière place : la seconde passe en attente', async () => {
    const api = createFakeApi();
    // Les deux membres ont vu une place libre et se sont inscrits en même temps.
    const a = await api.createRow('inscriptions', 'a', {
      sortie_id: 's1',
      user_id: 'alice',
      status: 'pending',
    });
    const b = await api.createRow('inscriptions', 'b', {
      sortie_id: 's1',
      user_id: 'bob',
      status: 'pending',
    });
    const [statusB, statusA] = await Promise.all([
      confirmPlace(api, sortie, b.$id),
      confirmPlace(api, sortie, a.$id),
    ]);
    expect(statusA).toBe('pending');
    expect(statusB).toBe('waiting');
    expect(
      await api.countRows('inscriptions', [
        JSON.stringify({ method: 'equal', attribute: 'status', values: ['pending'] }),
      ]),
    ).toBe(1);
  });

  it('une place libérée profite au premier de la liste d’attente', async () => {
    const api = createFakeApi();
    await api.createRow('inscriptions', 'w1', {
      sortie_id: 's1',
      user_id: 'carole',
      status: 'waiting',
    });
    await api.createRow('inscriptions', 'w2', {
      sortie_id: 's1',
      user_id: 'david',
      status: 'waiting',
    });
    await promoteFromWaitingList(api, sortie);
    expect((await api.getRow('inscriptions', 'w1')).status).toBe('pending');
    expect((await api.getRow('inscriptions', 'w2')).status).toBe('waiting');
    const notes = await api.listAllRows('notifications');
    expect(notes.map((n) => n.user_id)).toEqual(['carole']);
  });

  it('sans limite de places, tout le monde est inscrit', async () => {
    const api = createFakeApi();
    await api.createRow('inscriptions', 'a', { sortie_id: 's1', user_id: 'a', status: 'pending' });
    expect(await confirmPlace(api, { ...sortie, max_participants: null }, 'a')).toBe('pending');
  });
});

describe('suppression d’une sortie', () => {
  it('prévient une seule fois chaque inscrit et likeur, puis efface tout', async () => {
    const api = createFakeApi({
      sorties: [{ $id: 's1', title: 'Ciné', created_by: 'orga' }],
      profiles: [{ $id: 'orga', username: 'Orga' }],
      inscriptions: [
        { $id: 'i0', sortie_id: 's1', user_id: 'orga', status: 'confirmed' },
        { $id: 'i1', sortie_id: 's1', user_id: 'alice', status: 'pending' },
        { $id: 'i2', sortie_id: 's1', user_id: 'bob', status: 'cancelled' },
      ],
      favoris: [
        { $id: 'f1', sortie_id: 's1', user_id: 'alice' },
        { $id: 'f2', sortie_id: 's1', user_id: 'carole' },
      ],
    });
    await deleteSortie(api, await api.getRow('sorties', 's1'));
    const notified = (await api.listAllRows('notifications')).map((n) => n.user_id).sort();
    expect(notified).toEqual(['alice', 'carole']);
    expect(await api.listAllRows('inscriptions')).toHaveLength(0);
    expect(await api.listAllRows('favoris')).toHaveLength(0);
    expect(await api.getRow('sorties', 's1')).toBeNull();
  });
});

describe('aperçu des sorties Premium', () => {
  const premium = {
    $id: 'p1',
    ...valid,
    description: 'Adresse secrète',
    created_by: 'alice',
    is_premium: true,
    image_url: '',
  };

  it("ne garde que le titre, le thème, la date et l'image", () => {
    expect(premiumPreview(premium)).toEqual({
      title: valid.title,
      theme_id: valid.theme_id,
      date: valid.date,
      image_url: null,
    });
  });

  it('est créé pour une sortie Premium seulement, et supprimé avec elle', async () => {
    const api = createFakeApi({ sorties: [premium, { $id: 's2', ...valid, is_premium: false }] });
    await savePremiumPreview(api, premium);
    await savePremiumPreview(api, await api.getRow('sorties', 's2'));
    expect((await api.listAllRows('sorties_apercus')).map((r) => r.$id)).toEqual(['p1']);
    await deleteSortie(api, premium, { notifyMembers: false });
    expect(await api.listAllRows('sorties_apercus')).toHaveLength(0);
  });
});

describe('isPremium', () => {
  it('suit le rôle et la date de fin', () => {
    expect(isPremium({ role: 'admin' })).toBe(true);
    expect(isPremium({ role: 'user', subscription_end_date: '2999-01-01T00:00:00Z' })).toBe(true);
    expect(isPremium({ role: 'user', subscription_end_date: '2000-01-01T00:00:00Z' })).toBe(false);
    expect(isPremium(null)).toBe(false);
  });
});
