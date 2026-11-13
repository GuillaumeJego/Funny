import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { SortieWithRelations } from '../../../core/models/sortie.model';
import { MiniProfile } from '../../../core/repositories/repository.types';
import { SortieService } from '../../../core/services/sortie.service';

type Participant = MiniProfile & { isOrganizer: boolean; present: boolean | null };

/**
 * Après une sortie, l'organisateur indique qui était là : tout le monde est coché présent,
 * il décoche les absents puis valide (définitif), ou remet à plus tard.
 * Utilisé dans la fenêtre qui s'ouvre à l'arrivée dans l'appli et sur la page dédiée.
 */
@Component({
  selector: 'app-presences-form',
  standalone: true,
  templateUrl: './presences-form.component.html',
  styleUrl: './presences-form.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PresencesFormComponent {
  private sorties = inject(SortieService);

  readonly sortie = input.required<SortieWithRelations>();
  /** Présences enregistrées. */
  readonly validated = output<void>();
  /** « Je remplirai plus tard ». */
  readonly later = output<void>();

  readonly loading = signal(true);
  readonly participants = signal<Participant[]>([]);
  /** Membres décochés (absents). */
  readonly absents = signal(new Set<string>());
  readonly sending = signal(false);
  readonly error = signal('');

  readonly alreadyValidated = computed(() => !!this.sortie().presences_validees);
  readonly presentCount = computed(
    () => this.participants().filter((p) => !this.absents().has(p.id)).length,
  );

  constructor() {
    effect(() => {
      const sortie = this.sortie();
      this.load(sortie.id);
    });
  }

  private async load(sortieId: string) {
    this.loading.set(true);
    this.error.set('');
    const all = await this.sorties.getPresences(sortieId);
    const others = all
      .filter((p) => !p.isOrganizer)
      .sort((a, b) => a.username.localeCompare(b.username));
    this.participants.set(others);
    this.absents.set(new Set(others.filter((p) => p.present === false).map((p) => p.id)));
    this.loading.set(false);
  }

  toggle(memberId: string) {
    if (this.alreadyValidated()) return;
    this.absents.update((set) => {
      const next = new Set(set);
      if (next.has(memberId)) next.delete(memberId);
      else next.add(memberId);
      return next;
    });
  }

  async validate() {
    this.sending.set(true);
    this.error.set('');
    const { error } = await this.sorties.validerPresences(this.sortie().id, [...this.absents()]);
    this.sending.set(false);
    if (error) {
      this.error.set(error.message || "Les présences n'ont pas pu être enregistrées. Réessaie.");
      return;
    }
    this.validated.emit();
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
  }

  initial(name: string): string {
    return name.charAt(0).toUpperCase();
  }
}
