import {
  Component,
  HostListener,
  ChangeDetectionStrategy,
  input,
  output,
  signal,
  computed,
} from '@angular/core';

import { FormsModule } from '@angular/forms';
import { ClickableDirective } from '../../directives/clickable.directive';
import { townsOf } from '../../utils/towns';

export interface Filters {
  themeIds?: string[];
  /** Ville choisie dans « Où ? » (voir inTown). */
  ou?: string;
  /** « Autour de moi » : rayon en km et position du membre. */
  autour?: { km: number; lat: number; lng: number };
  dateDebut?: string;
  dateFin?: string;
  quickPeriod?: string; // 'past' : sorties passées ; sinon, seulement les sorties à venir
  prix?: string;
  premium?: boolean;
}

/**
 * La date d'une sortie passe-t-elle le filtre « Quand ? » ? Par défaut, seules les sorties
 * à venir s'affichent ; les sorties passées demandent le filtre « Sorties passées », ou une
 * plage de dates qui commence avant aujourd'hui.
 */
export function matchesPeriod(dateIso: string, f: Filters, now = new Date()): boolean {
  const date = new Date(dateIso);
  if (f.quickPeriod === 'past') return date < now;
  if (f.dateDebut && date < new Date(f.dateDebut)) return false;
  if (f.dateFin) {
    const fin = new Date(f.dateFin);
    fin.setHours(23, 59, 59);
    if (date > fin) return false;
  }
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const rangeReachesPast = !!f.dateDebut && new Date(f.dateDebut) < today;
  return rangeReachesPast || date >= now;
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
export class NavbarFiltersComponent {
  readonly availableThemes = input<ThemeOption[]>([]);
  readonly availableLocations = input<string[]>([]);
  /** Propose « Autour de moi » (sorties avec position connue). */
  readonly distanceEnabled = input(false);
  readonly filtersChanged = output<Filters>();

  readonly filters = signal<Filters>({});
  readonly openPanel = signal<string | null>(null);

  // État temporaire
  readonly selectedThemeIds = signal<Set<string>>(new Set());
  readonly dateDebut = signal('');
  readonly dateFin = signal('');
  readonly quickPeriod = signal('');

  // Où ? : villes des sorties et rayon autour de moi
  readonly towns = computed(() => townsOf(this.availableLocations()));
  readonly radiusOptions = [5, 10, 20, 50];
  readonly locating = signal(false);
  readonly locateError = signal(false);

  readonly ouLabel = computed<string>(() => {
    const f = this.filters();
    if (f.autour) return `< ${f.autour.km} km`;
    return f.ou || 'Où ?';
  });

  readonly activeCount = computed<number>(() => {
    let n = 0;
    if (this.filters().themeIds?.length) n++;
    if (this.filters().ou || this.filters().autour) n++;
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
      if (panel === 'ou') this.locateError.set(false);
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
  /** Une ville à la fois : la choisir remplace le rayon « autour de moi ». */
  setTown(town: string) {
    const same = this.filters().ou === town;
    this.filters.set({ ...this.filters(), ou: same ? undefined : town, autour: undefined });
    this.emit();
    this.openPanel.set(null);
  }

  /** Rayon autour de moi : demande la position du membre la première fois. */
  async setRadius(km: number) {
    this.locateError.set(false);
    let position: { lat: number; lng: number } | null = this.filters().autour ?? null;
    if (!position) {
      this.locating.set(true);
      position = await this.locate();
      this.locating.set(false);
      if (!position) {
        this.locateError.set(true);
        return;
      }
    }
    this.filters.set({
      ...this.filters(),
      ou: undefined,
      autour: { km, lat: position.lat, lng: position.lng },
    });
    this.emit();
    this.openPanel.set(null);
  }

  private locate(): Promise<{ lat: number; lng: number } | null> {
    if (!('geolocation' in navigator)) return Promise.resolve(null);
    return new Promise((resolve) =>
      navigator.geolocation.getCurrentPosition(
        (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
        () => resolve(null),
        { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 },
      ),
    );
  }

  clearOu() {
    this.filters.set({ ...this.filters(), ou: undefined, autour: undefined });
    this.emit();
    this.openPanel.set(null);
  }

  // ── Dates ─────────────────────────────────────────────────
  setQuickPeriod(period: string) {
    this.quickPeriod.set(period);
    const now = new Date();
    const toISO = (d: Date) => d.toISOString().split('T')[0];

    if (period === 'past') {
      // Géré par matchesPeriod via filters.quickPeriod
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
      // D'aujourd'hui à la fin du mois (les sorties passées ont leur propre filtre).
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      this.dateDebut.set(toISO(now));
      this.dateFin.set(toISO(end));
    }
  }

  applyDates() {
    this.filters.set({
      ...this.filters(),
      dateDebut: this.dateDebut() || undefined,
      dateFin: this.dateFin() || undefined,
      quickPeriod: this.quickPeriod() === 'past' ? 'past' : undefined,
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
