import {
  Component,
  HostListener,
  OnDestroy,
  OnInit,
  ChangeDetectionStrategy,
  inject,
  input,
  output,
  signal,
  computed,
} from '@angular/core';

import { FormsModule } from '@angular/forms';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';
import { GeoService, GeoPlace } from '../../services/geo.service';
import { ClickableDirective } from '../../directives/clickable.directive';

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
  imports: [ClickableDirective, FormsModule],
  templateUrl: './navbar-filters.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './navbar-filters.component.scss',
})
export class NavbarFiltersComponent implements OnInit, OnDestroy {
  private geo = inject(GeoService);

  readonly availableThemes = input<ThemeOption[]>([]);
  readonly availableLocations = input<string[]>([]);
  readonly filtersChanged = output<Filters>();

  readonly filters = signal<Filters>({ quickPeriod: 'upcoming' });
  readonly openPanel = signal<string | null>(null);

  // État temporaire
  readonly selectedThemeIds = signal<Set<string>>(new Set());
  readonly dateDebut = signal('');
  readonly dateFin = signal('');
  readonly quickPeriod = signal('upcoming');

  // Autocomplete lieu
  readonly locationQuery = signal('');
  readonly locationSuggestions = signal<GeoPlace[]>([]);
  readonly locationSearching = signal(false);
  private locationSearch$ = new Subject<string>();
  private locationSub!: Subscription;

