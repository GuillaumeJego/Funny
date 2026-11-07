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

/** Une page : chemin court, sans identifiant (ex. « /membres/:id »). */
const PAGE = /^\/[a-z0-9:/_-]{0,80}$/;
const MAX_PAGES_PER_CALL = 50;

/**
 * Pages consultées, envoyées par lots par l'application : { "/dashboard": 3, … }.
 * Une ligne par membre, jour et page, avec le nombre de vues.
 */
export async function recordPageViews(api, userId, pages, now = new Date()) {
  const { day } = parisDayHour(now);
  const entries = Object.entries(pages ?? {})
    .filter(([page, n]) => PAGE.test(page) && Number.isInteger(n) && n > 0 && n <= 1000)
    .slice(0, MAX_PAGES_PER_CALL);
  for (const [page, n] of entries) {
    const row = await api.findRow('pages_vues', [
      Query.equal('user_id', userId),
      Query.equal('day', day),
      Query.equal('page', page),
    ]);
    if (row) await api.updateRow('pages_vues', row.$id, { count: row.count + n });
    else await api.createRow('pages_vues', uniqueId(), { user_id: userId, day, page, count: n });
  }
  return { recorded: entries.length };
}

/** Minuit à Paris pour ce jour, en heure UTC (ISO). */
export function parisMidnight(day) {
  for (const offset of [1, 2, 0]) {
    const t = new Date(new Date(`${day}T00:00:00Z`).getTime() - offset * 3600 * 1000);
    const p = parisDayHour(t);
    if (p.day === day && p.hour === 0) return t.toISOString();
  }
  return `${day}T00:00:00.000Z`;
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

  const dayRange = [
    Query.greaterThan('day', addDays(from, -1)),
    Query.lessThan('day', addDays(to, 1)),
  ];
  // Lignes datées par Appwrite : entre minuit (Paris) du premier jour et minuit du lendemain du dernier.
  const createdRange = [
    Query.greaterThan(
      '$createdAt',
      new Date(new Date(parisMidnight(from)).getTime() - 1).toISOString(),
    ),
    Query.lessThan('$createdAt', parisMidnight(addDays(to, 1))),
  ];
  const [visits, pageRows, messages, sorties, inscriptions] = await Promise.all([
    api.listAllRows('connexions', dayRange),
    api.listAllRows('pages_vues', dayRange),
    api.listAllRows('messages', createdRange),
    api.listAllRows('sorties', createdRange),
    api.listAllRows('inscriptions', createdRange),
  ]);

  // L'organisateur est inscrit d'office à sa sortie : ce n'est pas quelqu'un qui « rejoint ».
  const sortieIds = [...new Set(inscriptions.map((i) => i.sortie_id))];
  const organizerOf = new Map();
  for (let i = 0; i < sortieIds.length; i += 100) {
    const page = await api.listAllRows('sorties', [
      Query.equal('$id', sortieIds.slice(i, i + 100)),
    ]);
    for (const s of page) organizerOf.set(s.$id, s.created_by);
  }
  const joins = inscriptions.filter((i) => organizerOf.get(i.sortie_id) !== i.user_id);

  // Population : genre et situation actuels du membre.
  const gender = input.gender ? String(input.gender) : '';
  const relationship = input.relationship ? String(input.relationship) : '';
  let keep = () => true;
  if (gender || relationship) {
    const ids = [
      ...new Set([
        ...visits.map((r) => r.user_id),
        ...pageRows.map((r) => r.user_id),
        ...messages.map((r) => r.sender_id),
        ...sorties.map((r) => r.created_by),
        ...joins.map((r) => r.user_id),
      ]),
    ];
    const profiles = new Map();
    for (let i = 0; i < ids.length; i += 100) {
      const page = await api.listAllRows('profiles', [Query.equal('$id', ids.slice(i, i + 100))]);
      for (const p of page) profiles.set(p.$id, p);
    }
    keep = (userId) => {
      const p = profiles.get(userId);
      return !!p && matchesChoice(p.gender, gender) && matchesChoice(p.relationship, relationship);
    };
  }
  const rows = visits.filter((r) => keep(r.user_id));
  const pagesKept = pageRows.filter((r) => keep(r.user_id));
  const dayOf = (row) => parisDayHour(new Date(row.$createdAt)).day;
  const activity = {
    messages: messages.filter((r) => keep(r.sender_id)).map(dayOf),
    sorties: sorties.filter((r) => keep(r.created_by)).map(dayOf),
    joins: joins.filter((r) => keep(r.user_id)).map(dayOf),
  };
  const countOn = (list, day) => list.filter((d) => d === day).length;

  const days = [];
  for (let day = from; day <= to; day = addDays(day, 1)) {
    const ofDay = rows.filter((r) => r.day === day);
    days.push({
      day,
      total: ofDay.length,
      unique: new Set(ofDay.map((r) => r.user_id)).size,
      pages: pagesKept.filter((r) => r.day === day).reduce((n, r) => n + r.count, 0),
      messages: countOn(activity.messages, day),
      sorties: countOn(activity.sorties, day),
      joins: countOn(activity.joins, day),
    });
  }
  const hours = Array.from({ length: 24 }, (_, h) => rows.filter((r) => r.hour === h).length);
  const byPage = new Map();
  for (const r of pagesKept) byPage.set(r.page, (byPage.get(r.page) ?? 0) + r.count);
  const pages = [...byPage]
    .map(([page, count]) => ({ page, count }))
    .sort((a, b) => b.count - a.count);
  return {
    days,
    hours,
    pages,
    total: rows.length,
    unique: new Set(rows.map((r) => r.user_id)).size,
    pageViews: pagesKept.reduce((n, r) => n + r.count, 0),
    messages: activity.messages.length,
    sorties: activity.sorties.length,
    joins: activity.joins.length,
  };
}
