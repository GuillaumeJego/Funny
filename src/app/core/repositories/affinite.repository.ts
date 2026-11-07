import { RepositoryResult } from './repository.types';

/** Réponses possibles à « avez-vous eu des affinités avec quelqu'un ? ». */
export type AffiniteChoice = 'none' | 'amitie' | 'autre_sortie' | 'coup_de_coeur';

export interface Affinite {
  id: string;
  sortie_id: string;
  from_user: string;
  to_user: string;
  choice: AffiniteChoice;
  created_at: string;
}

/** Les réponses sont enregistrées par le serveur ; chaque membre ne lit que les siennes. */
export abstract class AffiniteRepository {
  /** Mes réponses pour une sortie. */
  abstract getMine(userId: string, sortieId: string): Promise<Affinite[]>;
  /** Dates de mes coups de cœur donnés depuis `since` (du plus ancien au plus récent). */
  abstract getHeartDatesSince(userId: string, since: string): Promise<string[]>;
  abstract answer(
    sortieId: string,
    toUserId: string,
    choice: AffiniteChoice,
  ): Promise<RepositoryResult<{ affinite: Affinite; mutual: boolean }>>;
}
