import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { SortieService } from '../../core/services/sortie.service';
import { ProfileService } from '../../core/services/profile.service';
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
  activeTab: 'creees' | 'rejointes' = 'creees';
  sortiesCreees: SortieWithRelations[] = [];
  sortiesRejointes: SortieWithRelations[] = [];
  loading = true;
  userId = '';

  selectedSortie: SortieWithRelations | null = null;
  drawerOpen = false;

  organizerUsername = '';

  constructor(
    private auth: AuthService,
    private sortieService: SortieService,
    private profileService: ProfileService,
    private router: Router
  ) {}

  async ngOnInit() {
    const { data: { user } } = await this.auth.getUser();
    if (!user) { this.router.navigate(['/login']); return; }
    this.userId = user.id;
    const { data: profile } = await this.profileService.getMyProfile(user.id);
    this.organizerUsername = profile?.username ?? 'L\'organisateur';
    await this.loadAll();
  }

  async loadAll() {
    this.loading = true;
    const [creees, rejointes] = await Promise.all([
      this.sortieService.getSortiesCreatedBy(this.userId),
      this.sortieService.getSortiesRejointes(this.userId)
    ]);

    this.sortiesCreees = (creees.data ?? []) as SortieWithRelations[];

    this.sortiesRejointes = ((rejointes.data ?? []) as any[])
      .map((r: any) => r.sorties)
      .filter(Boolean) as SortieWithRelations[];

    this.loading = false;
  }

  openDrawer(sortie: SortieWithRelations) {
    this.selectedSortie = sortie;
    this.drawerOpen = true;
  }

  closeDrawer() {
    this.drawerOpen = false;
    this.selectedSortie = null;
  }

  get currentList(): SortieWithRelations[] {
    return this.activeTab === 'creees' ? this.sortiesCreees : this.sortiesRejointes;
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

  formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      day: 'numeric', month: 'short', year: 'numeric'
    });
  }
}
