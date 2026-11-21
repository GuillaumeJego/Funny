import { InviteCandidates, Sortie, SortieWithRelations } from '../models/sortie.model';
import { RepositoryResult } from './repository.types';

export abstract class SortieRepository {
  /**
   * Toutes les sorties publiées que le membre peut voir, plus l'aperçu des sorties Premium
   * qu'il ne peut pas lire (marquées `locked`), le tout trié par date.
   */
  abstract getPublished(): Promise<RepositoryResult<SortieWithRelations[]>>;
  abstract getPublishedCreatedBy(userId: string): Promise<RepositoryResult<SortieWithRelations[]>>;
  /** Sorties publiées parmi `ids`, triées par date. Image et nombre d'inscrits déjà calculés. */
  abstract getPublishedByIds(ids: string[]): Promise<SortieWithRelations[]>;
  /** Crée une sortie ; `invites` : membres invités (sortie réservée aux abonnés seulement). */
  abstract create(sortie: Partial<Sortie>, invites?: string[]): Promise<RepositoryResult<Sortie>>;
  /**
   * Modifie une sortie (organisateur ou admin) ; le serveur vérifie tout comme à la création.
   * `invites` : nouveaux membres invités.
   */
  abstract update(
    id: string,
    sortie: Partial<Sortie>,
    invites?: string[],
  ): Promise<RepositoryResult<Sortie>>;
  abstract delete(id: string): Promise<RepositoryResult<null>>;
  /** Amis et personnes rencontrées que l'organisateur peut inviter (sortie pour abonnés). */
  abstract getInviteCandidates(sortieId: string): Promise<RepositoryResult<InviteCandidates>>;
  /** Invite des membres ; le serveur revérifie tout et dit qui a été ignoré. */
  abstract invite(
    sortieId: string,
    userIds: string[],
  ): Promise<RepositoryResult<{ invited: string[]; skipped: string[] }>>;
}
