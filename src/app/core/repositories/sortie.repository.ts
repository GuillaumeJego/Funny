import { Sortie, SortieWithRelations } from '../models/sortie.model';
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
  abstract create(sortie: Partial<Sortie>): Promise<RepositoryResult<Sortie>>;
  /** Modifie une sortie (organisateur ou admin) ; le serveur vérifie tout comme à la création. */
  abstract update(id: string, sortie: Partial<Sortie>): Promise<RepositoryResult<Sortie>>;
  abstract delete(id: string): Promise<RepositoryResult<null>>;
}
