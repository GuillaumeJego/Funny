import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { NavbarFiltersComponent, Filters } from '../../core/components/navbar-filters/navbar-filters.component';
import { SortieService } from '../../core/services/sortie.service';
import { SortieWithRelations } from '../../core/models/sortie.model';

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
  loading = true;
  error = '';

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

    // Résoudre l'image pour chaque sortie (fallback vers theme_images)
    await Promise.all(sorties.map(async s => {
      if (s.image_url) {
        s.resolvedImageUrl = s.image_url;
      } else if (s.theme_id) {
        s.resolvedImageUrl = await this.sortieService.getFirstThemeImage(s.theme_id) ?? undefined;
      }
    }));

    this.sorties = sorties;
    this.sortiesFiltrees = sorties;
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
  }

  formatDate(dateStr: string): string {
    const d = new Date(dateStr);
    return d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  }
}
