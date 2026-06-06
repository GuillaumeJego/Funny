import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavbarFiltersComponent } from '../../core/components/navbar-filters/navbar-filters.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, NavbarFiltersComponent],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class DashboardComponent {

  onFiltersChanged(filters: any) {
    console.log('Filtres appliqués :', filters);
    // On utilisera ces filtres plus tard pour filtrer les sorties
  }
}