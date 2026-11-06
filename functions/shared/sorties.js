// Règles partagées par les fonctions « sorties » et « account ».
import { Query, deleteFile, inBatches, notify, usernameOf } from './appwrite.js';

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
  const pending = await api.listAllRows('inscriptions', [
    Query.equal('sortie_id', sortie.$id),
    Query.equal('status', 'pending'),
    Query.orderAsc('$updatedAt'),
    Query.orderAsc('$id'),
  ]);
  const rank = pending.findIndex((row) => row.$id === inscriptionId);
  if (rank === -1 || rank < sortie.max_participants) return 'pending';
  await api.updateRow('inscriptions', inscriptionId, { status: 'waiting' });
  return 'waiting';
}

/** Fait passer le premier de la liste d'attente dans les inscrits, s'il y a de la place. */
export async function promoteFromWaitingList(api, sortie) {
  const taken = await api.countRows('inscriptions', [
    Query.equal('sortie_id', sortie.$id),
    Query.equal('status', 'pending'),
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
    },
  ]);
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
  await api.deleteRow('sorties', sortie.$id);
}
