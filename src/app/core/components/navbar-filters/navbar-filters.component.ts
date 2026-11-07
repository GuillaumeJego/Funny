import {
  Component,
  HostListener,
  ChangeDetectionStrategy,
  input,
  output,
  signal,
  computed,
  inject,
} from '@angular/core';

import { FormsModule } from '@angular/forms';
import { ClickableDirective } from '../../directives/clickable.directive';
import { GeoService, GeoTown } from '../../services/geo.service';
import { distanceKm } from '../../utils/distance';
import { inTown } from '../../utils/towns';

export interface Filters {
  themeIds?: string[];
  /** Ville choisie dans « Où ? » ; absente pour « Autour de moi ». */
  ou?: string;
  /** Centre de la recherche (ma position ou la ville) et rayon en km. */
  autour?: { km: number; lat: number; lng: number };
  dateDebut?: string;
  dateFin?: string;
  quickPeriod?: string; // 'past' : sorties passées ; sinon, seulement les sorties à venir
  /** 'gratuit' : seulement les sorties gratuites. */
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

/** Rayon maximum du curseur : au-delà, c'est toute la France (pas de filtre de lieu). */
export const MAX_RADIUS_KM = 100;

/**
 * Une sortie passe-t-elle le filtre « Où ? » ? Elle doit être dans le rayon choisi.
 * Une sortie sans position connue passe seulement si son adresse cite la ville choisie.
 */
export function matchesPlace(
  sortie: { lat?: number | null; lng?: number | null; location?: string | null },
  f: Filters,
): boolean {
  if (!f.autour) return true;
  if (sortie.lat != null && sortie.lng != null) {
    return distanceKm(f.autour, { lat: sortie.lat, lng: sortie.lng }) <= f.autour.km;
  }
  return !!f.ou && inTown(sortie.location, f.ou);
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
  readonly filtersChanged = output<Filters>();

  readonly filters = signal<Filters>({});
  readonly openPanel = signal<string | null>(null);

  // État temporaire
  readonly selectedThemeIds = signal<Set<string>>(new Set());
  readonly dateDebut = signal('');
  readonly dateFin = signal('');
  readonly quickPeriod = signal('');

  // Où ? : autour de moi ou une ville, et un rayon (au-delà de 100 km : toute la France)
  private geo = inject(GeoService);
  readonly maxRadius = MAX_RADIUS_KM;
  /** Centre en cours de choix : ma position (label null) ou une ville. */
  readonly center = signal<{ lat: number; lng: number; label: string | null } | null>(null);
  readonly radius = signal(20);
  readonly townQuery = signal('');
  readonly townResults = signal<GeoTown[]>([]);
  readonly searchingTowns = signal(false);
  readonly locating = signal(false);
  readonly locateError = signal(false);
  private searchTimer?: ReturnType<typeof setTimeout>;

  readonly radiusLabel = computed(() =>
    this.radius() > MAX_RADIUS_KM ? 'Toute la France' : `${this.radius()} km`,
  );

  readonly ouLabel = computed<string>(() => {
    const f = this.filters();
    if (!f.autour) return 'Où ?';
    return `${f.ou ?? 'Autour de moi'} · ${f.autour.km} km`;
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
      if (panel === 'ou') this.syncPlace();
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
  /** À l'ouverture du panneau, on repart du filtre en place. */
  private syncPlace() {
    const { autour, ou } = this.filters();
    this.locateError.set(false);
    this.townResults.set([]);
    this.center.set(autour ? { lat: autour.lat, lng: autour.lng, label: ou ?? null } : null);
    this.townQuery.set(ou ?? '');
    this.radius.set(autour?.km ?? 20);
  }

  /** « Autour de moi » : demande la position du membre. */
  async useMyPosition() {
    this.locateError.set(false);
    this.locating.set(true);
    const position = await this.locate();
    this.locating.set(false);
    if (!position) {
      this.locateError.set(true);
      return;
    }
    this.townQuery.set('');
    this.townResults.set([]);
    this.center.set({ ...position, label: null });
  }

  /** Saisie d'une ville : suggestions après une courte pause dans la frappe. */
  onTownQuery(query: string) {
    this.townQuery.set(query);
    if (this.center()?.label) this.center.set(null);
    clearTimeout(this.searchTimer);
    if (query.trim().length < 2) {
      this.townResults.set([]);
      return;
    }
    this.searchTimer = setTimeout(() => {
      this.searchingTowns.set(true);
      this.geo.searchTowns(query).subscribe((towns) => {
        this.searchingTowns.set(false);
        if (this.townQuery() === query) this.townResults.set(towns.slice(0, 6));
      });
    }, 400);
  }

  pickTown(town: GeoTown) {
    this.townQuery.set(town.name);
    this.townResults.set([]);
    this.center.set({ lat: town.lat, lng: town.lng, label: town.name });
  }

  /** Il faut un centre, sauf pour « Toute la France ». */
  readonly canApplyPlace = computed(() => this.radius() > MAX_RADIUS_KM || !!this.center());

  applyPlace() {
    const center = this.center();
    if (this.radius() > MAX_RADIUS_KM || !center) {
      this.clearOu();
      return;
    }
    this.filters.set({
      ...this.filters(),
      ou: center.label ?? undefined,
      autour: { km: this.radius(), lat: center.lat, lng: center.lng },
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

  // ── Gratuit et Premium : un clic active, un autre désactive ──
  toggleGratuit() {
    const on = this.filters().prix !== 'gratuit';
    this.filters.set({ ...this.filters(), prix: on ? 'gratuit' : undefined });
    this.emit();
    this.openPanel.set(null);
  }

  togglePremium() {
    this.filters.set({ ...this.filters(), premium: !this.filters().premium });
    this.emit();
    this.openPanel.set(null);
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
