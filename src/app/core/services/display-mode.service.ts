import { Injectable, signal } from '@angular/core';

/** Mode d'affichage choisi par le membre. */
export type DisplayMode = 'light' | 'dark';

/** Clé du choix enregistré sur l'appareil (lue aussi par index.html avant le démarrage). */
export const DISPLAY_MODE_KEY = 'funny-display-mode';

/** Couleur de la barre du téléphone selon le mode (fond de page). */
const BAR_COLOR: Record<DisplayMode, string> = { light: '#f3f5f9', dark: '#080d18' };

/**
 * Mode Lumineux (par défaut) ou Sombre. Le choix est gardé sur l'appareil et appliqué
 * en posant data-theme="dark" sur la page ; les couleurs suivent (voir src/styles.scss).
 */
@Injectable({ providedIn: 'root' })
export class DisplayModeService {
  readonly mode = signal<DisplayMode>(this.read());

  constructor() {
    this.apply(this.mode());
  }

  set(mode: DisplayMode) {
    this.mode.set(mode);
    try {
      localStorage.setItem(DISPLAY_MODE_KEY, mode);
    } catch {
      // stockage indisponible : le mode s'applique quand même pour cette visite
    }
    this.apply(mode);
  }

  private read(): DisplayMode {
    try {
      return localStorage.getItem(DISPLAY_MODE_KEY) === 'dark' ? 'dark' : 'light';
    } catch {
      return 'light';
    }
  }

  private apply(mode: DisplayMode) {
    const root = document.documentElement;
    if (mode === 'dark') root.setAttribute('data-theme', 'dark');
    else root.removeAttribute('data-theme');
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', BAR_COLOR[mode]);
  }
}
