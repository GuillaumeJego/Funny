import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { Profile } from '../models/profile.model';

@Injectable({ providedIn: 'root' })
export class SettingsService {

  constructor(private supabase: SupabaseService) {}

  async get(key: string): Promise<any> {
    const { data } = await this.supabase.client
      .from('app_settings')
      .select('value')
      .eq('key', key)
      .single();
    return data?.value;
  }

  async set(key: string, value: any): Promise<{ error: any }> {
    const { error } = await this.supabase.client
      .from('app_settings')
      .update({ value, updated_at: new Date().toISOString() })
      .eq('key', key);
    return { error };
  }

  // Vérifie si le viewer peut voir les profils
  async canViewProfiles(viewerProfile: Profile): Promise<boolean> {
    if (viewerProfile.role === 'admin' || viewerProfile.role === 'developer') return true;
    if (viewerProfile.can_view_profiles === true) return true;
    if (viewerProfile.can_view_profiles === false) return false;

    const premiumOnly = await this.get('profile_page_premium_only');
    if (!premiumOnly) return true;

    // Vérifie abonnement actif
    if (viewerProfile.subscription_end_date) {
      return new Date(viewerProfile.subscription_end_date) > new Date();
    }
    return false;
  }
}
