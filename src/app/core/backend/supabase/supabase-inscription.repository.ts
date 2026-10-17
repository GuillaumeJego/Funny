import { Injectable } from '@angular/core';
import {
  InscriptionRepository,
  InscriptionStatus,
} from '../../repositories/inscription.repository';
import { RepositoryError } from '../../repositories/repository.types';
import { SupabaseClientService, toError } from './supabase-client';

@Injectable()
export class SupabaseInscriptionRepository extends InscriptionRepository {
  constructor(private supabase: SupabaseClientService) {
    super();
  }

  async getStatus(userId: string, sortieId: string): Promise<InscriptionStatus> {
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

  async countPending(sortieId: string): Promise<number> {
    const { count } = await this.supabase.client
      .from('inscriptions')
      .select('*', { count: 'exact', head: true })
      .eq('sortie_id', sortieId)
      .eq('status', 'pending');
    return count ?? 0;
  }

  async getSortieIds(userId: string, status: 'pending' | 'waiting'): Promise<string[]> {
    const { data } = await this.supabase.client
      .from('inscriptions')
      .select('sortie_id')
      .eq('user_id', userId)
      .eq('status', status)
      .order('created_at', { ascending: true });
    return (data ?? []).map((r: any) => r.sortie_id);
  }

  async getParticipants(
    sortieId: string,
  ): Promise<{ user_id: string; status: 'pending' | 'confirmed' }[]> {
    const { data } = await this.supabase.client
      .from('inscriptions')
      .select('user_id, status')
      .eq('sortie_id', sortieId)
      .in('status', ['pending', 'confirmed']);
    return (data ?? []) as { user_id: string; status: 'pending' | 'confirmed' }[];
  }

  async getWaitingUserIds(sortieId: string): Promise<string[]> {
    const { data } = await this.supabase.client
      .from('inscriptions')
      .select('user_id')
      .eq('sortie_id', sortieId)
      .eq('status', 'waiting')
      .order('created_at', { ascending: true });
    return (data ?? []).map((r: any) => r.user_id);
  }

  async inscrireOrganisateur(sortieId: string, userId: string): Promise<void> {
    await this.supabase.client
      .from('inscriptions')
      .insert({ sortie_id: sortieId, user_id: userId, status: 'confirmed' });
  }

  async rejoindre(
    userId: string,
    sortieId: string,
  ): Promise<{ error: RepositoryError | null; status: 'pending' | 'waiting' | null }> {
    const { data, error } = await this.supabase.client.rpc('rejoindre_sortie', {
      p_user_id: userId,
      p_sortie_id: sortieId,
    });
    return { error: toError(error), status: error ? null : (data as 'pending' | 'waiting') };
  }

  async quitter(userId: string, sortieId: string): Promise<{ error: RepositoryError | null }> {
    const { error } = await this.supabase.client.rpc('quitter_sortie', {
      p_user_id: userId,
      p_sortie_id: sortieId,
    });
    return { error: toError(error) };
  }
}
