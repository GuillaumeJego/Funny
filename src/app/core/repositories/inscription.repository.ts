import { RepositoryError } from './repository.types';

export type InscriptionStatus = 'none' | 'pending' | 'waiting' | 'confirmed';

export abstract class InscriptionRepository {
  abstract getStatus(userId: string, sortieId: string): Promise<InscriptionStatus>;
  /** Participants : inscrits et organisateur (qui occupe une place). */
  abstract countPending(sortieId: string): Promise<number>;
  /** Identifiants des sorties où le membre a ce statut, dans l'ordre d'inscription. */
  abstract getSortieIds(userId: string, status: 'pending' | 'waiting'): Promise<string[]>;
  /**
   * Membres inscrits ou organisateur (`confirmed`) d'une sortie. `present` : réponse de
   * l'organisateur après la sortie (absent tant qu'il n'a pas validé les présences).
   */
  abstract getParticipants(
    sortieId: string,
  ): Promise<{ user_id: string; status: 'pending' | 'confirmed'; present?: boolean | null }[]>;
  /** Sorties auxquelles le membre a participé (inscrit ou organisateur, pas noté absent). */
  abstract getParticipatedSortieIds(userId: string): Promise<string[]>;
  /** Validation définitive des présences par l'organisateur (les autres sont présents). */
  abstract validerPresences(
    sortieId: string,
    absentIds: string[],
  ): Promise<{ error: RepositoryError | null }>;
  /** Membres en liste d'attente, dans l'ordre d'inscription. */
  abstract getWaitingUserIds(sortieId: string): Promise<string[]>;
  /** Inscription par le serveur : renvoie le statut obtenu ('pending' ou 'waiting'). */
  abstract rejoindre(
    userId: string,
    sortieId: string,
  ): Promise<{ error: RepositoryError | null; status: 'pending' | 'waiting' | null }>;
  abstract quitter(userId: string, sortieId: string): Promise<{ error: RepositoryError | null }>;
}
