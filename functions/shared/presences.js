// Présences après une sortie : l'organisateur indique qui est vraiment venu.
// Par défaut tout le monde est présent ; il décoche les absents puis valide (définitif).
// Tant qu'il n'a pas validé, il reçoit un rappel par jour. Fonction « sorties ».
import { Query, fail, notify } from './appwrite.js';
import { ENDED_AFTER_MS } from './affinites.js';

/** Un rappel par jour (avec un peu de marge : le passage a lieu chaque heure). */
export const REMIND_EVERY_MS = 23 * 3600 * 1000;
/** On arrête de relancer un mois après la sortie. */
export const REMIND_DURING_MS = 30 * 24 * 3600 * 1000;

/** Inscrits et organisateur d'une sortie (lignes d'inscription). */
function participants(api, sortieId) {
  return api.listAllRows('inscriptions', [
    Query.equal('sortie_id', sortieId),
    Query.equal('status', ['pending', 'confirmed']),
  ]);
}

/**
 * Lancé chaque heure : pour chaque sortie finie et dont les présences ne sont pas validées,
 * prévient l'organisateur (au plus une fois par jour). Une sortie sans autre participant
 * que l'organisateur est validée d'office.
 */
export async function sendPresenceReminders(api, now = new Date()) {
  const ended = new Date(now.getTime() - ENDED_AFTER_MS).toISOString();
  const oldest = new Date(now.getTime() - ENDED_AFTER_MS - REMIND_DURING_MS).toISOString();
  const sorties = await api.listAllRows('sorties', [
    Query.equal('status', 'published'),
    Query.lessThan('date', ended),
    Query.greaterThan('date', oldest),
    Query.isNull('presences_validees'),
  ]);
  let reminded = 0;
  for (const sortie of sorties) {
    const last = sortie.presences_rappel ? new Date(sortie.presences_rappel).getTime() : 0;
    if (now.getTime() - last < REMIND_EVERY_MS) continue;
    const others = (await participants(api, sortie.$id)).filter(
      (i) => i.user_id !== sortie.created_by,
    );
    if (others.length === 0) {
      await api.updateRow('sorties', sortie.$id, { presences_validees: now.toISOString() });
      continue;
    }
    // Marquée d'abord : un second passage dans l'heure ne relancera pas.
    await api.updateRow('sorties', sortie.$id, { presences_rappel: now.toISOString() });
    await notify(api, [
      {
        user_id: sortie.created_by,
        title: '📋 Qui était présent ?',
        message: `Confirme les présences à « ${sortie.title} » : tout le monde est coché présent, décoche les absents puis valide.`,
        link: `/sorties/${sortie.$id}/presences`,
      },
    ]);
    reminded += 1;
  }
  return { presences: reminded };
}

/**
 * Validation définitive par l'organisateur : chaque inscrit est présent, sauf ceux de
 * `absentIds`. L'organisateur est toujours présent.
 */
export async function validatePresences(api, { sortie, userId, absentIds, now = new Date() }) {
  if (sortie.created_by !== userId) fail(403, "Seul l'organisateur peut indiquer les présences.");
  if (new Date(sortie.date) > now) fail(400, "La sortie n'a pas encore eu lieu.");
  if (sortie.presences_validees) fail(400, 'Les présences sont déjà validées.');
  const absents = new Set(Array.isArray(absentIds) ? absentIds.map(String) : []);

  const rows = await participants(api, sortie.$id);
  let present = 0;
  for (const row of rows) {
    const isPresent = row.user_id === sortie.created_by || !absents.has(row.user_id);
    if (isPresent) present += 1;
    await api.updateRow('inscriptions', row.$id, { present: isPresent });
  }
  await api.updateRow('sorties', sortie.$id, { presences_validees: now.toISOString() });
  return { present, absent: rows.length - present };
}
