import { Sortie, SortieWithRelations } from '../models/sortie.model';
import { RepositoryResult } from './repository.types';

export abstract class SortieRepository {
  abstract getPublished(): Promise<RepositoryResult<SortieWithRelations[]>>;
  abstract getPublishedCreatedBy(userId: string): Promise<RepositoryResult<SortieWithRelations[]>>;
  /** Sorties publiées parmi `ids`, triées par date. Image et nombre d'inscrits déjà calculés. */
  abstract getPublishedByIds(ids: string[]): Promise<SortieWithRelations[]>;
  abstract create(sortie: Partial<Sortie>): Promise<RepositoryResult<Sortie>>;
  abstract delete(id: string): Promise<RepositoryResult<null>>;
}
