// Rappel envoyé aux participants la veille d'une sortie. Fonction « sorties », chaque heure.
import { Query, notify } from './appwrite.js';

/** On prévient environ 24 h avant le début. */
export const REMINDER_BEFORE_MS = 24 * 3600 * 1000;

/** « samedi 14 novembre à 19:30 », à l'heure de Paris. */
export function frenchDate(iso) {
  const date = new Date(iso);
  const day = date.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'Europe/Paris',
  });
  const time = date.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Paris',
  });
  return `${day} à ${time}`;
}

/**
 * Pour chaque sortie qui commence dans les prochaines 24 h et dont le rappel n'est pas
 * encore parti : prévient ses participants (inscrits et organisateur) avec l'heure et le lieu.
 */
export async function sendReminders(api, now = new Date()) {
  const sorties = await api.listAllRows('sorties', [
    Query.equal('status', 'published'),
    Query.greaterThan('date', now.toISOString()),
    Query.lessThan('date', new Date(now.getTime() + REMINDER_BEFORE_MS).toISOString()),
    Query.isNull('rappel_envoye'),
  ]);
  let reminded = 0;
  for (const sortie of sorties) {
    // Marquée d'abord : un second passage ne renverra pas le rappel.
    await api.updateRow('sorties', sortie.$id, { rappel_envoye: now.toISOString() });
    const inscriptions = await api.listAllRows('inscriptions', [
      Query.equal('sortie_id', sortie.$id),
      Query.equal('status', ['pending', 'confirmed']),
    ]);
    const ids = [...new Set(inscriptions.map((i) => i.user_id))];
    await notify(
      api,
      ids.map((id) => ({
        user_id: id,
        title: '⏰ C’est bientôt !',
        message: `« ${sortie.title} » : ${frenchDate(sortie.date)}, ${sortie.location}.`,
        link: `/dashboard?sortie=${sortie.$id}`,
      })),
    );
    reminded += ids.length;
  }
  return { reminders: reminded };
}
