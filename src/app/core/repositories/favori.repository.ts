import { RepositoryResult } from './repository.types';

export abstract class FavoriRepository {
  abstract getSortieIds(userId: string): Promise<string[]>;
  abstract getUserIds(sortieId: string): Promise<string[]>;
  abstract add(userId: string, sortieId: string): Promise<RepositoryResult<null>>;
  abstract remove(userId: string, sortieId: string): Promise<RepositoryResult<null>>;
}
