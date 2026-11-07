// Affinités après une sortie : la question envoyée aux participants, leurs réponses,
// et la notification quand un choix est réciproque. Fonction « sorties ».
import { Permission, Query, Role, fail, notify, uniqueId, usernameOf } from './appwrite.js';

/** Les choix possibles ; « coup_de_coeur » est réservé aux célibataires en recherche. */
export const CHOICES = ['none', 'amitie', 'autre_sortie', 'coup_de_coeur'];
export const HEART = 'coup_de_coeur';
/** Valeur de « Situation » qui donne droit au coup de cœur. */
export const LOOKING = 'Célibataire en recherche';

/** Une sortie est « finie » quelques heures après son début (elle n'a pas d'heure de fin). */
export const ENDED_AFTER_MS = 4 * 3600 * 1000;
/** Les participants ont 24 h pour répondre. */
export const ANSWER_WINDOW_MS = 24 * 3600 * 1000;
/** Au premier passage, on ne rattrape pas les sorties plus anciennes que ça. */
const CATCH_UP_MS = 48 * 3600 * 1000;

/**
 * Un choix réciproque (coup de cœur, amitié ou autre sortie) rend les deux membres amis.
 * Rien ne change si l'un a bloqué l'autre. Renvoie true si l'amitié est en place.
 */
export async function makeFriends(api, a, b) {
  const blocked = await api.findRow('blocks', [
    Query.or([
      Query.and([Query.equal('blocker_id', a), Query.equal('blocked_id', b)]),
      Query.and([Query.equal('blocker_id', b), Query.equal('blocked_id', a)]),
    ]),
  ]);
  if (blocked) return false;
  const existing = await api.findRow('friendships', [
    Query.or([
      Query.and([Query.equal('requester_id', a), Query.equal('receiver_id', b)]),
      Query.and([Query.equal('requester_id', b), Query.equal('receiver_id', a)]),
    ]),
  ]);
  if (existing?.status === 'accepted') return true;
  // Demande en attente ou refusée : remplacée par une amitié acceptée.
  if (existing) await api.deleteRow('friendships', existing.$id);
  await api.createRow(
    'friendships',
    uniqueId(),
    { requester_id: a, receiver_id: b, status: 'accepted' },
    [a, b].map((id) => Permission.read(Role.user(id))),
  );
  return true;
}

const MUTUAL = {
  coup_de_coeur: { title: '💘 Coup de cœur réciproque', what: 'un coup de cœur réciproque' },
  amitie: { title: '🤝 Amitié réciproque', what: 'une amitié réciproque' },
  autre_sortie: {
    title: '🎉 Partants pour une autre sortie',
    what: "l'envie réciproque de ressortir ensemble",
  },
};

/** Réglages de l'admin : nombre de coups de cœur permis par période (en jours). */
export async function heartRules(api) {
  const read = async (key, fallback) => {
    const row = await api.getRow('app_settings', key);
    const value = row ? Number(JSON.parse(row.value)) : NaN;
    return Number.isFinite(value) && value > 0 ? value : fallback;
  };
  return {
    limit: await read('coeurs_par_periode', 1),
    days: await read('coeurs_periode_jours', 30),
  };
}

/** Participants d'une sortie (l'organisateur est inscrit à la création). */
async function participantIds(api, sortieId) {
  const rows = await api.listAllRows('inscriptions', [
    Query.equal('sortie_id', sortieId),
    Query.equal('status', ['pending', 'confirmed']),
  ]);
  return [...new Set(rows.map((r) => r.user_id))];
}

/**
 * Lancé chaque heure : pour chaque sortie finie depuis peu, pose la question
 * « avez-vous eu des affinités avec quelqu'un ? » à ses participants (s'ils sont au moins deux).
 */
export async function sendAffinityQuestions(api, now = new Date()) {
  const ended = new Date(now.getTime() - ENDED_AFTER_MS).toISOString();
  const oldest = new Date(now.getTime() - ENDED_AFTER_MS - CATCH_UP_MS).toISOString();
  const sorties = await api.listAllRows('sorties', [
    Query.equal('status', 'published'),
    Query.lessThan('date', ended),
    Query.greaterThan('date', oldest),
    Query.isNull('affinites_jusqua'),
  ]);
  let asked = 0;
  for (const sortie of sorties) {
    const until = new Date(now.getTime() + ANSWER_WINDOW_MS).toISOString();
    // Marquée d'abord : un second passage ne renverra pas la question.
    await api.updateRow('sorties', sortie.$id, { affinites_jusqua: until });
    const ids = await participantIds(api, sortie.$id);
    if (ids.length < 2) continue;
    await notify(
      api,
      ids.map((id) => ({
        user_id: id,
        title: '✨ Alors, cette sortie ?',
        message: `Avez-vous eu des affinités avec quelqu'un à « ${sortie.title} » ? Vous avez 24 h pour répondre.`,
        link: `/sorties/${sortie.$id}/affinites`,
      })),
    );
    asked += ids.length;
  }
  return { sorties: sorties.length, asked };
}

