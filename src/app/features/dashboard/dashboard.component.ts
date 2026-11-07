import {
  Component,
  OnInit,
  OnDestroy,
  ChangeDetectionStrategy,
  inject,
  signal,
  computed,
} from '@angular/core';

import { ActivatedRoute, Router, RouterModule, NavigationStart } from '@angular/router';
import { Subscription } from 'rxjs';
import {
  NavbarFiltersComponent,
  Filters,
  matchesPeriod,
  ThemeOption,
} from '../../core/components/navbar-filters/navbar-filters.component';
import { SortieService } from '../../core/services/sortie.service';
import { FavoriService } from '../../core/services/favori.service';
import { AuthService } from '../../core/services/auth.service';
import { ProfileService } from '../../core/services/profile.service';
import { DrawerService } from '../../core/services/drawer.service';
import { InscriptionService, InscriptionStatus } from '../../core/services/inscription.service';
import { SortieWithRelations } from '../../core/models/sortie.model';
import { SortieDrawerComponent } from '../sorties/sortie-drawer/sortie-drawer.component';
import { isPremiumMember } from '../../core/utils/premium';
import { ClickableDirective } from '../../core/directives/clickable.directive';

export interface SortieGroup {
  dateLabel: string;
  sorties: SortieWithRelations[];
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [ClickableDirective, RouterModule, NavbarFiltersComponent, SortieDrawerComponent],
  templateUrl: './dashboard.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent implements OnInit, OnDestroy {
  private sortieService = inject(SortieService);
  private favoriService = inject(FavoriService);
  private authService = inject(AuthService);
  private profileService = inject(ProfileService);
  private drawerService = inject(DrawerService);
  private inscriptionService = inject(InscriptionService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  private routerSub!: Subscription;
  private drawerSub!: Subscription;
  private querySub?: Subscription;
  readonly sorties = signal<SortieWithRelations[]>([]);
  /** Filtres choisis dans la barre : la liste affichée en découle. */
  readonly filters = signal<Filters>({});
  readonly loading = signal(true);
  readonly error = signal('');
  /** Petit message au-dessus de la liste (ex. sortie d'une notification introuvable). */
  readonly notice = signal('');
  readonly viewMode = signal<'grid' | 'list'>('grid');
  readonly favorisIds = signal<Set<string>>(new Set());
  readonly userId = signal('');
  readonly userRole = signal('user');
  readonly userIsPremium = signal(false);
  readonly selectedSortie = signal<SortieWithRelations | null>(null);
  readonly drawerOpen = signal(false);
  readonly inscriptionStatus = signal<InscriptionStatus>('none');
  readonly availableThemes = signal<ThemeOption[]>([]);
  readonly availableLocations = signal<string[]>([]);

  ngOnDestroy() {
    this.routerSub?.unsubscribe();
    this.drawerSub?.unsubscribe();
    this.querySub?.unsubscribe();
  }

  async ngOnInit() {
    this.routerSub = this.router.events.subscribe((event) => {
      // Rester sur le tableau de bord (ex. ?sortie=… d'une notification) ne ferme pas la fiche.
      if (event instanceof NavigationStart && !event.url.startsWith('/dashboard')) {
        this.closeDrawer();
      }
    });
    this.drawerSub = this.drawerService.closeAll$.subscribe(() => this.closeDrawer());
    const {
      data: { user },
    } = await this.authService.getUser();
    if (user) {
      this.userId.set(user.id);
      const [favoris, profile] = await Promise.all([
        this.favoriService.getFavoris(user.id),
        this.profileService.getMyProfile(user.id),
      ]);
      this.favorisIds.set(new Set(favoris));
      if (profile.data?.view_mode) this.viewMode.set(profile.data.view_mode);
      if (profile.data?.role) this.userRole.set(profile.data.role);
      this.userIsPremium.set(isPremiumMember(profile.data));
    }

    const { data, error } = await this.sortieService.getAllSorties();
    this.loading.set(false);
    if (error) {
      this.error.set(`Erreur : ${error.message}`);
      console.error('Erreur de chargement des sorties :', error);
      return;
    }
    const sorties = (data as SortieWithRelations[]) ?? [];

    this.sorties.set(sorties);

    // Extraire thèmes et villes uniques pour les filtres
    const themesMap = new Map<string, ThemeOption>();
    const locationsSet = new Set<string>();
    for (const s of sorties) {
      if (s.theme_id && s.themes)
        themesMap.set(s.theme_id, { id: s.theme_id, name: s.themes.name, icon: s.themes.icon });
      if (s.location) locationsSet.add(s.location);
    }
    this.availableThemes.set([...themesMap.values()]);
    this.availableLocations.set([...locationsSet].sort());

    // Lien d'une notification : /dashboard?sortie=<id> ouvre directement la fiche de la sortie.
    this.querySub = this.route.queryParamMap.subscribe((params) => {
      const id = params.get('sortie');
      if (id) this.openFromLink(id);
    });
  }

  private async openFromLink(id: string) {
    const sortie =
      this.sorties().find((s) => s.id === id) ?? (await this.sortieService.getSortie(id));
    // On retire ?sortie= de l'adresse : la même notification pourra rouvrir la fiche plus tard.
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { sortie: null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
    if (sortie) {
      this.openDrawer(sortie);
    } else {
      this.notice.set("Cette sortie n'existe plus ou n'est plus visible.");
    }
  }

  async openDrawer(sortie: SortieWithRelations) {
    this.selectedSortie.set(sortie);
    this.drawerOpen.set(true);
    if (this.userId()) {
      this.inscriptionStatus.set(
        await this.inscriptionService.getInscriptionStatus(this.userId(), sortie.id),
      );
    }
  }

  closeDrawer() {
    this.drawerOpen.set(false);
    this.selectedSortie.set(null);
  }

  async onFavoriFromDrawer(sortieId: string) {
    await this.toggleFavori(new Event('click'), sortieId);
  }

  async onRejoindre(sortieId: string) {
    if (!this.userId()) return;
    const { error, status } = await this.inscriptionService.rejoindre(this.userId(), sortieId);
    if (!error && status) {
      this.inscriptionStatus.set(status);
      if (status === 'pending') {
        this.adjustInscriptions(sortieId, 1);
      }
    }
  }

  async onQuitter(sortieId: string) {
    if (!this.userId()) return;
    const wasWaiting = this.inscriptionStatus() === 'waiting';
    const { error } = await this.inscriptionService.quitter(this.userId(), sortieId);
    if (!error) {
      this.inscriptionStatus.set('none');
      if (!wasWaiting) {
        this.adjustInscriptions(sortieId, -1);
      }
    }
  }

  /** Met à jour le nombre d'inscrits d'une sortie, dans la liste et dans le tiroir. */
  private adjustInscriptions(sortieId: string, delta: number) {
    const bump = (s: SortieWithRelations) =>
      s.id === sortieId && s.inscriptionsCount !== undefined
        ? { ...s, inscriptionsCount: s.inscriptionsCount + delta }
        : s;
    this.sorties.set(this.sorties().map(bump));
    this.selectedSortie.update((s) => (s ? bump(s) : s));
  }

  async onSupprimer(sortieId: string) {
    if (!this.userId() || !this.selectedSortie()) return;
    // La confirmation est demandée dans le tiroir de la sortie.

    const { error } = await this.sortieService.deleteSortie(sortieId);

    if (!error) {
      this.sorties.set(this.sorties().filter((s) => s.id !== sortieId));
      this.onFiltersChanged({
        themeIds: [],
        ou: '',
        quickPeriod: '',
        dateDebut: '',
        dateFin: '',
        prix: '',
        premium: false,
      });
      this.closeDrawer();
    }
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

  isFavori(sortieId: string): boolean {
    return this.favorisIds().has(sortieId);
  }

  onFiltersChanged(filters: Filters) {
    this.filters.set(filters);
  }

  readonly sortiesFiltrees = computed<SortieWithRelations[]>(() => {
    const filters = this.filters();
    const now = new Date();
    return this.sorties().filter((s) => {
      if (filters.themeIds?.length && !filters.themeIds.includes(s.theme_id ?? '')) return false;
      if (filters.ou && s.location !== filters.ou) return false;
      if (!matchesPeriod(s.date, filters, now)) return false;
      // Prix inconnu pour une sortie Premium vue en aperçu : elle sort du filtre de prix.
      if (filters.prix && s.locked) return false;
      if (filters.prix === 'gratuit' && s.price > 0) return false;
      if (filters.prix === 'payant' && s.price === 0) return false;
      if (filters.premium && !s.is_premium) return false;
      return true;
    });
  });

  readonly groupes = computed<SortieGroup[]>(() => {
    return this.grouperParDate(this.sortiesFiltrees());
  });

  private grouperParDate(sorties: SortieWithRelations[]): SortieGroup[] {
    const map = new Map<string, SortieWithRelations[]>();
    for (const s of sorties) {
      const d = new Date(s.date);
      const key = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
      const label = key
        .split(' ')
        .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
      if (!map.has(label)) map.set(label, []);
      map.get(label)!.push(s);
    }
    return Array.from(map.entries()).map(([dateLabel, sorties]) => ({ dateLabel, sorties }));
  }

  async setViewMode(mode: 'grid' | 'list') {
    this.viewMode.set(mode);
    if (this.userId()) {
      await this.profileService.updateMyProfile(this.userId(), { view_mode: mode });
    }
  }

  formatHeure(dateStr: string): string {
    return new Date(dateStr).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  }

  formatDateCourte(dateStr: string): string {
    const d = new Date(dateStr);
    const j = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
    return j
      .split(' ')
      .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }

  formatDate(dateStr: string): string {
    const d = new Date(dateStr);
    const j = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
    const label = j
      .split(' ')
      .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
    return `${label} - ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
  }
}
