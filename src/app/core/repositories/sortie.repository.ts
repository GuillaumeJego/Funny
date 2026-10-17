import { Sortie, SortieWithRelations } from '../models/sortie.model';
import { RepositoryResult } from './repository.types';

export abstract class SortieRepository {
  abstract getPublished(): Promise<RepositoryResult<SortieWithRelations[]>>;
  abstract getPublishedCreatedBy(userId: string): Promise<RepositoryResult<SortieWithRelations[]>>;
  /** Sorties publiées parmi `ids`, triées par date. */
  abstract getPublishedByIds(ids: string[]): Promise<SortieWithRelations[]>;
  abstract getFirstThemeImage(themeId: string): Promise<string | null>;
  abstract create(sortie: Partial<Sortie>): Promise<RepositoryResult<Sortie>>;
  abstract delete(id: string): Promise<RepositoryResult<null>>;
}
