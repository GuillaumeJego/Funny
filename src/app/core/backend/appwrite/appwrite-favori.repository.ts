import { Injectable } from '@angular/core';
import { Models, Query } from 'appwrite';
import { FavoriRepository } from '../../repositories/favori.repository';
import { RepositoryResult } from '../../repositories/repository.types';
import { AppwriteClientService, DB, attempt } from './appwrite-client';

type FavoriRow = Models.Row & { user_id: string; sortie_id: string };

@Injectable()
export class AppwriteFavoriRepository extends FavoriRepository {
  constructor(private appwrite: AppwriteClientService) {
    super();
  }

  async getSortieIds(userId: string): Promise<string[]> {
    const rows = await this.appwrite.listAll<FavoriRow>('favoris', [
      Query.equal('user_id', userId),
    ]);
    return rows.map((f) => f.sortie_id);
  }

  async getUserIds(sortieId: string): Promise<string[]> {
    const rows = await this.appwrite.listAll<FavoriRow>('favoris', [
      Query.equal('sortie_id', sortieId),
    ]);
    return rows.map((f) => f.user_id);
  }

  /** Passe par le serveur, qui prévient aussi l'organisateur. */
  async add(_userId: string, sortieId: string): Promise<RepositoryResult<null>> {
    const { error } = await this.appwrite.run('sorties', 'like', { sortieId });
    return { data: null, error };
  }

  remove(userId: string, sortieId: string): Promise<RepositoryResult<null>> {
    return attempt(async () => {
      const rows = await this.appwrite.listAll<FavoriRow>('favoris', [
        Query.equal('user_id', userId),
        Query.equal('sortie_id', sortieId),
      ]);
      for (const row of rows) {
        await this.appwrite.tables.deleteRow({
          databaseId: DB,
          tableId: 'favoris',
          rowId: row.$id,
        });
      }
      return null;
    });
  }
}
