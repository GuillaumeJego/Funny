import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase.service';

@Injectable({ providedIn: 'root' })
export class InscriptionService {
  constructor(private supabase: SupabaseService) {}

  async isInscrit(userId: string, sortieId: string): Promise<boolean> {
    const { count } = await this.supabase.client
      .from('inscriptions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('sortie_id', sortieId)
      .neq('status', 'cancelled')
      .neq('status', 'confirmed');
    return (count ?? 0) > 0;
  }

  async rejoindre(userId: string, sortieId: string): Promise<{ error: any }> {
    // Upsert : remet à 'pending' si une inscription annulée existe déjà
    const { error } = await this.supabase.client
      .from('inscriptions')
      .upsert(
        { user_id: userId, sortie_id: sortieId, status: 'pending' },
        { onConflict: 'user_id,sortie_id' }
      );
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
