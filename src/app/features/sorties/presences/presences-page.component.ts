import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { SortieWithRelations } from '../../../core/models/sortie.model';
import { AuthService } from '../../../core/services/auth.service';
import { SortieService } from '../../../core/services/sortie.service';
import { PresencesFormComponent } from './presences-form.component';

/** Page « Qui était présent ? », ouverte depuis la notification envoyée à l'organisateur. */
@Component({
  selector: 'app-presences-page',
  standalone: true,
  imports: [PresencesFormComponent, RouterLink],
  template: `
    <div class="presences-page">
      <a routerLink="/mes-sorties" class="back">← Mes sorties</a>
      @if (loading()) {
        <p class="info">Chargement…</p>
      } @else if (!sortie()) {
        <p class="info">Cette sortie n'existe plus.</p>
      } @else if (!isOrganizer()) {
        <p class="info">Seul l'organisateur de la sortie peut indiquer les présences.</p>
      } @else if (done()) {
        <div class="done">
          <p>✅ Merci ! Les présences sont enregistrées.</p>
          <a routerLink="/mes-sorties" class="btn-back">Retour à mes sorties</a>
        </div>
      } @else {
        <app-presences-form
          [sortie]="sortie()!"
          (validated)="done.set(true)"
          (later)="router.navigate(['/mes-sorties'])"
        />
      }
    </div>
  `,
  styles: `
    @use 'tokens' as *;
    .presences-page {
      padding: 1.25rem 1rem 6rem;
      max-width: 600px;
      margin: 0 auto;
    }
    .back {
      display: inline-block;
      color: $accent-text;
      font-size: 0.9rem;
      text-decoration: none;
      margin-bottom: 1rem;
    }
    .info {
      color: $text-light;
      text-align: center;
      padding: 2rem 0;
    }
    .done {
      text-align: center;
      padding: 2rem 0;
      color: $text-dark;
      font-weight: 650;
    }
    .btn-back {
      display: inline-block;
      margin-top: 1rem;
      padding: 0.8rem 1.4rem;
      border-radius: 14px;
      background: $accent;
      color: $on-accent;
      font-weight: 750;
      text-decoration: none;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PresencesPageComponent implements OnInit {
  private route = inject(ActivatedRoute);
  readonly router = inject(Router);
  private auth = inject(AuthService);
  private sorties = inject(SortieService);

  readonly loading = signal(true);
  readonly sortie = signal<SortieWithRelations | null>(null);
  readonly isOrganizer = signal(false);
  readonly done = signal(false);

  async ngOnInit() {
    const {
      data: { user },
    } = await this.auth.getUser();
    if (!user) {
      this.router.navigate(['/login']);
      return;
    }
    const sortie = await this.sorties.getSortie(this.route.snapshot.paramMap.get('id') ?? '');
    this.sortie.set(sortie);
    this.isOrganizer.set(!!sortie && sortie.created_by === user.id);
    this.loading.set(false);
  }
}
