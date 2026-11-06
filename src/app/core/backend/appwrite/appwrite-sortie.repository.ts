import { Injectable, inject } from '@angular/core';
import { Models, Query } from 'appwrite';
import { Sortie, SortieWithRelations } from '../../models/sortie.model';
import { Theme } from '../../models/theme.model';
import { RepositoryResult } from '../../repositories/repository.types';
import { SortieRepository } from '../../repositories/sortie.repository';
import { AppwriteClientService, attempt } from './appwrite-client';
import { fromRow } from './rows';

@Injectable()
export class AppwriteSortieRepository extends SortieRepository {
  private appwrite = inject(AppwriteClientService);

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

  /**
   * Ajoute le thème, son image par défaut, l'organisateur et le nombre d'inscrits :
   * quatre requêtes pour toute la liste, quel que soit le nombre de sorties.
   */
  private async withRelations(rows: Models.Row[]): Promise<SortieWithRelations[]> {
    const sorties = rows.map((row) => fromRow<Sortie>(row));
    const themeIds = [...new Set(sorties.map((s) => s.theme_id))].filter(Boolean);
    const [themes, images, profileById, pending] = await Promise.all([
      themeIds.length ? this.appwrite.listIn('themes', '$id', themeIds) : [],
      themeIds.length
        ? this.appwrite.listIn<Models.Row & { theme_id: string; image_url: string }>(
            'theme_images',
            'theme_id',
            themeIds,
            [Query.orderAsc('position')],
          )
        : [],
      this.appwrite.miniProfiles(sorties.map((s) => s.created_by ?? '')),
      sorties.length
        ? this.appwrite.listIn<Models.Row & { sortie_id: string }>(
            'inscriptions',
            'sortie_id',
            sorties.map((s) => s.id),
            [Query.equal('status', 'pending'), Query.select(['$id', 'sortie_id'])],
          )
        : [],
    ]);
    const themeById = new Map(themes.map((t) => [t.$id, fromRow<Theme>(t)]));
    const firstImage = new Map<string, string>();
    for (const image of images) {
      if (!firstImage.has(image.theme_id)) firstImage.set(image.theme_id, image.image_url);
    }
    const countById = new Map<string, number>();
    for (const row of pending)
      countById.set(row.sortie_id, (countById.get(row.sortie_id) ?? 0) + 1);

    return sorties.map((s) => {
      const theme = themeById.get(s.theme_id);
      const profile = profileById.get(s.created_by ?? '');
      return {
        ...s,
        themes: theme ? { name: theme.name, icon: theme.icon } : null,
        profiles: profile
          ? { username: profile.username, avatar_url: profile.avatar_url ?? undefined }
          : null,
        // Sans image choisie, la première image du thème sert d'illustration.
        resolvedImageUrl: s.image_url || firstImage.get(s.theme_id) || undefined,
        inscriptionsCount: countById.get(s.id) ?? 0,
      };
    });
  }
}
