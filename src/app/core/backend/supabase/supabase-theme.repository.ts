import { Injectable } from '@angular/core';
import { Theme, ThemeImage } from '../../models/theme.model';
import { RepositoryResult } from '../../repositories/repository.types';
import { ThemeRepository } from '../../repositories/theme.repository';
import { SupabaseClientService, toResult } from './supabase-client';

@Injectable()
export class SupabaseThemeRepository extends ThemeRepository {
  constructor(private supabase: SupabaseClientService) {
    super();
  }

  async getAll(): Promise<RepositoryResult<Theme[]>> {
    return toResult(await this.supabase.client.from('themes').select('*').order('name'));
  }

  async getImages(themeId: string): Promise<RepositoryResult<ThemeImage[]>> {
    return toResult(
      await this.supabase.client
        .from('theme_images')
        .select('*')
        .eq('theme_id', themeId)
        .order('position'),
    );
  }
}
