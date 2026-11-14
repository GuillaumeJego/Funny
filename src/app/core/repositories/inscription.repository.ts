import { RepositoryError } from './repository.types';

/** invited : invité par l'organisateur, place gardée en attendant sa réponse. */
export type InscriptionStatus = 'none' | 'pending' | 'waiting' | 'confirmed' | 'invited';

export abstract class InscriptionRepository {
  abstract getStatus(userId: string, sortieId: string): Promise<InscriptionStatus>;
  /** Places prises : inscrits, organisateur et invités qui n'ont pas encore répondu. */
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
  /** Membres invités qui n'ont pas encore répondu. */
  abstract getInvitedUserIds(sortieId: string): Promise<string[]>;
  /** Membres en liste d'attente, dans l'ordre d'inscription. */
  abstract getWaitingUserIds(sortieId: string): Promise<string[]>;
  /**
   * Inscription par le serveur : renvoie le statut obtenu ('pending' ou 'waiting').
   * Pour un invité, c'est accepter l'invitation ; `quitter` la refuse.
   */
  abstract rejoindre(
    userId: string,
    sortieId: string,
  ): Promise<{ error: RepositoryError | null; status: 'pending' | 'waiting' | null }>;
  abstract quitter(userId: string, sortieId: string): Promise<{ error: RepositoryError | null }>;
}
