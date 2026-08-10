import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { SortieService } from '../../core/services/sortie.service';
import { ProfileService } from '../../core/services/profile.service';
import { InscriptionService, InscriptionStatus } from '../../core/services/inscription.service';
import { FavoriService } from '../../core/services/favori.service';
import { NavbarFiltersComponent, Filters, ThemeOption } from '../../core/components/navbar-filters/navbar-filters.component';
import { SortieWithRelations } from '../../core/models/sortie.model';
import { SortieDrawerComponent } from '../sorties/sortie-drawer/sortie-drawer.component';

@Component({
  selector: 'app-mes-sorties',
  standalone: true,
  imports: [CommonModule, SortieDrawerComponent, NavbarFiltersComponent],
  templateUrl: './mes-sorties.component.html',
  styleUrl: './mes-sorties.component.scss'
})
export class MesSortiesComponent implements OnInit {
  activeTab: 'creees' | 'rejointes' | 'attente' | 'likees' = 'creees';
  viewMode: 'grid' | 'list' = 'list';
  sortiesCreees: SortieWithRelations[] = [];
  sortiesRejointes: SortieWithRelations[] = [];
  sortiesEnAttente: SortieWithRelations[] = [];
  sortiesLikees: SortieWithRelations[] = [];
  loading = true;
  userId = '';
  userRole = 'user';
  userIsPremium = false;
  organizerUsername = '';
  favorisIds: Set<string> = new Set();
  currentFilters: Filters = { quickPeriod: 'upcoming' };
  availableThemes: ThemeOption[] = [];
  availableLocations: string[] = [];

  selectedSortie: SortieWithRelations | null = null;
  drawerOpen = false;
  inscriptionStatus: InscriptionStatus = 'none';

  constructor(
    private auth: AuthService,
    private sortieService: SortieService,
    private profileService: ProfileService,
    private inscriptionService: InscriptionService,
    private favoriService: FavoriService,
    private router: Router
  ) {}

  async ngOnInit() {
    const { data: { user } } = await this.auth.getUser();
    if (!user) { this.router.navigate(['/login']); return; }
    this.userId = user.id;
    const [profileRes, favoris] = await Promise.all([
      this.profileService.getMyProfile(user.id),
      this.favoriService.getFavoris(user.id)
    ]);
    this.organizerUsername = profileRes.data?.username ?? 'L\'organisateur';
    this.userRole = profileRes.data?.role ?? 'user';
    this.userIsPremium = ['admin', 'developer', 'user_premium'].includes(profileRes.data?.role || '')
      || (!!profileRes.data?.subscription_end_date && new Date(profileRes.data.subscription_end_date) > new Date());
    this.favorisIds = new Set(favoris);
    await this.loadAll();
  }

  async loadAll() {
    this.loading = true;
    const [creees, rejointes, attente, likees] = await Promise.all([
      this.sortieService.getSortiesCreatedBy(this.userId),
      this.sortieService.getSortiesRejointes(this.userId),
      this.sortieService.getSortiesEnAttente(this.userId),
      this.sortieService.getSortiesLikees(this.userId),
    ]);

    this.sortiesCreees = (creees.data ?? []) as SortieWithRelations[];
    this.sortiesRejointes = rejointes;
    this.sortiesEnAttente = attente;
    this.sortiesLikees = likees;

    const all = [...this.sortiesCreees, ...this.sortiesRejointes, ...this.sortiesEnAttente, ...this.sortiesLikees];
    await Promise.all(all.map(async s => {
      if (s.image_url) s.resolvedImageUrl = s.image_url;
      else if (s.theme_id) s.resolvedImageUrl = await this.sortieService.getFirstThemeImage(s.theme_id) ?? undefined;
      s.inscriptionsCount = await this.sortieService.getInscriptionsCount(s.id);
    }));

    // Thèmes et villes disponibles
    const themesMap = new Map<string, ThemeOption>();
    const locationsSet = new Set<string>();
    for (const s of all) {
      if (s.theme_id && s.themes) themesMap.set(s.theme_id, { id: s.theme_id, name: s.themes.name, icon: s.themes.icon });
      if (s.location) locationsSet.add(s.location);
    }
    this.availableThemes = [...themesMap.values()];
    this.availableLocations = [...locationsSet].sort();

    this.loading = false;
  }

