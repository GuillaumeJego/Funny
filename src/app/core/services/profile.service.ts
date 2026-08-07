import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { Profile } from '../models/profile.model';

@Injectable({ providedIn: 'root' })
export class ProfileService {

  constructor(private supabase: SupabaseService) {}

  // Récupérer son propre profil
  async getMyProfile(userId: string) {
    return await this.supabase.client
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
  }

  // Récupérer le profil public d'un utilisateur
  async getProfileById(userId: string) {
    return await this.supabase.client
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
  }

  // Récupérer tous les profils (page Membres)
  async getAllProfiles() {
    return await this.supabase.client
      .from('profiles')
      .select('id, username, avatar_url, bio, role, can_view_profiles, subscription_end_date, gender, smoking, vaping, alcohol, relationship')
      .order('username');
  }

  // Mettre à jour son profil
  async updateProfile(userId: string, updates: Partial<Profile>) {
    return await this.supabase.client
      .from('profiles')
      .update(updates)
      .eq('id', userId);
  }
}