import { Theme, ThemeImage } from '../models/theme.model';
import { RepositoryResult } from './repository.types';

export abstract class ThemeRepository {
  abstract getAll(): Promise<RepositoryResult<Theme[]>>;
  abstract getImages(themeId: string): Promise<RepositoryResult<ThemeImage[]>>;

  // Réservé aux admins : les droits des tables refusent ces écritures aux autres membres.
  abstract create(theme: { name: string; icon: string }): Promise<RepositoryResult<Theme>>;
  abstract update(
    id: string,
    theme: { name: string; icon: string },
  ): Promise<RepositoryResult<null>>;
  /** Supprime le thème et ses images. Refusé tant qu'une sortie l'utilise. */
  abstract delete(id: string): Promise<RepositoryResult<null>>;
  abstract addImage(themeId: string, imageUrl: string): Promise<RepositoryResult<ThemeImage>>;
  abstract removeImage(imageId: string): Promise<RepositoryResult<null>>;
}