/** Prochaine date à laquelle le membre pourra donner un coup de cœur (null s'il le peut déjà). */
export async function nextHeartDate(api, userId, now = new Date()) {
  const { limit, days } = await heartRules(api);
  const since = new Date(now.getTime() - days * 86400000).toISOString();
  const recent = await api.listAllRows('affinites', [
    Query.equal('from_user', userId),
    Query.equal('choice', HEART),
    Query.greaterThan('$createdAt', since),
    Query.orderAsc('$createdAt'),
  ]);
  if (recent.length < limit) return null;
  // Le plus ancien des coups de cœur comptés « expire » en premier.
  const oldest = new Date(recent[recent.length - limit].$createdAt);
  return new Date(oldest.getTime() + days * 86400000);
}

/**
 * Enregistre la réponse d'un participant à propos d'un autre. Une seule réponse par personne,
 * définitive. Si l'autre a fait le même choix, les deux sont prévenus.
 */
export async function recordAffinity(api, { sortie, fromId, toId, choice, now = new Date() }) {
  if (!CHOICES.includes(choice)) fail(400, 'Choix inconnu.');
  if (fromId === toId) fail(400, 'Choisis un autre participant.');
  if (!sortie.affinites_jusqua)
    fail(400, "La question n'est pas encore ouverte pour cette sortie.");
  if (now > new Date(sortie.affinites_jusqua))
    fail(400, 'Le délai de 24 h pour répondre est passé.');

  const ids = await participantIds(api, sortie.$id);
  if (!ids.includes(fromId)) fail(403, "Tu n'as pas participé à cette sortie.");
  if (!ids.includes(toId)) fail(400, "Ce membre n'a pas participé à cette sortie.");

  const existing = await api.findRow('affinites', [
    Query.equal('sortie_id', sortie.$id),
    Query.equal('from_user', fromId),
    Query.equal('to_user', toId),
  ]);
  if (existing) fail(400, 'Tu as déjà répondu pour ce membre.');

  if (choice === HEART) {
    const profile = await api.getRow('profiles', fromId);
    if (profile?.relationship !== LOOKING) {
      fail(403, 'Le coup de cœur est réservé aux célibataires en recherche.');
    }
    const next = await nextHeartDate(api, fromId, now);
    if (next) {
      fail(
        400,
        `Tu as déjà utilisé ton coup de cœur. Prochain possible le ${next.toLocaleDateString('fr-FR')}.`,
      );
    }
  }

  const row = await api.createRow(
    'affinites',
    uniqueId(),
    { sortie_id: sortie.$id, from_user: fromId, to_user: toId, choice },
    [Permission.read(Role.user(fromId))],
  );

  let mutual = false;
  if (choice !== 'none') {
    const back = await api.findRow('affinites', [
      Query.equal('sortie_id', sortie.$id),
      Query.equal('from_user', toId),
      Query.equal('to_user', fromId),
      Query.equal('choice', choice),
    ]);
    if (back) {
      mutual = true;
      const { title, what } = MUTUAL[choice];
      const [fromName, toName, friends] = await Promise.all([
        usernameOf(api, fromId),
        usernameOf(api, toId),
        makeFriends(api, fromId, toId),
      ]);
      const end = friends ? ' Vous êtes maintenant amis 🤝' : '';
      await notify(api, [
        {
          user_id: fromId,
          actor_id: toId,
          title,
          message: `Avec ${toName}, après « ${sortie.title} » : c'est ${what} !${end}`,
          link: `/membres/${toId}`,
        },
        {
          user_id: toId,
          actor_id: fromId,
          title,
          message: `Avec ${fromName}, après « ${sortie.title} » : c'est ${what} !${end}`,
          link: `/membres/${fromId}`,
        },
      ]);
    }
  }
  return { affinite: row, mutual };
}
