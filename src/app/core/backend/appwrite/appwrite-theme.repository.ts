import { Injectable } from '@angular/core';
import { Query } from 'appwrite';
import { Theme, ThemeImage } from '../../models/theme.model';
import { RepositoryResult } from '../../repositories/repository.types';
import { ThemeRepository } from '../../repositories/theme.repository';
import { AppwriteClientService, attempt } from './appwrite-client';
import { fromRow } from './rows';

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
        await this.appwrite.listAll('theme_images', [
          Query.equal('theme_id', themeId),
          Query.orderAsc('position'),
        ])
      ).map((r) => fromRow<ThemeImage>(r)),
    );
  }
}
