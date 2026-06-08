import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule, NavigationStart } from '@angular/router';
import { Subscription } from 'rxjs';
import { NavbarFiltersComponent, Filters, ThemeOption } from '../../core/components/navbar-filters/navbar-filters.component';
import { SortieService } from '../../core/services/sortie.service';
import { FavoriService } from '../../core/services/favori.service';
import { AuthService } from '../../core/services/auth.service';
import { ProfileService } from '../../core/services/profile.service';
import { DrawerService } from '../../core/services/drawer.service';
import { InscriptionService } from '../../core/services/inscription.service';
import { SortieWithRelations } from '../../core/models/sortie.model';
import { SortieDrawerComponent } from '../sorties/sortie-drawer/sortie-drawer.component';

export interface SortieGroup {
  dateLabel: string;
  sorties: SortieWithRelations[];
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, NavbarFiltersComponent, SortieDrawerComponent],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class DashboardComponent implements OnInit, OnDestroy {
  private routerSub!: Subscription;
  private drawerSub!: Subscription;
  sorties: SortieWithRelations[] = [];
  sortiesFiltrees: SortieWithRelations[] = [];
  groupes: SortieGroup[] = [];
  loading = true;
  error = '';
  viewMode: 'grid' | 'list' = 'grid';
  favorisIds: Set<string> = new Set();
  userId = '';
  userRole = 'user';
  selectedSortie: SortieWithRelations | null = null;
  drawerOpen = false;
  isInscrit = false;
  availableThemes: ThemeOption[] = [];
  availableLocations: string[] = [];

  constructor(
    private sortieService: SortieService,
    private favoriService: FavoriService,
    private authService: AuthService,
    private profileService: ProfileService,
    private drawerService: DrawerService,
    private inscriptionService: InscriptionService,
    private router: Router
  ) {}

  ngOnDestroy() {
    this.routerSub?.unsubscribe();
    this.drawerSub?.unsubscribe();
  }

  async ngOnInit() {
    this.routerSub = this.router.events.subscribe(event => {
      if (event instanceof NavigationStart) {
        this.closeDrawer();
      }
    });
    this.drawerSub = this.drawerService.closeAll$.subscribe(() => this.closeDrawer());
    const { data: { user } } = await this.authService.getUser();
    if (user) {
      this.userId = user.id;
      const [favoris, profile] = await Promise.all([
        this.favoriService.getFavoris(user.id),
        this.profileService.getMyProfile(user.id)
      ]);
      this.favorisIds = new Set(favoris);
      if (profile.data?.view_mode) this.viewMode = profile.data.view_mode;
      if (profile.data?.role) this.userRole = profile.data.role;
    }

    const { data, error } = await this.sortieService.getAllSorties();
    this.loading = false;
    if (error) {
      this.error = `Erreur : ${error.message}`;
      console.error('Supabase error:', error);
      return;
    }
    const sorties = (data as SortieWithRelations[]) ?? [];

    await Promise.all(sorties.map(async s => {
      if (s.image_url) {
        s.resolvedImageUrl = s.image_url;
      } else if (s.theme_id) {
        s.resolvedImageUrl = await this.sortieService.getFirstThemeImage(s.theme_id) ?? undefined;
      }
      s.inscriptionsCount = await this.sortieService.getInscriptionsCount(s.id);
    }));

    this.sorties = sorties;
    this.sortiesFiltrees = sorties;
    this.groupes = this.grouperParDate(sorties);

    // Extraire thèmes et villes uniques pour les filtres
    const themesMap = new Map<string, ThemeOption>();
    const locationsSet = new Set<string>();
    for (const s of sorties) {
      if (s.theme_id && s.themes) themesMap.set(s.theme_id, { id: s.theme_id, name: s.themes.name, icon: s.themes.icon });
      if (s.location) locationsSet.add(s.location);
    }
    this.availableThemes = [...themesMap.values()];
    this.availableLocations = [...locationsSet].sort();
  }

  async openDrawer(sortie: SortieWithRelations) {
    this.selectedSortie = sortie;
    this.drawerOpen = true;
    if (this.userId) {
      this.isInscrit = await this.inscriptionService.isInscrit(this.userId, sortie.id);
    }
  }

  closeDrawer() {
    this.drawerOpen = false;
    this.selectedSortie = null;
  }

  async onFavoriFromDrawer(sortieId: string) {
    await this.toggleFavori(new Event('click'), sortieId);
  }

  async onRejoindre(sortieId: string) {
    if (!this.userId) return;
    const { error } = await this.inscriptionService.rejoindre(this.userId, sortieId);
    if (!error) {
      this.isInscrit = true;
      const s = this.sorties.find(s => s.id === sortieId);
      if (s && s.inscriptionsCount !== undefined) s.inscriptionsCount++;
    }
  }

  async onQuitter(sortieId: string) {
    if (!this.userId) return;
    const { error } = await this.inscriptionService.quitter(this.userId, sortieId);
    if (!error) {
      this.isInscrit = false;
      const s = this.sorties.find(s => s.id === sortieId);
      if (s && s.inscriptionsCount !== undefined) s.inscriptionsCount--;
    }
  }

  async toggleFavori(event: Event, sortieId: string) {
    event.stopPropagation();
    if (!this.userId) return;

    if (this.favorisIds.has(sortieId)) {
      this.favorisIds.delete(sortieId);
      await this.favoriService.removeFavori(this.userId, sortieId);
    } else {
      this.favorisIds.add(sortieId);
      await this.favoriService.addFavori(this.userId, sortieId);
    }
    // Forcer la détection de changement
    this.favorisIds = new Set(this.favorisIds);
  }

  isFavori(sortieId: string): boolean {
    return this.favorisIds.has(sortieId);
  }

  onFiltersChanged(filters: Filters) {
    const now = new Date();
    this.sortiesFiltrees = this.sorties.filter(s => {
      if (filters.themeIds?.length && !filters.themeIds.includes(s.theme_id ?? '')) return false;
      if (filters.ou && s.location !== filters.ou) return false;
      if (filters.quickPeriod === 'past' && new Date(s.date) >= now) return false;
      if (filters.quickPeriod === 'upcoming' && new Date(s.date) < now) return false;
      if (!filters.quickPeriod && (filters.dateDebut || filters.dateFin)) {
        const d = new Date(s.date);
        if (filters.dateDebut && d < new Date(filters.dateDebut)) return false;
        if (filters.dateFin) {
          const fin = new Date(filters.dateFin); fin.setHours(23, 59, 59);
          if (d > fin) return false;
        }
      }
      if (filters.prix === 'gratuit' && s.price > 0) return false;
      if (filters.prix === 'payant' && s.price === 0) return false;
      if (filters.premium && !s.is_premium) return false;
      return true;
    });
    this.groupes = this.grouperParDate(this.sortiesFiltrees);
  }

  private grouperParDate(sorties: SortieWithRelations[]): SortieGroup[] {
    const map = new Map<string, SortieWithRelations[]>();
    for (const s of sorties) {
      const d = new Date(s.date);
      const key = d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' });
      const label = key.charAt(0).toUpperCase() + key.slice(1);
      if (!map.has(label)) map.set(label, []);
      map.get(label)!.push(s);
    }
    return Array.from(map.entries()).map(([dateLabel, sorties]) => ({ dateLabel, sorties }));
  }

  async setViewMode(mode: 'grid' | 'list') {
    this.viewMode = mode;
    if (this.userId) {
      await this.profileService.updateProfile(this.userId, { view_mode: mode });
    }
  }

  formatHeure(dateStr: string): string {
    return new Date(dateStr).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  }

  formatDateCourte(dateStr: string): string {
    const d = new Date(dateStr);
    const j = d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
    return j.charAt(0).toUpperCase() + j.slice(1);
  }

  formatDate(dateStr: string): string {
    const d = new Date(dateStr);
    return d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  }
}