  onFiltersChanged(f: Filters) {
    this.currentFilters = f;
  }

  private applyFilters(list: SortieWithRelations[]): SortieWithRelations[] {
    const now = new Date();
    const f = this.currentFilters;
    return list.filter(s => {
      if (f.themeIds?.length && !f.themeIds.includes(s.theme_id ?? '')) return false;
      if (f.ou && s.location !== f.ou) return false;
      if (f.quickPeriod === 'past' && new Date(s.date) >= now) return false;
      if (f.quickPeriod === 'upcoming' && new Date(s.date) < now) return false;
      if (!f.quickPeriod && (f.dateDebut || f.dateFin)) {
        const d = new Date(s.date);
        if (f.dateDebut && d < new Date(f.dateDebut)) return false;
        if (f.dateFin) { const fin = new Date(f.dateFin); fin.setHours(23,59,59); if (d > fin) return false; }
      }
      if (f.prix === 'gratuit' && s.price > 0) return false;
      if (f.prix === 'payant' && s.price === 0) return false;
      if (f.premium && !s.is_premium) return false;
      return true;
    });
  }

  get currentList(): SortieWithRelations[] {
    const base = this.activeTab === 'creees' ? this.sortiesCreees
      : this.activeTab === 'rejointes' ? this.sortiesRejointes
      : this.activeTab === 'attente' ? this.sortiesEnAttente
      : this.sortiesLikees;
    return this.applyFilters(base);
  }

  tabCount(tab: 'creees' | 'rejointes' | 'attente' | 'likees'): number {
    const base = tab === 'creees' ? this.sortiesCreees
      : tab === 'rejointes' ? this.sortiesRejointes
      : tab === 'attente' ? this.sortiesEnAttente
      : this.sortiesLikees;
    return this.applyFilters(base).length;
  }

  async openDrawer(sortie: SortieWithRelations) {
    this.selectedSortie = sortie;
    this.drawerOpen = true;
    this.inscriptionStatus = await this.inscriptionService.getInscriptionStatus(this.userId, sortie.id);
  }

  closeDrawer() { this.drawerOpen = false; this.selectedSortie = null; }

  isFavori(sortieId: string): boolean { return this.favorisIds.has(sortieId); }

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
    this.favorisIds = new Set(this.favorisIds);
  }

  async onSupprimer(sortieId: string) {
    if (!this.selectedSortie) return;
    const confirmed = window.confirm(`Supprimer "${this.selectedSortie.title}" ? Les membres inscrits seront notifiés.`);
    if (!confirmed) return;
    const { error } = await this.sortieService.deleteSortieWithNotifications(sortieId, this.selectedSortie.title, this.organizerUsername);
    if (!error) { this.sortiesCreees = this.sortiesCreees.filter(s => s.id !== sortieId); this.closeDrawer(); }
  }

  async onQuitter(sortieId: string) {
    if (!this.selectedSortie) return;
    const wasWaiting = this.inscriptionStatus === 'waiting';
    const { error } = await this.inscriptionService.quitter(this.userId, sortieId);
    if (!error) {
      if (wasWaiting) this.sortiesEnAttente = this.sortiesEnAttente.filter(s => s.id !== sortieId);
      else this.sortiesRejointes = this.sortiesRejointes.filter(s => s.id !== sortieId);
      this.inscriptionStatus = 'none';
      this.closeDrawer();
    }
  }

  formatDate(dateStr: string): string {
    const d = new Date(dateStr);
    const j = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
    return j.split(' ').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  }

  formatDateCourte(dateStr: string): string {
    const d = new Date(dateStr);
    const j = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
    return j.split(' ').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  }

  formatHeure(dateStr: string): string {
    return new Date(dateStr).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  }
}
