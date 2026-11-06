import {
  Component,
  OnInit,
  ChangeDetectionStrategy,
  inject,
  signal,
  computed,
} from '@angular/core';

import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { SortieService } from '../../core/services/sortie.service';
import { ProfileService } from '../../core/services/profile.service';
import { InscriptionService, InscriptionStatus } from '../../core/services/inscription.service';
import { FavoriService } from '../../core/services/favori.service';
import {
  NavbarFiltersComponent,
  Filters,
  ThemeOption,
} from '../../core/components/navbar-filters/navbar-filters.component';
import { SortieWithRelations } from '../../core/models/sortie.model';
import { SortieDrawerComponent } from '../sorties/sortie-drawer/sortie-drawer.component';
import { isPremiumMember } from '../../core/utils/premium';
import { ClickableDirective } from '../../core/directives/clickable.directive';

@Component({
  selector: 'app-mes-sorties',
  standalone: true,
  imports: [ClickableDirective, SortieDrawerComponent, NavbarFiltersComponent],
  templateUrl: './mes-sorties.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './mes-sorties.component.scss',
})
export class MesSortiesComponent implements OnInit {
  private auth = inject(AuthService);
  private sortieService = inject(SortieService);
  private profileService = inject(ProfileService);
  private inscriptionService = inject(InscriptionService);
  private favoriService = inject(FavoriService);
  private router = inject(Router);

  readonly activeTab = signal<'creees' | 'rejointes' | 'attente' | 'likees'>('creees');
  readonly viewMode = signal<'grid' | 'list'>('list');
  readonly sortiesCreees = signal<SortieWithRelations[]>([]);
  readonly sortiesRejointes = signal<SortieWithRelations[]>([]);
  readonly sortiesEnAttente = signal<SortieWithRelations[]>([]);
  readonly sortiesLikees = signal<SortieWithRelations[]>([]);
  readonly loading = signal(true);
  readonly userId = signal('');
  readonly userRole = signal('user');
  readonly userIsPremium = signal(false);
  readonly favorisIds = signal<Set<string>>(new Set());
  readonly currentFilters = signal<Filters>({ quickPeriod: 'upcoming' });
  readonly availableThemes = signal<ThemeOption[]>([]);
  readonly availableLocations = signal<string[]>([]);

  readonly selectedSortie = signal<SortieWithRelations | null>(null);
  readonly drawerOpen = signal(false);
  readonly inscriptionStatus = signal<InscriptionStatus>('none');

  async ngOnInit() {
    const {
      data: { user },
    } = await this.auth.getUser();
    if (!user) {
      this.router.navigate(['/login']);
      return;
    }
    this.userId.set(user.id);
    const [profileRes, favoris] = await Promise.all([
      this.profileService.getMyProfile(user.id),
      this.favoriService.getFavoris(user.id),
    ]);
    this.userRole.set(profileRes.data?.role ?? 'user');
    this.userIsPremium.set(isPremiumMember(profileRes.data));
    this.favorisIds.set(new Set(favoris));
    await this.loadAll();
  }

  async loadAll() {
    this.loading.set(true);
    const [creees, rejointes, attente, likees] = await Promise.all([
      this.sortieService.getSortiesCreatedBy(this.userId()),
      this.sortieService.getSortiesRejointes(this.userId()),
      this.sortieService.getSortiesEnAttente(this.userId()),
      this.sortieService.getSortiesLikees(this.userId()),
    ]);

    this.sortiesCreees.set((creees.data ?? []) as SortieWithRelations[]);
    this.sortiesRejointes.set(rejointes);
    this.sortiesEnAttente.set(attente);
    this.sortiesLikees.set(likees);

    const all = [
      ...this.sortiesCreees(),
      ...this.sortiesRejointes(),
      ...this.sortiesEnAttente(),
      ...this.sortiesLikees(),
    ];
    // Thèmes et villes disponibles
    const themesMap = new Map<string, ThemeOption>();
    const locationsSet = new Set<string>();
    for (const s of all) {
      if (s.theme_id && s.themes)
        themesMap.set(s.theme_id, { id: s.theme_id, name: s.themes.name, icon: s.themes.icon });
      if (s.location) locationsSet.add(s.location);
    }
    this.availableThemes.set([...themesMap.values()]);
    this.availableLocations.set([...locationsSet].sort());

    this.loading.set(false);
  }

