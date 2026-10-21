import { Injectable } from '@angular/core';
import { Models, Query } from 'appwrite';
import { Sortie, SortieWithRelations } from '../../models/sortie.model';
import { Theme } from '../../models/theme.model';
import { RepositoryResult } from '../../repositories/repository.types';
import { SortieRepository } from '../../repositories/sortie.repository';
import { AppwriteClientService, attempt } from './appwrite-client';
import { fromRow } from './rows';

@Injectable()
export class AppwriteSortieRepository extends SortieRepository {
  constructor(private appwrite: AppwriteClientService) {
    super();
  }

  getPublished(): Promise<RepositoryResult<SortieWithRelations[]>> {
    return attempt(() => this.list([]));
  }

  getPublishedCreatedBy(userId: string): Promise<RepositoryResult<SortieWithRelations[]>> {
    return attempt(() => this.list([Query.equal('created_by', userId)]));
  }

  async getPublishedByIds(ids: string[]): Promise<SortieWithRelations[]> {
    if (ids.length === 0) return [];
    const rows = await this.appwrite.listIn('sorties', '$id', ids, [
      Query.equal('status', 'published'),
      Query.orderAsc('date'),
    ]);
    return this.withRelations(rows);
  }

  async getFirstThemeImage(themeId: string): Promise<string | null> {
    const page = await this.appwrite.tables.listRows<Models.Row & { image_url: string }>({
      databaseId: 'funny',
      tableId: 'theme_images',
      queries: [Query.equal('theme_id', themeId), Query.orderAsc('position'), Query.limit(1)],
    });
    return page.rows[0]?.image_url ?? null;
  }

  async create(sortie: Partial<Sortie>): Promise<RepositoryResult<Sortie>> {
    const { data, error } = await this.appwrite.run<{ sortie: Models.Row }>('sorties', 'create', {
      sortie,
    });
    return { data: data ? fromRow<Sortie>(data.sortie) : null, error };
  }

  async delete(id: string): Promise<RepositoryResult<null>> {
    const { error } = await this.appwrite.run('sorties', 'delete', { sortieId: id });
    return { data: null, error };
  }

  private async list(queries: string[]): Promise<SortieWithRelations[]> {
    const rows = await this.appwrite.listAll('sorties', [
      ...queries,
      Query.equal('status', 'published'),
      Query.orderAsc('date'),
    ]);
    return this.withRelations(rows);
  }

  /** Ajoute le thème et le profil de l'organisateur, en deux requêtes pour toute la liste. */
  private async withRelations(rows: Models.Row[]): Promise<SortieWithRelations[]> {
    const sorties = rows.map((row) => fromRow<Sortie>(row));
    const themeIds = [...new Set(sorties.map((s) => s.theme_id))];
    const [themes, profileById] = await Promise.all([
      themeIds.length ? this.appwrite.listIn('themes', '$id', themeIds) : [],
      this.appwrite.miniProfiles(sorties.map((s) => s.created_by ?? '')),
    ]);
    const themeById = new Map(themes.map((t) => [t.$id, fromRow<Theme>(t)]));
    return sorties.map((s) => {
      const theme = themeById.get(s.theme_id);
      const profile = profileById.get(s.created_by ?? '');
      return {
        ...s,
        themes: theme ? { name: theme.name, icon: theme.icon } : null,
        profiles: profile
          ? { username: profile.username, avatar_url: profile.avatar_url ?? undefined }
          : null,
      };
    });
  }
}
