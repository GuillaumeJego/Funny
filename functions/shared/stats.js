// Statistiques de connexion pour l'espace d'administration.
// Une « connexion » est notée quand un membre ouvre l'application, au plus une fois
// toutes les 30 minutes : rester sur le site ou recharger la page n'en ajoute pas.
import { Query, fail, uniqueId } from './appwrite.js';

const SESSION_GAP_MS = 30 * 60 * 1000;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const MAX_DAYS = 366;

/** Jour (AAAA-MM-JJ) et heure (0 à 23) à Paris. */
export function parisDayHour(date) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('fr-FR', {
      timeZone: 'Europe/Paris',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(date)
      .map((p) => [p.type, p.value]),
  );
  return { day: `${parts.year}-${parts.month}-${parts.day}`, hour: Number(parts.hour) };
}

export function addDays(day, n) {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Note une connexion, sauf si le membre en a déjà une dans les 30 dernières minutes. */
export async function recordVisit(api, userId, now = new Date()) {
  const last = await api.findRow('connexions', [
    Query.equal('user_id', userId),
    Query.orderDesc('at'),
  ]);
  if (last && now.getTime() - new Date(last.at).getTime() < SESSION_GAP_MS) {
    return { recorded: false };
  }
  const { day, hour } = parisDayHour(now);
  await api.createRow('connexions', uniqueId(), {
    user_id: userId,
    at: now.toISOString(),
    day,
    hour,
  });
  return { recorded: true };
}

/** « secret » regroupe « Ne se prononce pas » et les profils qui n'ont rien indiqué. */
function matchesChoice(value, wanted) {
  if (!wanted) return true;
  if (wanted === 'secret') return !value || value === 'secret';
  return value === wanted;
}

/**
 * Connexions entre deux jours inclus (heure de Paris), filtrées par genre et situation :
 * par jour (total et membres différents), par heure, et le total de la période.
 */
export async function connexionStats(api, input) {
  const from = String(input.from ?? '');
  const to = String(input.to ?? '');
  if (!DAY.test(from) || !DAY.test(to) || from > to) fail(400, 'Période invalide.');
  if (addDays(from, MAX_DAYS) <= to) fail(400, 'Période trop longue : un an au plus.');

  let rows = await api.listAllRows('connexions', [
    Query.greaterThan('day', addDays(from, -1)),
    Query.lessThan('day', addDays(to, 1)),
  ]);

  const gender = input.gender ? String(input.gender) : '';
  const relationship = input.relationship ? String(input.relationship) : '';
  if (gender || relationship) {
    const ids = [...new Set(rows.map((r) => r.user_id))];
    const profiles = new Map();
    for (let i = 0; i < ids.length; i += 100) {
      const page = await api.listAllRows('profiles', [Query.equal('$id', ids.slice(i, i + 100))]);
      for (const p of page) profiles.set(p.$id, p);
    }
    rows = rows.filter((r) => {
      const p = profiles.get(r.user_id);
      return !!p && matchesChoice(p.gender, gender) && matchesChoice(p.relationship, relationship);
    });
  }

  const days = [];
  for (let day = from; day <= to; day = addDays(day, 1)) {
    const ofDay = rows.filter((r) => r.day === day);
    days.push({ day, total: ofDay.length, unique: new Set(ofDay.map((r) => r.user_id)).size });
  }
  const hours = Array.from({ length: 24 }, (_, h) => rows.filter((r) => r.hour === h).length);
  return {
    days,
    hours,
    total: rows.length,
    unique: new Set(rows.map((r) => r.user_id)).size,
  };
}
