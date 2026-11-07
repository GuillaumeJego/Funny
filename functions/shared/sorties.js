// Règles partagées par les fonctions « sorties » et « account ».
import { Query, deleteFile, inBatches, notify, usernameOf } from './appwrite.js';
import { deleteSortieChat, syncSortieChat } from './conversations.js';

/**
 * Vérifie, après coup, qu'une inscription « pending » tient dans le nombre de places.
 * Appwrite n'a pas de verrou : deux membres qui rejoignent en même temps peuvent tous les
 * deux voir une place libre. On classe donc les inscrits par date de passage en « pending »
 * ($updatedAt, puis $id pour départager) : celui qui dépasse la limite repasse en liste
 * d'attente. Chaque appel voit le même classement, donc un seul des deux recule.
 * Renvoie le statut final : 'pending' ou 'waiting'.
 */
export async function confirmPlace(api, sortie, inscriptionId) {
  if (sortie.max_participants == null) return 'pending';
  // L'organisateur (« confirmed ») occupe une des places.
  const organizers = await api.countRows('inscriptions', [
    Query.equal('sortie_id', sortie.$id),
    Query.equal('status', 'confirmed'),
  ]);
  const pending = await api.listAllRows('inscriptions', [
    Query.equal('sortie_id', sortie.$id),
    Query.equal('status', 'pending'),
    Query.orderAsc('$updatedAt'),
    Query.orderAsc('$id'),
  ]);
  const rank = pending.findIndex((row) => row.$id === inscriptionId);
  if (rank === -1 || rank < sortie.max_participants - organizers) return 'pending';
  await api.updateRow('inscriptions', inscriptionId, { status: 'waiting' });
  return 'waiting';
}

/** Fait passer le premier de la liste d'attente dans les inscrits, s'il y a de la place. */
export async function promoteFromWaitingList(api, sortie) {
  // Places prises : inscrits et organisateur.
  const taken = await api.countRows('inscriptions', [
    Query.equal('sortie_id', sortie.$id),
    Query.equal('status', ['pending', 'confirmed']),
  ]);
  if (sortie.max_participants != null && taken >= sortie.max_participants) return;
  // Ordre de la liste d'attente : date de passage en « waiting ».
  const next = await api.findRow('inscriptions', [
    Query.equal('sortie_id', sortie.$id),
    Query.equal('status', 'waiting'),
    Query.orderAsc('$updatedAt'),
    Query.orderAsc('$id'),
  ]);
  if (!next) return;
  await api.updateRow('inscriptions', next.$id, { status: 'pending' });
  if ((await confirmPlace(api, sortie, next.$id)) !== 'pending') return;
  await notify(api, [
    {
      user_id: next.user_id,
      title: '🎉 Une place s’est libérée',
      message: `Vous êtes maintenant inscrit à la sortie « ${sortie.title} »`,
      link: `/dashboard?sortie=${sortie.$id}`,
    },
  ]);
  // Il rejoint aussi la discussion de groupe de la sortie.
  await syncSortieChat(api, sortie);
}

/**
 * Aperçu d'une sortie Premium, lisible par tous les membres : de quoi afficher une carte
 * floutée qui donne envie de s'abonner, sans le lieu, le prix, la description ni l'organisateur.
 */
export function premiumPreview(sortie) {
  return {
    title: sortie.title,
    theme_id: sortie.theme_id,
    date: sortie.date,
    image_url: sortie.image_url || null,
  };
}

/**
 * Tient l'aperçu à jour : créé ou mis à jour pour une sortie Premium, supprimé pour une
 * sortie ouverte à tous (par exemple quand l'organisateur retire la case Premium).
 */
export async function syncPremiumPreview(api, sortie) {
  if (!sortie.is_premium) {
    await api.deleteRow('sorties_apercus', sortie.$id);
    return;
  }
  const preview = premiumPreview(sortie);
  if (await api.getRow('sorties_apercus', sortie.$id)) {
    await api.updateRow('sorties_apercus', sortie.$id, preview);
  } else {
    await api.createRow('sorties_apercus', sortie.$id, preview);
  }
}

/** Supprime une sortie et tout ce qui la concerne, en prévenant inscrits et likeurs. */
export async function deleteSortie(api, sortie, { notifyMembers = true } = {}) {
  const [inscriptions, favoris] = await Promise.all([
    api.listAllRows('inscriptions', [Query.equal('sortie_id', sortie.$id)]),
    api.listAllRows('favoris', [Query.equal('sortie_id', sortie.$id)]),
  ]);
  if (notifyMembers) {
    const organizer = await usernameOf(api, sortie.created_by);
    const seen = new Set([sortie.created_by]);
    const notifications = [];
    for (const i of inscriptions.filter((i) => i.status === 'pending' || i.status === 'waiting')) {
      if (seen.has(i.user_id)) continue;
      seen.add(i.user_id);
      notifications.push({
        user_id: i.user_id,
        title: 'Sortie annulée',
        message: `Vous étiez inscrit à la sortie « ${sortie.title} ». L'organisateur ${organizer} l'a annulée.`,
      });
    }
    for (const f of favoris) {
      if (seen.has(f.user_id)) continue;
      seen.add(f.user_id);
      notifications.push({
        user_id: f.user_id,
        title: 'Sortie annulée',
        message: `Vous aviez aimé la sortie « ${sortie.title} ». L'organisateur ${organizer} l'a annulée.`,
      });
    }
    await notify(api, notifications);
  }
  await inBatches(inscriptions, (row) => api.deleteRow('inscriptions', row.$id));
  await inBatches(favoris, (row) => api.deleteRow('favoris', row.$id));
  if (sortie.image_source === 'custom' && sortie.image_url) {
    await deleteFile(api, 'sorties-images', sortie.image_url);
  }
  await deleteSortieChat(api, sortie.$id);
  await api.deleteRow('sorties_apercus', sortie.$id);
  await api.deleteRow('sorties', sortie.$id);
}
