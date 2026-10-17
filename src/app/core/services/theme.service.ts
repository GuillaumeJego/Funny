import { Injectable } from '@angular/core';
import { ThemeRepository } from '../repositories/theme.repository';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  constructor(private themes: ThemeRepository) {}

  // Récupérer tous les thèmes
  async getAllThemes() {
    return await this.themes.getAll();
  }

  // Récupérer les images d'un thème
  async getThemeImages(themeId: string) {
    return await this.themes.getImages(themeId);
  }
}
