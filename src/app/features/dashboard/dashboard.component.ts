import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { NavbarFiltersComponent, Filters } from '../../core/components/navbar-filters/navbar-filters.component';
import { SortieService } from '../../core/services/sortie.service';
import { SortieWithRelations } from '../../core/models/sortie.model';

export interface SortieGroup {
  dateLabel: string;
  sorties: SortieWithRelations[];
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, NavbarFiltersComponent],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class DashboardComponent implements OnInit {
  sorties: SortieWithRelations[] = [];
  sortiesFiltrees: SortieWithRelations[] = [];
  groupes: SortieGroup[] = [];
  loading = true;
  error = '';
  viewMode: 'grid' | 'list' = 'grid';

  constructor(private sortieService: SortieService) {}

  async ngOnInit() {
    const { data, error } = await this.sortieService.getAllSorties();
    this.loading = false;
    if (error) {
      this.error = `Erreur : ${error.message}`;
      console.error('Supabase error:', error);
      return;
    }
    const sorties = (data as SortieWithRelations[]) ?? [];

    await Promise.all(sorties.map(async s => {
      // Résoudre l'image (fallback vers theme_images)
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
  }

  onFiltersChanged(filters: Filters) {
    this.sortiesFiltrees = this.sorties.filter(s => {
      if (filters.quoi && !s.title.toLowerCase().includes(filters.quoi.toLowerCase()) &&
          !s.themes?.name.toLowerCase().includes(filters.quoi.toLowerCase())) {
        return false;
      }
      if (filters.ou && !s.location.toLowerCase().includes(filters.ou.toLowerCase())) {
        return false;
      }
      if (filters.prix) {
        if (filters.prix === 'gratuit' && s.price > 0) return false;
        if (filters.prix === 'payant' && s.price === 0) return false;
      }
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
