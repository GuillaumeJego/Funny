import { Injectable, inject } from '@angular/core';
import { ProfileRepository } from '../repositories/profile.repository';
import { StorageRepository } from '../repositories/storage.repository';
import { AdminRepository } from '../repositories/admin.repository';
import { Profile } from '../models/profile.model';
import { MiniProfile } from '../repositories/repository.types';

/** Champs qu'un membre peut modifier sur son propre profil. */
const SELF_EDITABLE_FIELDS = [
  'username',
  'bio',
  'avatar_url',
  'cover_url',
  'birthdate',
  'gender',
  'city',
  'smoking',
  'vaping',
  'alcohol',
  'children',
  'relationship',
  'view_mode',
] as const;

/** Champs réservés à l'administration. */
export type AdminProfileUpdate = Partial<
  Pick<Profile, 'role' | 'subscription_end_date' | 'can_view_profiles'>
>;

@Injectable({ providedIn: 'root' })
export class ProfileService {
  private profiles = inject(ProfileRepository);
  private storage = inject(StorageRepository);
  private admin = inject(AdminRepository);

  /** Signale la visite du profil d'un autre membre ; une erreur n'est jamais gênante. */
  async recordProfileVisit(memberId: string) {
    try {
      await this.profiles.recordProfileVisit(memberId);
    } catch {
      // le membre visité ne sera simplement pas prévenu
    }
  }

  /**
   * Qui a visité mon profil ces 30 derniers jours, le plus récent d'abord.
   * `visitor` est absent quand je ne suis pas Premium (visite floutée).
   */
  async getProfileVisits(): Promise<{
    premium: boolean;
    visits: { at: string; visitor?: MiniProfile }[];
  } | null> {
    const result = await this.profiles.getProfileVisits();
    if (!result) return null;
    const ids = [...new Set(result.visits.flatMap((v) => (v.visitor_id ? [v.visitor_id] : [])))];
    const profiles = new Map(
      (ids.length ? await this.profiles.getMiniProfiles(ids) : []).map((p) => [p.id, p]),
    );
    return {
      premium: result.premium,
      visits: result.visits
        // Un visiteur dont le compte a disparu n'est plus affiché.
        .filter((v) => !v.visitor_id || profiles.has(v.visitor_id))
        .map((v) => ({ at: v.at, visitor: v.visitor_id ? profiles.get(v.visitor_id) : undefined })),
    };
  }

  // Récupérer son propre profil
  async getMyProfile(userId: string) {
    return await this.profiles.getById(userId);
  }

  // Récupérer le profil public d'un utilisateur
  async getProfileById(userId: string) {
    return await this.profiles.getById(userId);
  }

  // Récupérer tous les profils (page Membres)
  async getAllProfiles() {
    return await this.profiles.getAll();
  }

  // Mettre à jour son propre profil : seuls les champs autorisés sont envoyés
  async updateMyProfile(userId: string, updates: Partial<Profile>) {
    const allowed: Partial<Profile> = {};
    for (const field of SELF_EDITABLE_FIELDS) {
      if (field in updates) (allowed as any)[field] = updates[field];
    }
    return await this.profiles.update(userId, allowed);
  }

  // Envoie une nouvelle photo de profil et l'enregistre ; renvoie son adresse
  async uploadAvatar(userId: string, image: Blob) {
    const { data: url, error } = await this.storage.uploadAvatar(userId, image);
    if (error || !url) return { data: null, error };
    // Le paramètre ?t= force le navigateur à recharger la nouvelle image
    const urlWithCache = `${url}${url.includes('?') ? '&' : '?'}t=${Date.now()}`;
    await this.profiles.update(userId, { avatar_url: urlWithCache });
    return { data: urlWithCache, error: null };
  }

  // Envoie une photo de couverture et l'enregistre ; renvoie son adresse
  async uploadCover(userId: string, image: Blob) {
    const { data: url, error } = await this.storage.uploadCover(userId, image);
    if (error || !url) return { data: null, error };
    const urlWithCache = `${url}${url.includes('?') ? '&' : '?'}t=${Date.now()}`;
    await this.profiles.update(userId, { cover_url: urlWithCache });
    return { data: urlWithCache, error: null };
  }

  // Retire la photo de couverture : le profil retrouve le bandeau bleu
  async removeCover(userId: string) {
    const { error } = await this.storage.deleteCover(userId);
    if (error) return { error };
    return await this.profiles.update(userId, { cover_url: null });
  }

  // Mise à jour par un administrateur (rôle, abonnement, accès aux profils), vérifiée par le serveur
  async adminUpdateProfile(userId: string, updates: AdminProfileUpdate) {
    if (updates.role !== undefined) {
      const result = await this.admin.setRole(userId, updates.role);
      if (result.error) return result;
    }
    if (updates.subscription_end_date !== undefined) {
      const result = await this.admin.setPremium(userId, updates.subscription_end_date || null);
      if (result.error) return result;
    }
    if (updates.can_view_profiles !== undefined) {
      return await this.admin.setCanViewProfiles(userId, updates.can_view_profiles);
    }
    return { data: null, error: null };
  }
}
