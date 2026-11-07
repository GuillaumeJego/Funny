import { Injectable, OnDestroy, inject } from '@angular/core';
import { AuthService } from './auth.service';

/** Une nouvelle connexion est notée après 30 minutes sans revenir sur le site. */
const VISIT_GAP_MS = 30 * 60 * 1000;
/** Les pages vues partent par lots, au plus une fois par minute. */
const PAGES_FLUSH_MS = 60 * 1000;

/**
 * Chemin d'une page sans ses identifiants ni paramètres, pour regrouper les vues :
 * « /membres/6a8f…?tab=x » → « /membres/:id ».
 */
export function normalizePage(url: string): string {
  const path = url.split(/[?#]/)[0] || '/';
  const parts = path
    .split('/')
    .filter(Boolean)
    .map((part) => (/^[a-zA-Z0-9_-]{12,}$/.test(part) && /\d/.test(part) ? ':id' : part));
  return ('/' + parts.join('/')).toLowerCase().slice(0, 100);
}

/**
 * Statistiques de l'admin : note les connexions et les pages consultées par le membre
 * connecté. Rien de visible pour le membre ; une erreur ici n'a aucun effet.
 */
@Injectable({ providedIn: 'root' })
export class ActivityService implements OnDestroy {
  private auth = inject(AuthService);
  private lastVisit = 0;
  private recording = false;
  private pending: Record<string, number> = {};
  private timer: ReturnType<typeof setInterval> | undefined;

  /** Une page d'un membre connecté s'affiche. */
  pageShown(url: string) {
    const page = normalizePage(url);
    this.pending[page] = (this.pending[page] ?? 0) + 1;
    this.timer ??= setInterval(() => this.flushPages(), PAGES_FLUSH_MS);
    this.recordVisit();
  }

  /** Retour sur l'onglet : peut compter comme une nouvelle connexion. Départ : on envoie les pages. */
  visibilityChanged(visible: boolean) {
    if (visible) this.recordVisit();
    else this.flushPages();
  }

  ngOnDestroy() {
    clearInterval(this.timer);
  }

  /** Le serveur ignore aussi les connexions trop rapprochées. */
  private async recordVisit() {
    const now = Date.now();
    if (this.recording || now - this.lastVisit < VISIT_GAP_MS) return;
    this.recording = true;
    // Pas encore connecté (page protégée avant redirection) : on réessaiera à la page suivante.
    if (await this.auth.recordVisit().catch(() => false)) this.lastVisit = now;
    this.recording = false;
  }

  private async flushPages() {
    const pages = this.pending;
    if (!Object.keys(pages).length) return;
    this.pending = {};
    const ok = await this.auth.recordPages(pages).catch(() => false);
    // Échec (réseau, pas connecté) : on garde les vues pour le prochain envoi.
    if (!ok) {
      for (const [page, n] of Object.entries(pages)) {
        this.pending[page] = (this.pending[page] ?? 0) + n;
      }
    }
  }
}
