import { Component, EventEmitter, HostListener, Input, OnChanges, OnDestroy, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';
import { GeoService, GeoPlace } from '../../services/geo.service';

export interface Filters {
  themeIds?: string[];
  ou?: string;
  dateDebut?: string;
  dateFin?: string;
  quickPeriod?: string; // 'past' | 'upcoming'
  prix?: string;
  premium?: boolean;
}

export interface ThemeOption {
  id: string;
  name: string;
  icon: string;
}

@Component({
  selector: 'app-navbar-filters',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './navbar-filters.component.html',
  styleUrl: './navbar-filters.component.scss'
})
export class NavbarFiltersComponent implements OnChanges, OnDestroy {
  @Input() availableThemes: ThemeOption[] = [];
  @Input() availableLocations: string[] = [];
  @Output() filtersChanged = new EventEmitter<Filters>();

  filters: Filters = { quickPeriod: 'upcoming' };
  openPanel: string | null = null;

  // État temporaire
  selectedThemeIds: Set<string> = new Set();
  dateDebut = '';
  dateFin = '';
  quickPeriod = 'upcoming';

  // Autocomplete lieu
  locationQuery = '';
  locationSuggestions: GeoPlace[] = [];
  locationSearching = false;
  private locationSearch$ = new Subject<string>();
  private locationSub!: Subscription;

  constructor(private geo: GeoService) {}

  ngOnInit() {
    this.locationSub = this.locationSearch$.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      switchMap(q => {
        this.locationSearching = true;
        return this.geo.searchCities(q);
      })
    ).subscribe(places => {
      this.locationSuggestions = places;
      this.locationSearching = false;
    });
  }

  ngOnChanges() {}

  ngOnDestroy() { this.locationSub?.unsubscribe(); }

  onLocationInput() { this.locationSearch$.next(this.locationQuery); }

  get activeCount(): number {
    let n = 0;
    if (this.filters.themeIds?.length) n++;
    if (this.filters.ou) n++;
    if (this.filters.dateDebut || this.filters.dateFin || this.filters.quickPeriod) n++;
    if (this.filters.prix) n++;
    if (this.filters.premium) n++;
    return n;
  }

  get quoiLabel(): string {
    const n = this.filters.themeIds?.length ?? 0;
    if (n === 0) return 'Quoi ?';
    if (n === 1) {
      const t = this.availableThemes.find(t => t.id === this.filters.themeIds![0]);
      return t ? `${t.icon} ${t.name}` : '1 thème';
    }
    return `${n} thèmes`;
  }

  get quandLabel(): string {
    if (this.filters.quickPeriod === 'past') return '📅 Passées';
    if (this.filters.quickPeriod === 'upcoming') return '🔜 À venir';
    const d = this.filters.dateDebut;
    const f = this.filters.dateFin;
    if (!d && !f) return 'Quand ?';
    const fmt = (s: string) => new Date(s).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
    if (d && f && d === f) return fmt(d);
    if (d && f) return `${fmt(d)} → ${fmt(f)}`;
    if (d) return `Dès ${fmt(d)}`;
    return `Jusqu'au ${fmt(f!)}`;
  }

  togglePanel(panel: string) {
    if (this.openPanel === panel) {
      this.openPanel = null;
    } else {
      this.openPanel = panel;
      // Sync état temporaire
      if (panel === 'quoi') this.selectedThemeIds = new Set(this.filters.themeIds ?? []);
      if (panel === 'quand') { this.dateDebut = this.filters.dateDebut ?? ''; this.dateFin = this.filters.dateFin ?? ''; }
      if (panel === 'ou') { this.locationQuery = this.filters.ou ?? ''; this.locationSuggestions = []; }
    }
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    if (!(event.target as HTMLElement).closest('app-navbar-filters')) {
      this.openPanel = null;
    }
  }

  // ── Thèmes ────────────────────────────────────────────────
  toggleTheme(id: string) {
    if (this.selectedThemeIds.has(id)) this.selectedThemeIds.delete(id);
    else this.selectedThemeIds.add(id);
  }

  applyThemes() {
    this.filters = { ...this.filters, themeIds: this.selectedThemeIds.size ? [...this.selectedThemeIds] : undefined };
    this.emit();
    this.openPanel = null;
  }

  clearThemes() {
    this.selectedThemeIds.clear();
    this.filters = { ...this.filters, themeIds: undefined };
    this.emit();
    this.openPanel = null;
  }

  // ── Lieu ──────────────────────────────────────────────────
  setOuDirect(loc: string) {
    this.filters = { ...this.filters, ou: loc };
    this.locationQuery = loc;
    this.locationSuggestions = [];
    this.emit();
    this.openPanel = null;
  }

  setOu(place: GeoPlace) {
    this.filters = { ...this.filters, ou: place.city };
    this.locationQuery = place.city;
    this.locationSuggestions = [];
    this.emit();
    this.openPanel = null;
  }

  clearOu() {
    this.filters = { ...this.filters, ou: undefined };
    this.locationQuery = '';
    this.locationSuggestions = [];
    this.emit();
    this.openPanel = null;
  }

  // ── Dates ─────────────────────────────────────────────────
  setQuickPeriod(period: string) {
    this.quickPeriod = period;
    const now = new Date();
    const toISO = (d: Date) => d.toISOString().split('T')[0];

    if (period === 'past' || period === 'upcoming') {
      // Gérés côté dashboard via filters.quickPeriod
      this.dateDebut = '';
      this.dateFin = '';
    } else if (period === 'today') {
      this.dateDebut = toISO(now);
      this.dateFin = toISO(now);
    } else if (period === 'week') {
      const end = new Date(now); end.setDate(now.getDate() + 6);
      this.dateDebut = toISO(now);
      this.dateFin = toISO(end);
    } else if (period === 'month') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      this.dateDebut = toISO(start);
      this.dateFin = toISO(end);
    }
  }

  applyDates() {
    this.filters = {
      ...this.filters,
      dateDebut: this.dateDebut || undefined,
      dateFin: this.dateFin || undefined,
      quickPeriod: (this.quickPeriod === 'past' || this.quickPeriod === 'upcoming') ? this.quickPeriod : undefined,
    };
    this.emit();
    this.openPanel = null;
  }

  clearDates() {
    this.dateDebut = '';
    this.dateFin = '';
    this.quickPeriod = '';
    this.filters = { ...this.filters, dateDebut: undefined, dateFin: undefined, quickPeriod: undefined };
    this.emit();
    this.openPanel = null;
  }

  // ── Prix ──────────────────────────────────────────────────
  setPrix(value: string) {
    this.filters = { ...this.filters, prix: value };
    this.emit();
    this.openPanel = null;
  }

  clearPrix() {
    this.filters = { ...this.filters, prix: undefined };
    this.emit();
    this.openPanel = null;
  }

  // ── Premium ───────────────────────────────────────────────
  togglePremium() {
    this.filters = { ...this.filters, premium: !this.filters.premium };
    this.emit();
  }

  // ── Reset ─────────────────────────────────────────────────
  resetFilters() {
    this.filters = {};
    this.selectedThemeIds.clear();
    this.dateDebut = '';
    this.dateFin = '';
    this.emit();
    this.openPanel = null;
  }

  private emit() { this.filtersChanged.emit(this.filters); }
}
