import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase.service';

@Injectable({ providedIn: 'root' })
export class FavoriService {

  constructor(private supabase: SupabaseService) {}

  async getFavoris(userId: string): Promise<string[]> {
    const { data } = await this.supabase.client
      .from('favoris')
      .select('sortie_id')
      .eq('user_id', userId);
    return (data ?? []).map((f: any) => f.sortie_id);
  }

  async addFavori(userId: string, sortieId: string) {
    return await this.supabase.client
      .from('favoris')
      .insert({ user_id: userId, sortie_id: sortieId });
  }

  async removeFavori(userId: string, sortieId: string) {
    return await this.supabase.client
      .from('favoris')
      .delete()
      .eq('user_id', userId)
      .eq('sortie_id', sortieId);
  }
}
