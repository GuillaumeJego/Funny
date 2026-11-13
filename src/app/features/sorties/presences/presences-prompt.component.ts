import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs/operators';
import { SortieWithRelations } from '../../../core/models/sortie.model';
import { AuthService } from '../../../core/services/auth.service';
import { SortieService } from '../../../core/services/sortie.service';
import { PresencesFormComponent } from './presences-form.component';

/** « Je remplirai plus tard » : la fenêtre ne revient pas avant la prochaine visite. */
const LATER_KEY = 'funny-presences-plus-tard';

/**
 * Fenêtre « Qui était présent ? » qui s'ouvre à l'arrivée dans l'appli quand l'organisateur
 * a une sortie passée dont les présences ne sont pas validées (le serveur l'a déjà relancé).
 */
@Component({
  selector: 'app-presences-prompt',
  standalone: true,
  imports: [PresencesFormComponent],
  template: `
    @if (current(); as sortie) {
      <div class="pp-backdrop" role="dialog" aria-modal="true" aria-label="Qui était présent ?">
        <div class="pp-card">
          <app-presences-form [sortie]="sortie" (validated)="next()" (later)="remindLater()" />
        </div>
      </div>
    }
  `,
  styles: `
    @use 'tokens' as *;
    .pp-backdrop {
      position: fixed;
      inset: 0;
      z-index: 400;
      background: rgba(0, 0, 0, 0.6);
      display: flex;
      align-items: flex-end;
      justify-content: center;
      animation: ppFade 0.2s ease;
    }
    .pp-card {
      width: 100%;
      max-width: 520px;
      max-height: 88vh;
      overflow-y: auto;
      background: $bg-white;
      border-radius: 22px 22px 0 0;
      padding: 1.4rem 1.2rem calc(1.2rem + env(safe-area-inset-bottom));
      animation: ppUp 0.3s cubic-bezier(0.32, 0.72, 0, 1);
    }
    @media (min-width: 640px) {
      .pp-backdrop {
        align-items: center;
      }
      .pp-card {
        border-radius: 22px;
      }
    }
    @keyframes ppFade {
      from {
        opacity: 0;
      }
    }
    @keyframes ppUp {
      from {
        transform: translateY(40px);
        opacity: 0;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PresencesPromptComponent implements OnInit {
  private router = inject(Router);
  private auth = inject(AuthService);
  private sorties = inject(SortieService);
  private destroyRef = inject(DestroyRef);

  readonly current = signal<SortieWithRelations | null>(null);
  private queue: SortieWithRelations[] = [];
  private checked = false;

  ngOnInit() {
    // Créée après la première navigation (avec les barres) : on regarde tout de suite,
    // puis à chaque changement de page tant que le membre n'est pas connecté.
    this.onPage(this.router.url);
    this.router.events
      .pipe(
        filter((e) => e instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((e) => this.onPage((e as NavigationEnd).urlAfterRedirects));
  }

  private onPage(url: string) {
    // Sur la page des présences elle-même, la fenêtre ferait doublon.
    if (/^\/sorties\/[^/]+\/presences/.test(url)) {
      this.current.set(null);
      return;
    }
    if (!this.checked) this.check();
  }

  private async check() {
    this.checked = true;
    if (this.laterChosen()) return;
    const {
      data: { user },
    } = await this.auth.getUser();
    if (!user) {
      this.checked = false; // pas encore connecté : on regardera à la prochaine page
      return;
    }
    const { data } = await this.sorties.getSortiesCreatedBy(user.id);
    this.queue = (data ?? [])
      .filter((s) => s.presences_rappel && !s.presences_validees)
      .sort((a, b) => a.date.localeCompare(b.date));
    this.next();
  }

  /** Sortie suivante à valider, ou fermeture. */
  next() {
    this.current.set(this.queue.shift() ?? null);
  }

  remindLater() {
    try {
      sessionStorage.setItem(LATER_KEY, '1');
    } catch {
      // stockage indisponible : la fenêtre se ferme quand même
    }
    this.queue = [];
    this.current.set(null);
  }

  private laterChosen(): boolean {
    try {
      return sessionStorage.getItem(LATER_KEY) === '1';
    } catch {
      return false;
    }
  }
}
