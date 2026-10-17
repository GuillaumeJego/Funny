import { RepositoryError } from './repository.types';

export type InscriptionStatus = 'none' | 'pending' | 'waiting' | 'confirmed';

export abstract class InscriptionRepository {
  abstract getStatus(userId: string, sortieId: string): Promise<InscriptionStatus>;
  abstract countPending(sortieId: string): Promise<number>;
  /** Identifiants des sorties où le membre a ce statut, dans l'ordre d'inscription. */
  abstract getSortieIds(userId: string, status: 'pending' | 'waiting'): Promise<string[]>;
  /** Membres inscrits ou organisateur (`confirmed`) d'une sortie. */
  abstract getParticipants(
    sortieId: string,
  ): Promise<{ user_id: string; status: 'pending' | 'confirmed' }[]>;
  /** Membres en liste d'attente, dans l'ordre d'inscription. */
  abstract getWaitingUserIds(sortieId: string): Promise<string[]>;
  abstract inscrireOrganisateur(sortieId: string, userId: string): Promise<void>;
  /** Inscription atomique : renvoie le statut obtenu ('pending' ou 'waiting'). */
  abstract rejoindre(
    userId: string,
    sortieId: string,
  ): Promise<{ error: RepositoryError | null; status: 'pending' | 'waiting' | null }>;
  abstract quitter(userId: string, sortieId: string): Promise<{ error: RepositoryError | null }>;
}
