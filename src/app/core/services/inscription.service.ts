import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase.service';

export type InscriptionStatus = 'none' | 'pending' | 'waiting' | 'confirmed';

@Injectable({ providedIn: 'root' })
export class InscriptionService {
  constructor(private supabase: SupabaseService) {}

  async getInscriptionStatus(userId: string, sortieId: string): Promise<InscriptionStatus> {
    const { data } = await this.supabase.client
      .from('inscriptions')
      .select('status')
      .eq('user_id', userId)
      .eq('sortie_id', sortieId)
      .neq('status', 'cancelled')
      .maybeSingle();
    if (!data) return 'none';
    return data.status as InscriptionStatus;
  }

  // Retourne le status obtenu ('pending' ou 'waiting') — atomique côté DB
  async rejoindre(userId: string, sortieId: string): Promise<{ error: any; status: 'pending' | 'waiting' | null }> {
    const { data, error } = await this.supabase.client
      .rpc('rejoindre_sortie', { p_user_id: userId, p_sortie_id: sortieId });
    return { error, status: error ? null : (data as 'pending' | 'waiting') };
  }

  async quitter(userId: string, sortieId: string): Promise<{ error: any }> {
    const { error } = await this.supabase.client
      .rpc('quitter_sortie', { p_user_id: userId, p_sortie_id: sortieId });
    return { error };
  }
}
