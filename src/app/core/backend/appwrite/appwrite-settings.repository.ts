import { Injectable } from '@angular/core';
import { Models } from 'appwrite';
import { RepositoryError } from '../../repositories/repository.types';
import { SettingsRepository } from '../../repositories/settings.repository';
import { AppwriteClientService, DB, toError } from './appwrite-client';

/** Réglages : une ligne par clé, la valeur est enregistrée en JSON. */
@Injectable()
export class AppwriteSettingsRepository extends SettingsRepository {
  constructor(private appwrite: AppwriteClientService) {
    super();
  }

  async get(key: string): Promise<any> {
    const row = await this.appwrite.getRowOrNull<Models.Row & { value: string }>(
      'app_settings',
      key,
    );
    return row ? JSON.parse(row.value) : undefined;
  }

  async set(key: string, value: any): Promise<{ error: RepositoryError | null }> {
    try {
      await this.appwrite.tables.upsertRow({
        databaseId: DB,
        tableId: 'app_settings',
        rowId: key,
        data: { value: JSON.stringify(value) },
      });
      return { error: null };
    } catch (error) {
      return { error: toError(error) };
    }
  }
}
