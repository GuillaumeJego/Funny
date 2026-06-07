import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { Sortie } from '../models/sortie.model';

@Injectable({ providedIn: 'root' })
export class SortieService {

  constructor(private supabase: SupabaseService) {}

  // Récupérer toutes les sorties publiées
  async getAllSorties() {
    return await this.supabase.client
      .from('sorties')
      .select(`
        *,
        themes (name, icon),
        profiles (username, avatar_url)
      `)
      .eq('status', 'published')
      .order('date');
  }

  // Récupérer la première image d'un thème (fallback image)
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

  // Récupérer une sortie par ID
  async getSortieById(id: string) {
    return await this.supabase.client
      .from('sorties')
      .select(`
        *,
        themes (name, icon),
        profiles (username, avatar_url)
      `)
      .eq('id', id)
      .single();
  }

  // Créer une sortie
  async createSortie(sortie: Partial<Sortie>) {
    return await this.supabase.client
      .from('sorties')
      .insert(sortie)
      .select()
      .single();
  }

  // Modifier une sortie
  async updateSortie(id: string, updates: Partial<Sortie>) {
    return await this.supabase.client
      .from('sorties')
      .update(updates)
      .eq('id', id);
  }

  // Supprimer une sortie
  async deleteSortie(id: string) {
    return await this.supabase.client
      .from('sorties')
      .delete()
      .eq('id', id);
  }

  // S'inscrire à une sortie
  async inscrire(sortieId: string, userId: string) {
    return await this.supabase.client
      .from('inscriptions')
      .insert({ sortie_id: sortieId, user_id: userId });
  }

  // Se désinscrire d'une sortie
  async desinscrire(sortieId: string, userId: string) {
    return await this.supabase.client
      .from('inscriptions')
      .update({ status: 'cancelled' })
      .eq('sortie_id', sortieId)
      .eq('user_id', userId);
  }

  // Vérifier si un utilisateur est inscrit
  async isInscrit(sortieId: string, userId: string) {
    return await this.supabase.client
      .from('inscriptions')
      .select('*')
      .eq('sortie_id', sortieId)
      .eq('user_id', userId)
      .eq('status', 'pending')
      .single();
  }
}