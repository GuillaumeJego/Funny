import { Injectable } from '@angular/core';
import { Sortie, SortieWithRelations } from '../models/sortie.model';
import { SortieRepository } from '../repositories/sortie.repository';
import { StorageRepository } from '../repositories/storage.repository';
import { InscriptionRepository } from '../repositories/inscription.repository';
import { FavoriRepository } from '../repositories/favori.repository';
import { ProfileRepository } from '../repositories/profile.repository';
import { MiniProfile } from '../repositories/repository.types';
import { NotificationService } from './notification.service';

@Injectable({ providedIn: 'root' })
export class SortieService {
  constructor(
    private sorties: SortieRepository,
    private inscriptions: InscriptionRepository,
    private favoris: FavoriRepository,
    private profiles: ProfileRepository,
    private storage: StorageRepository,
    private notifService: NotificationService,
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

  // Créer une sortie, puis y inscrire son organisateur
  async createSortie(sortie: Partial<Sortie>) {
    const result = await this.sorties.create(sortie);
    if (result.data && sortie.created_by) {
      await this.inscriptions.inscrireOrganisateur(result.data.id, sortie.created_by);
    }
    return result;
  }

  // Envoyer l'image personnalisée d'une sortie ; renvoie son adresse
  async uploadImage(userId: string, image: File) {
    return await this.storage.uploadSortieImage(userId, image);
  }

  // Supprimer une sortie + envoyer des notifications aux inscrits et aux likeurs
  async deleteSortieWithNotifications(
    sortieId: string,
    sortieTitle: string,
    organizerUsername: string,
  ) {
    // 1. Récupérer inscrits et likeurs avant suppression
    const [inscrits, likes] = await Promise.all([
      this.getMembresInscrits(sortieId),
      this.getMembresLikes(sortieId),
    ]);

    // 2. Construire les notifications (éviter les doublons)
    const notifications: { user_id: string; title: string; message: string }[] = [];
    const seen = new Set<string>();

    for (const p of inscrits) {
      if (!p?.id || seen.has(p.id)) continue;
      seen.add(p.id);
      notifications.push({
        user_id: p.id,
        title: 'Sortie annulée',
        message: `Vous étiez inscrit à la sortie "${sortieTitle}". L'organisateur ${organizerUsername} a annulé la sortie. Si vous avez payé pour y participer, vous serez remboursé.`,
      });
    }

    for (const p of likes) {
      if (!p?.id || seen.has(p.id)) continue;
      seen.add(p.id);
      notifications.push({
        user_id: p.id,
        title: 'Sortie annulée',
        message: `Vous aviez liké la sortie "${sortieTitle}". L'organisateur ${organizerUsername} a annulé la sortie. Si vous avez payé pour y participer, vous serez remboursé.`,
      });
    }

    // 3. Envoyer les notifications puis supprimer
    await this.notifService.createMany(notifications);
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
