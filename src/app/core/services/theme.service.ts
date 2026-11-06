import { Injectable, inject } from '@angular/core';
import { ThemeRepository } from '../repositories/theme.repository';
import { StorageRepository } from '../repositories/storage.repository';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private themes = inject(ThemeRepository);
  private storage = inject(StorageRepository);

  // Récupérer tous les thèmes
  async getAllThemes() {
    return await this.themes.getAll();
  }

  // Récupérer les images d'un thème
  async getThemeImages(themeId: string) {
    return await this.themes.getImages(themeId);
  }

  // ── Espace admin ──

  async createTheme(name: string, icon: string) {
    return await this.themes.create({ name: name.trim(), icon: icon.trim() });
  }

  async updateTheme(id: string, name: string, icon: string) {
    return await this.themes.update(id, { name: name.trim(), icon: icon.trim() });
  }

  async deleteTheme(id: string) {
    return await this.themes.delete(id);
  }

  /** Envoie la photo dans le stockage des images de sorties, puis l'ajoute au thème. */
  async addThemeImage(adminId: string, themeId: string, file: File) {
    const { data: url, error } = await this.storage.uploadSortieImage(adminId, file);
    if (error || !url) return { data: null, error: error ?? { message: 'Envoi impossible.' } };
    return await this.themes.addImage(themeId, url);
  }

  async removeThemeImage(imageId: string) {
    return await this.themes.removeImage(imageId);
  }
}
