// Règles partagées par les fonctions « sorties » et « account ».
import { Query, deleteFile, notify, usernameOf } from './appwrite.js';

/** Fait passer le premier de la liste d'attente dans les inscrits, s'il y a de la place. */
export async function promoteFromWaitingList(api, sortie) {
  const taken = await api.countRows('inscriptions', [
    Query.equal('sortie_id', sortie.$id),
    Query.equal('status', 'pending'),
  ]);
  if (sortie.max_participants != null && taken >= sortie.max_participants) return;
  const next = await api.findRow('inscriptions', [
    Query.equal('sortie_id', sortie.$id),
    Query.equal('status', 'waiting'),
    Query.orderAsc('$createdAt'),
  ]);
  if (!next) return;
  await api.updateRow('inscriptions', next.$id, { status: 'pending' });
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
  for (const row of inscriptions) await api.deleteRow('inscriptions', row.$id);
  for (const row of favoris) await api.deleteRow('favoris', row.$id);
  if (sortie.image_source === 'custom' && sortie.image_url) {
    await deleteFile(api, 'sorties-images', sortie.image_url);
  }
  await api.deleteRow('sorties', sortie.$id);
}
