import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface Filters {
  quoi?: string;
  ou?: string;
  quand?: string;
  prix?: string;
  premium?: boolean;
}

@Component({
  selector: 'app-navbar-filters',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './navbar-filters.component.html',
  styleUrl: './navbar-filters.component.scss'
})
export class NavbarFiltersComponent {
  @Output() filtersChanged = new EventEmitter<Filters>();

  filters: Filters = {};
  showAllFilters = false;

  applyFilter(type: string, value: string) {
    this.filters = { ...this.filters, [type]: value };
    this.filtersChanged.emit(this.filters);
  }

  togglePremium() {
    this.filters = { ...this.filters, premium: !this.filters.premium };
    this.filtersChanged.emit(this.filters);
  }

  toggleAllFilters() {
    this.showAllFilters = !this.showAllFilters;
  }

  resetFilters() {
    this.filters = {};
    this.filtersChanged.emit(this.filters);
  }
}