  onFiltersChanged(f: Filters) {
    this.currentFilters.set(f);
  }

  private applyFilters(list: SortieWithRelations[]): SortieWithRelations[] {
    const now = new Date();
    const f = this.currentFilters();
    return list.filter((s) => {
      if (f.themeIds?.length && !f.themeIds.includes(s.theme_id ?? '')) return false;
      if (f.ou && s.location !== f.ou) return false;
      if (f.quickPeriod === 'past' && new Date(s.date) >= now) return false;
      if (f.quickPeriod === 'upcoming' && new Date(s.date) < now) return false;
      if (!f.quickPeriod && (f.dateDebut || f.dateFin)) {
        const d = new Date(s.date);
        if (f.dateDebut && d < new Date(f.dateDebut)) return false;
        if (f.dateFin) {
          const fin = new Date(f.dateFin);
          fin.setHours(23, 59, 59);
          if (d > fin) return false;
        }
      }
      if (f.prix === 'gratuit' && s.price > 0) return false;
      if (f.prix === 'payant' && s.price === 0) return false;
      if (f.premium && !s.is_premium) return false;
      return true;
    });
  }

  readonly currentList = computed<SortieWithRelations[]>(() => {
    const base =
      this.activeTab() === 'creees'
        ? this.sortiesCreees()
        : this.activeTab() === 'rejointes'
          ? this.sortiesRejointes()
          : this.activeTab() === 'attente'
            ? this.sortiesEnAttente()
            : this.sortiesLikees();
    return this.applyFilters(base);
  });

  tabCount(tab: 'creees' | 'rejointes' | 'attente' | 'likees'): number {
    const base =
      tab === 'creees'
        ? this.sortiesCreees()
        : tab === 'rejointes'
          ? this.sortiesRejointes()
          : tab === 'attente'
            ? this.sortiesEnAttente()
            : this.sortiesLikees();
    return this.applyFilters(base).length;
  }

  async openDrawer(sortie: SortieWithRelations) {
    this.selectedSortie.set(sortie);
    this.drawerOpen.set(true);
    this.inscriptionStatus.set(
      await this.inscriptionService.getInscriptionStatus(this.userId(), sortie.id),
    );
  }

  closeDrawer() {
    this.drawerOpen.set(false);
    this.selectedSortie.set(null);
  }

  isFavori(sortieId: string): boolean {
    return this.favorisIds().has(sortieId);
  }

  async toggleFavori(event: Event, sortieId: string) {
    event.stopPropagation();
    if (!this.userId()) return;
    const next = new Set(this.favorisIds());
    const wasFavori = next.has(sortieId);
    if (wasFavori) next.delete(sortieId);
    else next.add(sortieId);
    this.favorisIds.set(next);
    if (wasFavori) await this.favoriService.removeFavori(this.userId(), sortieId);
    else await this.favoriService.addFavori(this.userId(), sortieId);
  }

  async onSupprimer(sortieId: string) {
    if (!this.selectedSortie()) return;
    // La confirmation est demandée dans le tiroir de la sortie.
    const { error } = await this.sortieService.deleteSortie(sortieId);
    if (!error) {
      this.sortiesCreees.set(this.sortiesCreees().filter((s) => s.id !== sortieId));
      this.closeDrawer();
    }
  }

  async onQuitter(sortieId: string) {
    if (!this.selectedSortie()) return;
    const wasWaiting = this.inscriptionStatus() === 'waiting';
    const { error } = await this.inscriptionService.quitter(this.userId(), sortieId);
    if (!error) {
      if (wasWaiting)
        this.sortiesEnAttente.set(this.sortiesEnAttente().filter((s) => s.id !== sortieId));
      else this.sortiesRejointes.set(this.sortiesRejointes().filter((s) => s.id !== sortieId));
      this.inscriptionStatus.set('none');
      this.closeDrawer();
    }
  }

  formatDate(dateStr: string): string {
    const d = new Date(dateStr);
    const j = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
    return j
      .split(' ')
      .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }

  formatDateCourte(dateStr: string): string {
    const d = new Date(dateStr);
    const j = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
    return j
      .split(' ')
      .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }

  formatHeure(dateStr: string): string {
    return new Date(dateStr).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  }
}
