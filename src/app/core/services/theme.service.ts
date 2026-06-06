import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { Theme, ThemeImage } from '../models/theme.model';

@Injectable({ providedIn: 'root' })
export class ThemeService {

  constructor(private supabase: SupabaseService) {}

  // Récupérer tous les thèmes
  async getAllThemes() {
    return await this.supabase.client
      .from('themes')
      .select('*')
      .order('name');
  }

  // Récupérer les images d'un thème
  async getThemeImages(themeId: string) {
    return await this.supabase.client
      .from('theme_images')
      .select('*')
      .eq('theme_id', themeId)
      .order('position');
  }

  // Créer un thème (admin seulement)
  async createTheme(theme: Partial<Theme>) {
    return await this.supabase.client
      .from('themes')
      .insert(theme);
  }

  // Modifier un thème (admin seulement)
  async updateTheme(id: string, updates: Partial<Theme>) {
    return await this.supabase.client
      .from('themes')
      .update(updates)
      .eq('id', id);
  }

  // Supprimer un thème (admin seulement)
  async deleteTheme(id: string) {
    return await this.supabase.client
      .from('themes')
      .delete()
      .eq('id', id);
  }
}