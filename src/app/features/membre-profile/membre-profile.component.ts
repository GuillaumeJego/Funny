import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { ProfileService } from '../../core/services/profile.service';
import { SortieService } from '../../core/services/sortie.service';
import { SettingsService } from '../../core/services/settings.service';
import { NavbarFiltersComponent, Filters, ThemeOption } from '../../core/components/navbar-filters/navbar-filters.component';
import { SortieDrawerComponent } from '../sorties/sortie-drawer/sortie-drawer.component';
import { Profile } from '../../core/models/profile.model';
import { SortieWithRelations } from '../../core/models/sortie.model';
import { InscriptionService, InscriptionStatus } from '../../core/services/inscription.service';
import { FavoriService } from '../../core/services/favori.service';

type TabKey = 'organisees' | 'rejointes' | 'attente' | 'likees';

@Component({
  selector: 'app-membre-profile',
  standalone: true,
  imports: [CommonModule, RouterModule, NavbarFiltersComponent, SortieDrawerComponent],
  templateUrl: './membre-profile.component.html',
  styleUrl: './membre-profile.component.scss'
})
export class MembreProfileComponent implements OnInit {
  profile: Profile | null = null;
  loading = true;
  accessDenied = false;
  isOwnProfile = false;

  activeTab: TabKey = 'organisees';
  viewMode: 'grid' | 'list' = 'list';
  currentFilters: Filters = { quickPeriod: 'upcoming' };
  availableThemes: ThemeOption[] = [];
  availableLocations: string[] = [];

  sortiesOrganisees: SortieWithRelations[] = [];
  sortiesRejointes: SortieWithRelations[] = [];
  sortiesAttente: SortieWithRelations[] = [];
  sortiesLikees: SortieWithRelations[] = [];

  selectedSortie: SortieWithRelations | null = null;
  drawerOpen = false;
  viewerUserId = '';
  viewerRole = 'user';
  viewerIsPremium = false;
  viewerFavoris: Set<string> = new Set();
  inscriptionStatus: InscriptionStatus = 'none';

  tabs: { key: TabKey; label: string; icon: string }[] = [
    { key: 'organisees', label: 'Organisées', icon: '📋' },
    { key: 'rejointes',  label: 'Rejointes',  icon: '✅' },
    { key: 'attente',    label: 'En attente', icon: '⏳' },
    { key: 'likees',     label: 'Likées',     icon: '❤️' },
  ];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private auth: AuthService,
    private profileService: ProfileService,
    private sortieService: SortieService,
    private settingsService: SettingsService,
    private inscriptionService: InscriptionService,
    private favoriService: FavoriService
  ) {}

  async ngOnInit() {
    const targetId = this.route.snapshot.paramMap.get('id');
    if (!targetId) { this.router.navigate(['/membres']); return; }

    const { data: { user } } = await this.auth.getUser();
    if (!user) { this.router.navigate(['/login']); return; }

    this.viewerUserId = user.id;
    this.isOwnProfile = user.id === targetId;

    const { data: viewerProfile } = await this.profileService.getMyProfile(user.id);
    if (viewerProfile) {
      this.viewerRole = viewerProfile.role ?? 'user';
      this.viewerIsPremium = ['admin', 'developer', 'user_premium'].includes(viewerProfile.role ?? '')
        || (!!viewerProfile.subscription_end_date && new Date(viewerProfile.subscription_end_date) > new Date());
      if (!this.isOwnProfile) {
        const canView = await this.settingsService.canViewProfiles(viewerProfile);
        if (!canView) { this.accessDenied = true; this.loading = false; return; }
      }
    }

    const favorisIds = await this.favoriService.getFavoris(user.id);
    this.viewerFavoris = new Set(favorisIds);

    const [profileRes, organisees, rejointes, attente, likees] = await Promise.all([
      this.profileService.getProfileById(targetId),
      this.sortieService.getSortiesCreatedBy(targetId),
      this.sortieService.getSortiesRejointes(targetId),
      this.sortieService.getSortiesEnAttente(targetId),
      this.sortieService.getSortiesLikees(targetId),
    ]);

    this.profile = profileRes.data as Profile;
    this.sortiesOrganisees = (organisees.data ?? []) as SortieWithRelations[];
    this.sortiesRejointes = rejointes;
    this.sortiesAttente = attente;
    this.sortiesLikees = likees;

    // Résoudre images + inscriptionsCount
    const all = [...this.sortiesOrganisees, ...this.sortiesRejointes, ...this.sortiesAttente, ...this.sortiesLikees];
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

  onFiltersChanged(f: Filters) { this.currentFilters = f; }

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
    const base = this.activeTab === 'organisees' ? this.sortiesOrganisees
      : this.activeTab === 'rejointes' ? this.sortiesRejointes
      : this.activeTab === 'attente'   ? this.sortiesAttente
      : this.sortiesLikees;
    return this.applyFilters(base);
  }

  countFor(tab: TabKey): number {
    const base = tab === 'organisees' ? this.sortiesOrganisees
      : tab === 'rejointes' ? this.sortiesRejointes
      : tab === 'attente'   ? this.sortiesAttente
      : this.sortiesLikees;
    return this.applyFilters(base).length;
  }

  isPremium(): boolean {
    if (!this.profile?.subscription_end_date) return false;
    return new Date(this.profile.subscription_end_date) > new Date();
  }

  getInitial(username: string): string { return username.charAt(0).toUpperCase(); }

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

  goBack() { window.history.back(); }

  async openDrawer(sortie: SortieWithRelations) {
    this.selectedSortie = sortie;
    this.drawerOpen = true;
    this.inscriptionStatus = await this.inscriptionService.getInscriptionStatus(this.viewerUserId, sortie.id);
  }

  closeDrawer() {
    this.drawerOpen = false;
    this.selectedSortie = null;
  }

  isFavori(id: string): boolean { return this.viewerFavoris.has(id); }

  async onFavoriFromDrawer(sortieId: string) {
    if (this.isFavori(sortieId)) {
      this.viewerFavoris.delete(sortieId);
      await this.favoriService.removeFavori(this.viewerUserId, sortieId);
    } else {
      this.viewerFavoris.add(sortieId);
      await this.favoriService.addFavori(this.viewerUserId, sortieId);
    }
    this.viewerFavoris = new Set(this.viewerFavoris);
  }

  async onRejoindre(sortieId: string) {
    await this.inscriptionService.rejoindre(sortieId, this.viewerUserId);
    this.inscriptionStatus = await this.inscriptionService.getInscriptionStatus(this.viewerUserId, sortieId);
    if (this.selectedSortie) {
      this.selectedSortie.inscriptionsCount = await this.sortieService.getInscriptionsCount(sortieId);
    }
  }

  async onQuitter(sortieId: string) {
    await this.inscriptionService.quitter(sortieId, this.viewerUserId);
    this.inscriptionStatus = 'none';
    if (this.selectedSortie) {
      this.selectedSortie.inscriptionsCount = await this.sortieService.getInscriptionsCount(sortieId);
    }
  }
}
