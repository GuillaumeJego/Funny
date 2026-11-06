import { Injectable, inject } from '@angular/core';
import { SettingsRepository } from '../repositories/settings.repository';
import { Profile } from '../models/profile.model';
import { isPremiumMember } from '../utils/premium';

@Injectable({ providedIn: 'root' })
export class SettingsService {
  private settings = inject(SettingsRepository);

  async get(key: string): Promise<any> {
    return await this.settings.get(key);
  }

  async set(key: string, value: any) {
    return await this.settings.set(key, value);
  }

  async canCreateSortie(profile: Profile): Promise<boolean> {
    if (profile.role === 'admin' || profile.role === 'developer') return true;
    const setting = (await this.get('sortie_creation_access')) ?? 'all';
    if (setting === 'all') return true;
    if (setting === 'admin') return false;
    return isPremiumMember(profile); // « premium »
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
