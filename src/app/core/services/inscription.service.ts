import { Injectable } from '@angular/core';
import { InscriptionRepository } from '../repositories/inscription.repository';

export type { InscriptionStatus } from '../repositories/inscription.repository';

@Injectable({ providedIn: 'root' })
export class InscriptionService {
  constructor(private inscriptions: InscriptionRepository) {}

  async getInscriptionStatus(userId: string, sortieId: string) {
    return await this.inscriptions.getStatus(userId, sortieId);
  }

  // Retourne le status obtenu ('pending' ou 'waiting') — atomique côté DB
  async rejoindre(userId: string, sortieId: string) {
    return await this.inscriptions.rejoindre(userId, sortieId);
  }

  async quitter(userId: string, sortieId: string) {
    return await this.inscriptions.quitter(userId, sortieId);
  }
}
