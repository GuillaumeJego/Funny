import { Injectable } from '@angular/core';
import { Sortie, SortieWithRelations } from '../models/sortie.model';
import { SortieRepository } from '../repositories/sortie.repository';
import { StorageRepository } from '../repositories/storage.repository';
import { InscriptionRepository } from '../repositories/inscription.repository';
import { FavoriRepository } from '../repositories/favori.repository';
import { ProfileRepository } from '../repositories/profile.repository';
import { MiniProfile } from '../repositories/repository.types';

@Injectable({ providedIn: 'root' })
export class SortieService {
  constructor(
    private sorties: SortieRepository,
    private inscriptions: InscriptionRepository,
    private favoris: FavoriRepository,
    private profiles: ProfileRepository,
    private storage: StorageRepository,
  ) {}

  // Récupérer toutes les sorties publiées
  async getAllSorties() {
    return await this.sorties.getPublished();
  }

  // Récupérer le nombre d'inscrits pour une sortie (hors organisateur)
  async getInscriptionsCount(sortieId: string): Promise<number> {
    return await this.inscriptions.countPending(sortieId);
  }

  // Récupérer la première image d'un thème (fallback image)
  async getFirstThemeImage(themeId: string): Promise<string | null> {
    return await this.sorties.getFirstThemeImage(themeId);
  }

  // Créer une sortie : le serveur y inscrit aussi son organisateur
  async createSortie(sortie: Partial<Sortie>) {
    return await this.sorties.create(sortie);
  }

  // Envoyer l'image personnalisée d'une sortie ; renvoie son adresse
  async uploadImage(userId: string, image: File) {
    return await this.storage.uploadSortieImage(userId, image);
  }

  // Supprimer une sortie : le serveur prévient les inscrits et les membres qui l'ont aimée
  async deleteSortie(sortieId: string) {
    return await this.sorties.delete(sortieId);
  }

  // Sorties créées par un utilisateur
  async getSortiesCreatedBy(userId: string) {
    return await this.sorties.getPublishedCreatedBy(userId);
  }

  // Sorties auxquelles un utilisateur est inscrit (status pending uniquement)
  async getSortiesRejointes(userId: string): Promise<SortieWithRelations[]> {
    const ids = await this.inscriptions.getSortieIds(userId, 'pending');
    return await this.sorties.getPublishedByIds(ids);
  }

  // Sorties en liste d'attente pour un utilisateur (ordonnées par position)
  async getSortiesEnAttente(userId: string): Promise<SortieWithRelations[]> {
    const ids = await this.inscriptions.getSortieIds(userId, 'waiting');
    const sorties = await this.sorties.getPublishedByIds(ids);
    // Respecter l'ordre d'inscription
    return ids
      .map((id) => sorties.find((s) => s.id === id))
      .filter(Boolean) as SortieWithRelations[];
  }

  // Membres inscrits à une sortie (pending = membres, confirmed = organisateur)
  async getMembresInscrits(sortieId: string): Promise<(MiniProfile & { isOrganizer: boolean })[]> {
    const rows = await this.inscriptions.getParticipants(sortieId);
    const profiles = await this.profiles.getMiniProfiles(rows.map((r) => r.user_id));
    return profiles.map((p) => ({
      ...p,
      isOrganizer: rows.find((r) => r.user_id === p.id)?.status === 'confirmed',
    }));
  }

  // Membres en liste d'attente pour une sortie
  async getMembresWaiting(sortieId: string): Promise<MiniProfile[]> {
    const userIds = await this.inscriptions.getWaitingUserIds(sortieId);
    const profiles = await this.profiles.getMiniProfiles(userIds);
    // Respecter l'ordre d'inscription
    return userIds
      .map((uid) => profiles.find((p) => p.id === uid))
      .filter(Boolean) as MiniProfile[];
  }

  // Membres qui ont liké une sortie
  async getMembresLikes(sortieId: string): Promise<MiniProfile[]> {
    const userIds = await this.favoris.getUserIds(sortieId);
    return await this.profiles.getMiniProfiles(userIds);
  }

  // Sorties likées par un utilisateur
  async getSortiesLikees(userId: string): Promise<SortieWithRelations[]> {
    const ids = await this.favoris.getSortieIds(userId);
    return await this.sorties.getPublishedByIds(ids);
  }
}
