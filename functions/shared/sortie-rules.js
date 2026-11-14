// Règles de validation d'une sortie, sans appel réseau : faciles à tester (functions/tests/).
import { fail } from './appwrite.js';

export const LIMITS = {
  title: [3, 120],
  description: 5000,
  location: [2, 300],
  price: 10000,
  places: [1, 1000],
  themeCustom: [2, 40],
};

/** Thème « Autre » : l'organisateur écrit lui-même le nom du thème et envoie sa photo. */
export const OTHER_THEME = 'autre';
/** Places au maximum pour un organisateur non abonné (illimité pour les abonnés). */
export const FREE_PLACES = 10;

/** Une sortie peut commencer jusqu'à 24 h « dans le passé » : marge pour les fuseaux horaires. */
const DATE_TOLERANCE_MS = 24 * 3600 * 1000;

const isText = (value) => typeof value === 'string';

/**
 * Vérifie et nettoie les champs envoyés par le navigateur. Renvoie un objet prêt à enregistrer,
 * sans thème ni image vérifiés (ceux-là demandent la base : voir checkImage).
 */
export function cleanSortie(input, now = new Date()) {
  const sortie = input ?? {};
  const title = isText(sortie.title) ? sortie.title.trim() : '';
  if (title.length < LIMITS.title[0] || title.length > LIMITS.title[1]) {
    fail(400, `Le titre doit faire entre ${LIMITS.title[0]} et ${LIMITS.title[1]} caractères.`);
  }
  const description = isText(sortie.description) ? sortie.description.trim() : '';
  if (description.length > LIMITS.description) {
    fail(400, `La description est trop longue (${LIMITS.description} caractères au maximum).`);
  }
  const location = isText(sortie.location) ? sortie.location.trim() : '';
  if (location.length < LIMITS.location[0] || location.length > LIMITS.location[1]) {
    fail(400, 'Le lieu est obligatoire.');
  }
  const themeId = isText(sortie.theme_id) ? sortie.theme_id : '';
  if (!themeId) fail(400, 'Le thème est obligatoire.');
  const themeCustom =
    themeId === OTHER_THEME && isText(sortie.theme_custom) ? sortie.theme_custom.trim() : '';
  if (
    themeId === OTHER_THEME &&
    (themeCustom.length < LIMITS.themeCustom[0] || themeCustom.length > LIMITS.themeCustom[1])
  ) {
    fail(
      400,
      `Donne un nom au thème (${LIMITS.themeCustom[0]} à ${LIMITS.themeCustom[1]} caractères).`,
    );
  }

  const date = new Date(sortie.date);
  if (!isText(sortie.date) || Number.isNaN(date.getTime())) fail(400, 'La date est invalide.');
  if (date.getTime() < now.getTime() - DATE_TOLERANCE_MS) fail(400, 'La date est déjà passée.');

  const price = sortie.price === undefined || sortie.price === null ? 0 : Number(sortie.price);
  if (!Number.isFinite(price) || price < 0 || price > LIMITS.price) {
    fail(400, `Le prix doit être compris entre 0 et ${LIMITS.price} €.`);
  }

  let places = null;
  if (
    sortie.max_participants !== undefined &&
    sortie.max_participants !== null &&
    sortie.max_participants !== ''
  ) {
    places = Number(sortie.max_participants);
    if (!Number.isInteger(places) || places < LIMITS.places[0] || places > LIMITS.places[1]) {
      fail(
        400,
        `Le nombre de places doit être un entier entre ${LIMITS.places[0]} et ${LIMITS.places[1]}.`,
      );
    }
  }

  // Position du lieu : gardée seulement si elle est plausible, sinon laissée vide.
  const lat = Number(sortie.lat);
  const lng = Number(sortie.lng);
  const hasPosition =
    sortie.lat != null &&
    sortie.lng != null &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180;

  const imageSource = sortie.image_source === 'custom' ? 'custom' : 'default';
  const imageUrl = isText(sortie.image_url) ? sortie.image_url.trim() : '';
  if (themeId === OTHER_THEME && (imageSource !== 'custom' || !imageUrl)) {
    fail(400, 'Avec le thème « Autre », ta photo est obligatoire.');
  }

  return {
    title,
    description,
    theme_id: themeId,
    theme_custom: themeCustom || null,
    date: sortie.date,
    location,
    price: Math.round(price * 100) / 100,
    max_participants: places,
    is_premium: sortie.is_premium === true,
    image_url: imageUrl,
    image_source: imageSource,
    lat: hasPosition ? lat : null,
    lng: hasPosition ? lng : null,
  };
}

/**
 * Un organisateur non abonné a 10 places au plus. Le statut compte au moment de la création :
 * en modifiant sa sortie, il garde les places qu'il avait (il ne peut pas en ajouter au-delà de 10).
 * `previous` : places de la sortie avant modification (null = illimité), absent à la création.
 */
export function checkPlaces({ places, previous, subscriber }) {
  if (subscriber) return;
  if (places != null && places <= FREE_PLACES) return;
  if (previous !== undefined) {
    if (previous === null) return;
    if (places != null && places <= previous) return;
  }
  fail(403, `${FREE_PLACES} places au maximum : passe Premium pour plus de places.`);
}

/**
 * Identifiant du fichier si `url` est bien l'adresse d'une image du stockage « sorties-images »
 * de ce serveur Appwrite (et pas d'un autre site), sinon null.
 */
export function sortieImageFileId(url, endpoint) {
  let parsed;
  let server;
  try {
    parsed = new URL(url);
    server = new URL(endpoint);
  } catch {
    return null;
  }
  if (parsed.hostname !== server.hostname) return null;
  const match = parsed.pathname.match(
    /\/storage\/buckets\/sorties-images\/files\/([A-Za-z0-9._-]{1,36})\/view$/,
  );
  return match?.[1] ?? null;
}

/** Image par défaut : une adresse du site (/images/themes/…) ou du stockage, sans « .. ». */
export function isSafeDefaultImage(url) {
  return /^\/images\/themes\/[a-z0-9-]+\.(svg|webp|png|jpe?g)$/.test(url);
}
