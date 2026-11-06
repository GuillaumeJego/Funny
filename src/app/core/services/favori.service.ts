import { Injectable, inject } from '@angular/core';
import { FavoriRepository } from '../repositories/favori.repository';

@Injectable({ providedIn: 'root' })
export class FavoriService {
  private favoris = inject(FavoriRepository);

  async getFavoris(userId: string): Promise<string[]> {
    return await this.favoris.getSortieIds(userId);
  }

  async addFavori(userId: string, sortieId: string) {
    return await this.favoris.add(userId, sortieId);
  }

  async removeFavori(userId: string, sortieId: string) {
    return await this.favoris.remove(userId, sortieId);
  }
}
