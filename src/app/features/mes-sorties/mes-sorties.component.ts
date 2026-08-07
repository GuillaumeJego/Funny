import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { SortieService } from '../../core/services/sortie.service';
import { ProfileService } from '../../core/services/profile.service';
import { InscriptionService, InscriptionStatus } from '../../core/services/inscription.service';
import { FavoriService } from '../../core/services/favori.service';
import { SortieWithRelations } from '../../core/models/sortie.model';
import { SortieDrawerComponent } from '../sorties/sortie-drawer/sortie-drawer.component';

@Component({
  selector: 'app-mes-sorties',
  standalone: true,
  imports: [CommonModule, SortieDrawerComponent],
  templateUrl: './mes-sorties.component.html',
  styleUrl: './mes-sorties.component.scss'
})
export class MesSortiesComponent implements OnInit {
  activeTab: 'creees' | 'rejointes' | 'attente' = 'creees';
  viewMode: 'grid' | 'list' = 'list';
  sortiesCreees: SortieWithRelations[] = [];
  sortiesRejointes: SortieWithRelations[] = [];
  sortiesEnAttente: SortieWithRelations[] = [];
  loading = true;
  userId = '';
  userRole = 'user';

  selectedSortie: SortieWithRelations | null = null;
  drawerOpen = false;
  inscriptionStatus: InscriptionStatus = 'none';

  organizerUsername = '';

  favorisIds: Set<string> = new Set();

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
    this.favorisIds = new Set(favoris);
    await this.loadAll();
  }

  async loadAll() {
    this.loading = true;
    const [creees, rejointes, attente] = await Promise.all([
      this.sortieService.getSortiesCreatedBy(this.userId),
      this.sortieService.getSortiesRejointes(this.userId),
      this.sortieService.getSortiesEnAttente(this.userId)
    ]);

    const all = [
      ...((creees.data ?? []) as SortieWithRelations[]),
      ...rejointes,
      ...attente
    ];
    await Promise.all(all.map(async s => {
      if (s.image_url) {
        s.resolvedImageUrl = s.image_url;
      } else if (s.theme_id) {
        s.resolvedImageUrl = await this.sortieService.getFirstThemeImage(s.theme_id) ?? undefined;
      }
      s.inscriptionsCount = await this.sortieService.getInscriptionsCount(s.id);
    }));

    this.sortiesCreees = (creees.data ?? []) as SortieWithRelations[];
    this.sortiesRejointes = rejointes;
    this.sortiesEnAttente = attente;

    this.loading = false;
  }

  async openDrawer(sortie: SortieWithRelations) {
    this.selectedSortie = sortie;
    this.drawerOpen = true;
    this.inscriptionStatus = await this.inscriptionService.getInscriptionStatus(this.userId, sortie.id);
  }

  closeDrawer() {
    this.drawerOpen = false;
    this.selectedSortie = null;
  }

  get currentList(): SortieWithRelations[] {
    if (this.activeTab === 'creees') return this.sortiesCreees;
    if (this.activeTab === 'rejointes') return this.sortiesRejointes;
    return this.sortiesEnAttente;
  }

  isFavori(sortieId: string): boolean {
    return this.favorisIds.has(sortieId);
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
    this.favorisIds = new Set(this.favorisIds);
  }

  async onSupprimer(sortieId: string) {
    if (!this.selectedSortie) return;
    const confirmed = window.confirm(`Supprimer la sortie "${this.selectedSortie.title}" ? Les membres inscrits seront notifiés.`);
    if (!confirmed) return;

    const { error } = await this.sortieService.deleteSortieWithNotifications(
      sortieId,
      this.selectedSortie.title,
      this.organizerUsername
    );

    if (!error) {
      this.sortiesCreees = this.sortiesCreees.filter(s => s.id !== sortieId);
      this.closeDrawer();
    }
  }

  async onQuitter(sortieId: string) {
    if (!this.selectedSortie) return;
    const wasWaiting = this.inscriptionStatus === 'waiting';
    const { error } = await this.inscriptionService.quitter(this.userId, sortieId);
    if (!error) {
      if (wasWaiting) {
        this.sortiesEnAttente = this.sortiesEnAttente.filter(s => s.id !== sortieId);
      } else {
        this.sortiesRejointes = this.sortiesRejointes.filter(s => s.id !== sortieId);
      }
      this.inscriptionStatus = 'none';
      this.closeDrawer();
    }
  }

  formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      day: 'numeric', month: 'short', year: 'numeric'
    });
  }

  formatDateCourte(dateStr: string): string {
    const d = new Date(dateStr);
    const j = d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
    return j.charAt(0).toUpperCase() + j.slice(1);
  }

  formatHeure(dateStr: string): string {
    return new Date(dateStr).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  }
}
