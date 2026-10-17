import { Theme, ThemeImage } from '../models/theme.model';
import { RepositoryResult } from './repository.types';

export abstract class ThemeRepository {
  abstract getAll(): Promise<RepositoryResult<Theme[]>>;
  abstract getImages(themeId: string): Promise<RepositoryResult<ThemeImage[]>>;
}
