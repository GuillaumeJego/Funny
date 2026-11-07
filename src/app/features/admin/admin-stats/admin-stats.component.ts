import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { StatsService } from '../../../core/services/stats.service';
import { ConnexionStats } from '../../../core/models/stats.model';
import { RELATIONSHIP_OPTIONS } from '../../../core/models/profile.model';

type Period = 'today' | 'yesterday' | 'week' | 'month' | 'custom';

/** Jour local (AAAA-MM-JJ), `offset` jours avant ou après aujourd'hui. */
function localDay(offset = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Statistiques de l'admin : connexions par jour (total et membres différents) et
 * horaires d'activité, sur une période et pour une population (genre, situation).
 */
@Component({
  selector: 'app-admin-stats',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './admin-stats.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './admin-stats.component.scss',
})
export class AdminStatsComponent implements OnInit {
  private statsService = inject(StatsService);

  readonly periods: { value: Period; label: string }[] = [
    { value: 'today', label: "Aujourd'hui" },
    { value: 'yesterday', label: 'Hier' },
    { value: 'week', label: '7 derniers jours' },
    { value: 'month', label: '30 derniers jours' },
    { value: 'custom', label: 'Dates…' },
  ];
  readonly genderOptions = [
    { value: '', label: 'Tous les genres' },
    { value: 'Homme', label: 'Hommes' },
    { value: 'Femme', label: 'Femmes' },
    { value: 'secret', label: 'Ne se prononce pas' },
  ];
  readonly relationshipOptions = [
    { value: '', label: 'Toutes les situations' },
    ...RELATIONSHIP_OPTIONS.map((o) => ({ value: o.value as string, label: o.label as string })),
  ];
  readonly hourLabels = Array.from({ length: 24 }, (_, h) => `${h} h`);

  readonly period = signal<Period>('week');
  readonly customFrom = signal(localDay(-6));
  readonly customTo = signal(localDay());
  readonly gender = signal('');
  readonly relationship = signal('');
  readonly view = signal<'connexions' | 'horaires'>('connexions');

  readonly loading = signal(false);
  readonly error = signal('');
  readonly stats = signal<ConnexionStats | null>(null);

  readonly range = computed(() => {
    switch (this.period()) {
      case 'today':
        return { from: localDay(), to: localDay() };
      case 'yesterday':
        return { from: localDay(-1), to: localDay(-1) };
      case 'week':
        return { from: localDay(-6), to: localDay() };
      case 'month':
        return { from: localDay(-29), to: localDay() };
      case 'custom':
        return { from: this.customFrom(), to: this.customTo() };
    }
  });

  /** Jours du plus récent au plus ancien, avec la largeur de leur barre. */
  readonly dayRows = computed(() => {
    const days = this.stats()?.days ?? [];
    const max = Math.max(1, ...days.map((d) => d.total));
    return [...days].reverse().map((d) => ({
      ...d,
      label: new Date(`${d.day}T12:00:00`).toLocaleDateString('fr-FR', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
      }),
      width: (d.total / max) * 100,
      uniqueWidth: (d.unique / max) * 100,
    }));
  });

  readonly hourRows = computed(() => {
    const hours = this.stats()?.hours ?? [];
    const max = Math.max(1, ...hours);
    return hours.map((count, h) => ({
      label: this.hourLabels[h],
      count,
      width: (count / max) * 100,
    }));
  });

  /** Heure la plus active de la période. */
  readonly peakHour = computed(() => {
    const hours = this.stats()?.hours ?? [];
    const max = Math.max(0, ...hours);
    return max > 0 ? hours.indexOf(max) : null;
  });

  ngOnInit() {
    this.load();
  }

  setPeriod(period: Period) {
    this.period.set(period);
    if (period !== 'custom') this.load();
  }

  async load() {
    const { from, to } = this.range();
    if (!from || !to || from > to) {
      this.error.set('Choisis une date de début avant la date de fin.');
      return;
    }
    this.loading.set(true);
    this.error.set('');
    const { data, error } = await this.statsService.getStats({
      from,
      to,
      gender: this.gender() || undefined,
      relationship: this.relationship() || undefined,
    });
    this.loading.set(false);
    if (error) {
      this.error.set(error.message);
      return;
    }
    this.stats.set(data);
  }
}