  ngOnInit() {
    this.locationSub = this.locationSearch$
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        switchMap((q) => {
          this.locationSearching.set(true);
          return this.geo.searchCities(q);
        }),
      )
      .subscribe((places) => {
        this.locationSuggestions.set(places);
        this.locationSearching.set(false);
      });
  }

  ngOnDestroy() {
    this.locationSub?.unsubscribe();
  }

  onLocationInput() {
    this.locationSearch$.next(this.locationQuery());
  }

  readonly activeCount = computed<number>(() => {
    let n = 0;
    if (this.filters().themeIds?.length) n++;
    if (this.filters().ou) n++;
    if (this.filters().dateDebut || this.filters().dateFin || this.filters().quickPeriod) n++;
    if (this.filters().prix) n++;
    if (this.filters().premium) n++;
    return n;
  });

  readonly quoiLabel = computed<string>(() => {
    const n = this.filters().themeIds?.length ?? 0;
    if (n === 0) return 'Quoi ?';
    if (n === 1) {
      const t = this.availableThemes().find((t) => t.id === this.filters().themeIds![0]);
      return t ? `${t.icon} ${t.name}` : '1 thème';
    }
    return `${n} thèmes`;
  });

  readonly quandLabel = computed<string>(() => {
    if (this.filters().quickPeriod === 'past') return '📅 Passées';
    if (this.filters().quickPeriod === 'upcoming') return '🔜 À venir';
    const d = this.filters().dateDebut;
    const f = this.filters().dateFin;
    if (!d && !f) return 'Quand ?';
    const fmt = (s: string) =>
      new Date(s).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
    if (d && f && d === f) return fmt(d);
    if (d && f) return `${fmt(d)} → ${fmt(f)}`;
    if (d) return `Dès ${fmt(d)}`;
    return `Jusqu'au ${fmt(f!)}`;
  });

  togglePanel(panel: string) {
    if (this.openPanel() === panel) {
      this.openPanel.set(null);
    } else {
      this.openPanel.set(panel);
      // Sync état temporaire
      if (panel === 'quoi') this.selectedThemeIds.set(new Set(this.filters().themeIds ?? []));
      if (panel === 'quand') {
        this.dateDebut.set(this.filters().dateDebut ?? '');
        this.dateFin.set(this.filters().dateFin ?? '');
      }
      if (panel === 'ou') {
        this.locationQuery.set(this.filters().ou ?? '');
        this.locationSuggestions.set([]);
      }
    }
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    if (!(event.target as HTMLElement).closest('app-navbar-filters')) {
      this.openPanel.set(null);
    }
  }

  // ── Thèmes ────────────────────────────────────────────────
  toggleTheme(id: string) {
    const next = new Set(this.selectedThemeIds());
    if (next.has(id)) next.delete(id);
    else next.add(id);
    this.selectedThemeIds.set(next);
  }

  applyThemes() {
    this.filters.set({
      ...this.filters(),
      themeIds: this.selectedThemeIds().size ? [...this.selectedThemeIds()] : undefined,
    });
    this.emit();
    this.openPanel.set(null);
  }

  clearThemes() {
    this.selectedThemeIds.set(new Set());
    this.filters.set({ ...this.filters(), themeIds: undefined });
    this.emit();
    this.openPanel.set(null);
  }

  // ── Lieu ──────────────────────────────────────────────────
  setOuDirect(loc: string) {
    this.filters.set({ ...this.filters(), ou: loc });
    this.locationQuery.set(loc);
    this.locationSuggestions.set([]);
    this.emit();
    this.openPanel.set(null);
  }

  setOu(place: GeoPlace) {
    this.filters.set({ ...this.filters(), ou: place.city });
    this.locationQuery.set(place.city);
    this.locationSuggestions.set([]);
    this.emit();
    this.openPanel.set(null);
  }

  clearOu() {
    this.filters.set({ ...this.filters(), ou: undefined });
    this.locationQuery.set('');
    this.locationSuggestions.set([]);
    this.emit();
    this.openPanel.set(null);
  }

  // ── Dates ─────────────────────────────────────────────────
  setQuickPeriod(period: string) {
    this.quickPeriod.set(period);
    const now = new Date();
    const toISO = (d: Date) => d.toISOString().split('T')[0];

    if (period === 'past' || period === 'upcoming') {
      // Gérés côté dashboard via filters.quickPeriod
      this.dateDebut.set('');
      this.dateFin.set('');
    } else if (period === 'today') {
      this.dateDebut.set(toISO(now));
      this.dateFin.set(toISO(now));
    } else if (period === 'week') {
      const end = new Date(now);
      end.setDate(now.getDate() + 6);
      this.dateDebut.set(toISO(now));
      this.dateFin.set(toISO(end));
    } else if (period === 'month') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      this.dateDebut.set(toISO(start));
      this.dateFin.set(toISO(end));
    }
  }

  applyDates() {
    this.filters.set({
      ...this.filters(),
      dateDebut: this.dateDebut() || undefined,
      dateFin: this.dateFin() || undefined,
      quickPeriod:
        this.quickPeriod() === 'past' || this.quickPeriod() === 'upcoming'
          ? this.quickPeriod()
          : undefined,
    });
    this.emit();
    this.openPanel.set(null);
  }

  clearDates() {
    this.dateDebut.set('');
    this.dateFin.set('');
    this.quickPeriod.set('');
    this.filters.set({
      ...this.filters(),
      dateDebut: undefined,
      dateFin: undefined,
      quickPeriod: undefined,
    });
    this.emit();
    this.openPanel.set(null);
  }

  // ── Prix ──────────────────────────────────────────────────
  setPrix(value: string) {
    this.filters.set({ ...this.filters(), prix: value });
    this.emit();
    this.openPanel.set(null);
  }

  clearPrix() {
    this.filters.set({ ...this.filters(), prix: undefined });
    this.emit();
    this.openPanel.set(null);
  }

  // ── Premium ───────────────────────────────────────────────
  togglePremium() {
    this.filters.set({ ...this.filters(), premium: !this.filters().premium });
    this.emit();
  }

  // ── Reset ─────────────────────────────────────────────────
  resetFilters() {
    this.filters.set({});
    this.selectedThemeIds.set(new Set());
    this.dateDebut.set('');
    this.dateFin.set('');
    this.emit();
    this.openPanel.set(null);
  }

  private emit() {
    this.filtersChanged.emit(this.filters());
  }
}
