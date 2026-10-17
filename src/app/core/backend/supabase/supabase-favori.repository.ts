import { Injectable } from '@angular/core';
import { FavoriRepository } from '../../repositories/favori.repository';
import { RepositoryResult } from '../../repositories/repository.types';
import { SupabaseClientService, toResult } from './supabase-client';

@Injectable()
export class SupabaseFavoriRepository extends FavoriRepository {
  constructor(private supabase: SupabaseClientService) {
    super();
  }

  async getSortieIds(userId: string): Promise<string[]> {
    const { data } = await this.supabase.client
      .from('favoris')
      .select('sortie_id')
      .eq('user_id', userId);
    return (data ?? []).map((f: any) => f.sortie_id);
  }

  async getUserIds(sortieId: string): Promise<string[]> {
    const { data } = await this.supabase.client
      .from('favoris')
      .select('user_id')
      .eq('sortie_id', sortieId);
    return (data ?? []).map((f: any) => f.user_id);
  }

  async add(userId: string, sortieId: string): Promise<RepositoryResult<null>> {
    return toResult(
      await this.supabase.client.from('favoris').insert({ user_id: userId, sortie_id: sortieId }),
    );
  }

  async remove(userId: string, sortieId: string): Promise<RepositoryResult<null>> {
    return toResult(
      await this.supabase.client
        .from('favoris')
        .delete()
        .eq('user_id', userId)
        .eq('sortie_id', sortieId),
    );
  }
}
