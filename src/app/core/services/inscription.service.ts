import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase.service';

@Injectable({ providedIn: 'root' })
export class InscriptionService {
  constructor(private supabase: SupabaseService) {}

  async isInscrit(userId: string, sortieId: string): Promise<boolean> {
    const { data } = await this.supabase.client
      .from('inscriptions')
      .select('id')
      .eq('user_id', userId)
      .eq('sortie_id', sortieId)
      .neq('status', 'cancelled')
      .maybeSingle();
    return !!data;
  }

  async rejoindre(userId: string, sortieId: string): Promise<{ error: any }> {
    const { error } = await this.supabase.client
      .from('inscriptions')
      .insert({ user_id: userId, sortie_id: sortieId });
    return { error };
  }

  async quitter(userId: string, sortieId: string): Promise<{ error: any }> {
    const { error } = await this.supabase.client
      .from('inscriptions')
      .delete()
      .eq('user_id', userId)
      .eq('sortie_id', sortieId);
    return { error };
  }
}
