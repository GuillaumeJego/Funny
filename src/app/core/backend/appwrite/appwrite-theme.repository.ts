import { Injectable } from '@angular/core';
import { ID, Models, Query } from 'appwrite';
import { Theme, ThemeImage } from '../../models/theme.model';
import { RepositoryResult } from '../../repositories/repository.types';
import { ThemeRepository } from '../../repositories/theme.repository';
import { AppwriteClientService, DB, attempt } from './appwrite-client';
import { fromRow } from './rows';

type ThemeImageRow = Models.Row & { theme_id: string; image_url: string; position: number };

@Injectable()
export class AppwriteThemeRepository extends ThemeRepository {
  constructor(private appwrite: AppwriteClientService) {
    super();
  }

  getAll(): Promise<RepositoryResult<Theme[]>> {
    return attempt(async () =>
      (await this.appwrite.listAll('themes', [Query.orderAsc('name')])).map((r) =>
        fromRow<Theme>(r),
      ),
    );
  }

  getImages(themeId: string): Promise<RepositoryResult<ThemeImage[]>> {
    return attempt(async () =>
      (
        await this.appwrite.listAll<ThemeImageRow>('theme_images', [
          Query.equal('theme_id', themeId),
          Query.orderAsc('position'),
        ])
      ).map((r) => fromRow<ThemeImage>(r)),
    );
  }

  create(theme: { name: string; icon: string }): Promise<RepositoryResult<Theme>> {
    return attempt(async () => {
      const row = await this.appwrite.tables.createRow({
        databaseId: DB,
        tableId: 'themes',
        rowId: ID.unique(),
        data: theme,
      });
      return fromRow<Theme>(row);
    });
  }

  update(id: string, theme: { name: string; icon: string }): Promise<RepositoryResult<null>> {
    return attempt(async () => {
      await this.appwrite.tables.updateRow({
        databaseId: DB,
        tableId: 'themes',
        rowId: id,
        data: theme,
      });
      return null;
    });
  }

  delete(id: string): Promise<RepositoryResult<null>> {
    return attempt(async () => {
      const used = await this.appwrite.count('sorties', [Query.equal('theme_id', id)]);
      if (used > 0) {
        throw new Error(
          `Ce thème est utilisé par ${used} sortie${used > 1 ? 's' : ''} : il ne peut pas être supprimé.`,
        );
      }
      const images = await this.appwrite.listAll('theme_images', [Query.equal('theme_id', id)]);
      for (const image of images) {
        await this.appwrite.tables.deleteRow({
          databaseId: DB,
          tableId: 'theme_images',
          rowId: image.$id,
        });
      }
      await this.appwrite.tables.deleteRow({ databaseId: DB, tableId: 'themes', rowId: id });
      return null;
    });
  }

  addImage(themeId: string, imageUrl: string): Promise<RepositoryResult<ThemeImage>> {
    return attempt(async () => {
      const last = await this.appwrite.tables.listRows<ThemeImageRow>({
        databaseId: DB,
        tableId: 'theme_images',
        queries: [Query.equal('theme_id', themeId), Query.orderDesc('position'), Query.limit(1)],
      });
      const row = await this.appwrite.tables.createRow({
        databaseId: DB,
        tableId: 'theme_images',
        rowId: ID.unique(),
        data: {
          theme_id: themeId,
          image_url: imageUrl,
          position: (last.rows[0]?.position ?? 0) + 1,
        },
      });
      return fromRow<ThemeImage>(row);
    });
  }

  removeImage(imageId: string): Promise<RepositoryResult<null>> {
    return attempt(async () => {
      await this.appwrite.tables.deleteRow({
        databaseId: DB,
        tableId: 'theme_images',
        rowId: imageId,
      });
      return null;
    });
  }
}
