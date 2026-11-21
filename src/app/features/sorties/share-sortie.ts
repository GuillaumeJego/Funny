import { Sortie } from '../../core/models/sortie.model';

/** Lien qui ouvre directement la fiche de la sortie (comme les notifications). */
export function sortieLink(sortieId: string): string {
  return `${location.origin}/dashboard?sortie=${encodeURIComponent(sortieId)}`;
}

/**
 * Partage la sortie avec le partage du téléphone (WhatsApp, SMS…). Sans partage natif, le lien
 * est copié. « cancelled » : le membre a fermé la fenêtre de partage.
 */
export async function shareSortie(
  sortie: Pick<Sortie, 'id' | 'title'>,
): Promise<'shared' | 'copied' | 'cancelled' | 'error'> {
  const url = sortieLink(sortie.id);
  if (navigator.share) {
    try {
      await navigator.share({
        title: sortie.title,
        text: `Rejoins-moi à « ${sortie.title} » sur Funny !`,
        url,
      });
      return 'shared';
    } catch (error) {
      if ((error as DOMException)?.name === 'AbortError') return 'cancelled';
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    return 'copied';
  } catch {
    return 'error';
  }
}
