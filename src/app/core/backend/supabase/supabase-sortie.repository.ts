import { Injectable } from '@angular/core';
import { Sortie, SortieWithRelations } from '../../models/sortie.model';
import { SortieRepository } from '../../repositories/sortie.repository';
import { RepositoryResult } from '../../repositories/repository.types';
import { SupabaseClientService, toResult } from './supabase-client';

const WITH_RELATIONS = '*, themes (name, icon), profiles (username, avatar_url)';

@Injectable()
export class SupabaseSortieRepository extends SortieRepository {
  constructor(private supabase: SupabaseClientService) {
    super();
  }

  async getPublished(): Promise<RepositoryResult<SortieWithRelations[]>> {
    return toResult(
      await this.supabase.client
        .from('sorties')
        .select(WITH_RELATIONS)
        .eq('status', 'published')
        .order('date'),
    );
  }

  async getPublishedCreatedBy(userId: string): Promise<RepositoryResult<SortieWithRelations[]>> {
    return toResult(
      await this.supabase.client
        .from('sorties')
        .select(WITH_RELATIONS)
        .eq('created_by', userId)
        .eq('status', 'published')
        .order('date'),
    );
  }

  async getPublishedByIds(ids: string[]): Promise<SortieWithRelations[]> {
    if (ids.length === 0) return [];
    const { data } = await this.supabase.client
      .from('sorties')
      .select(WITH_RELATIONS)
      .in('id', ids)
      .eq('status', 'published')
      .order('date');
    return (data ?? []) as SortieWithRelations[];
  }

  async getFirstThemeImage(themeId: string): Promise<string | null> {
    const { data } = await this.supabase.client
      .from('theme_images')
      .select('image_url')
      .eq('theme_id', themeId)
      .order('position')
      .limit(1)
      .single();
    return data?.image_url ?? null;
  }

  async create(sortie: Partial<Sortie>): Promise<RepositoryResult<Sortie>> {
    return toResult(await this.supabase.client.from('sorties').insert(sortie).select().single());
  }

  async delete(id: string): Promise<RepositoryResult<null>> {
    return toResult(await this.supabase.client.from('sorties').delete().eq('id', id));
  }
}
