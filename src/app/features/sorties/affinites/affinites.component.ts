import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { SortieWithRelations } from '../../../core/models/sortie.model';
import { AffiniteChoice, AffiniteRepository } from '../../../core/repositories/affinite.repository';
import { MiniProfile } from '../../../core/repositories/repository.types';
import { AuthService } from '../../../core/services/auth.service';
import { ProfileService } from '../../../core/services/profile.service';
import { SettingsService } from '../../../core/services/settings.service';
import { SortieService } from '../../../core/services/sortie.service';

/** Valeur de « Situation » qui donne droit au coup de cœur. */
const LOOKING = 'Célibataire en recherche';
const DAY_MS = 86400000;

export const AFFINITE_CHOICES: { value: AffiniteChoice; label: string; icon: string }[] = [
  { value: 'none', label: 'Ne se prononce pas', icon: '🤐' },
  { value: 'amitie', label: 'Amitié', icon: '🤝' },
  { value: 'autre_sortie', label: 'Prêt pour une autre sortie', icon: '🎉' },
  { value: 'coup_de_coeur', label: 'Coup de cœur', icon: '💘' },
];

/** Après une sortie : pour chaque autre participant, « avez-vous eu des affinités ? ». */
@Component({
  selector: 'app-affinites',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './affinites.component.html',
  styleUrl: './affinites.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AffinitesComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private auth = inject(AuthService);
  private profiles = inject(ProfileService);
  private settings = inject(SettingsService);
  private sorties = inject(SortieService);
  private affinites = inject(AffiniteRepository);

  readonly loading = signal(true);
  readonly sortie = signal<SortieWithRelations | null>(null);
  readonly isParticipant = signal(false);
  readonly isLooking = signal(false);
  readonly others = signal<MiniProfile[]>([]);
  /** Réponses déjà envoyées (définitives), par membre. */
  readonly answers = signal(new Map<string, AffiniteChoice>());
  /** Choix sélectionnés mais pas encore validés, par membre. */
  readonly picks = signal(new Map<string, AffiniteChoice>());
  readonly sending = signal(new Set<string>());
  readonly error = signal('');
  readonly mutualWith = signal<string[]>([]);
  readonly heartLimit = signal(1);
  readonly heartDays = signal(30);
  readonly heartDates = signal<string[]>([]);
  /** Membre pour qui on demande confirmation du coup de cœur. */
  readonly confirmHeartFor = signal<MiniProfile | null>(null);

  private userId = '';

  readonly deadline = computed(() => {
    const until = this.sortie()?.affinites_jusqua;
    return until ? new Date(until) : null;
  });
  readonly state = computed<'pas_ouverte' | 'ouverte' | 'fermee'>(() => {
    const deadline = this.deadline();
    if (!deadline) return 'pas_ouverte';
    return deadline.getTime() > Date.now() ? 'ouverte' : 'fermee';
  });
  readonly choices = computed(() =>
    AFFINITE_CHOICES.filter((c) => c.value !== 'coup_de_coeur' || this.isLooking()),
  );
  readonly heartsLeft = computed(() => Math.max(0, this.heartLimit() - this.heartDates().length));
  /** Quand un nouveau coup de cœur redevient possible (null s'il en reste). */
  readonly nextHeart = computed(() => {
    if (this.heartsLeft() > 0) return null;
    const dates = this.heartDates();
    const oldest = dates[dates.length - this.heartLimit()];
    return oldest ? new Date(new Date(oldest).getTime() + this.heartDays() * DAY_MS) : null;
  });

  async ngOnInit() {
    const {
      data: { user },
    } = await this.auth.getUser();
    if (!user) {
      this.router.navigate(['/login']);
      return;
    }
    this.userId = user.id;
    const sortieId = this.route.snapshot.paramMap.get('id') ?? '';

    const [sortie, membres, profile, mine, limit, days] = await Promise.all([
      this.sorties.getSortie(sortieId),
      this.sorties.getMembresInscrits(sortieId),
      this.profiles.getMyProfile(user.id),
      this.affinites.getMine(user.id, sortieId),
      this.settings.get('coeurs_par_periode'),
      this.settings.get('coeurs_periode_jours'),
    ]);
    if (Number(limit) > 0) this.heartLimit.set(Number(limit));
    if (Number(days) > 0) this.heartDays.set(Number(days));

    const since = new Date(Date.now() - this.heartDays() * DAY_MS).toISOString();
    this.heartDates.set(await this.affinites.getHeartDatesSince(user.id, since));

    this.sortie.set(sortie);
    this.isParticipant.set(membres.some((m) => m.id === user.id));
    this.isLooking.set(profile.data?.relationship === LOOKING);
    this.others.set(membres.filter((m) => m.id !== user.id));
    this.answers.set(new Map(mine.map((a) => [a.to_user, a.choice])));
    this.loading.set(false);
  }

  choiceOf(value: AffiniteChoice | undefined) {
    return AFFINITE_CHOICES.find((c) => c.value === value);
  }

  pick(memberId: string, choice: AffiniteChoice) {
    if (choice === 'coup_de_coeur' && this.heartsLeft() === 0) return;
    this.picks.update((m) => new Map(m).set(memberId, choice));
  }

  validate(member: MiniProfile) {
    const choice = this.picks().get(member.id);
    if (!choice) return;
    if (choice === 'coup_de_coeur') {
      this.confirmHeartFor.set(member);
      return;
    }
    this.send(member, choice);
  }

  confirmHeart() {
    const member = this.confirmHeartFor();
    this.confirmHeartFor.set(null);
    if (member) this.send(member, 'coup_de_coeur');
  }

  private async send(member: MiniProfile, choice: AffiniteChoice) {
    const sortie = this.sortie();
    if (!sortie) return;
    this.error.set('');
    this.sending.update((s) => new Set(s).add(member.id));
    const { data, error } = await this.affinites.answer(sortie.id, member.id, choice);
    this.sending.update((s) => {
      const next = new Set(s);
      next.delete(member.id);
      return next;
    });
    if (error || !data) {
      this.error.set(error?.message ?? 'Réponse non envoyée, réessaie.');
      return;
    }
    this.answers.update((m) => new Map(m).set(member.id, choice));
    this.picks.update((m) => {
      const next = new Map(m);
      next.delete(member.id);
      return next;
    });
    if (choice === 'coup_de_coeur') {
      this.heartDates.update((d) => [...d, new Date().toISOString()]);
    }
    if (data.mutual) this.mutualWith.update((list) => [...list, member.username]);
  }

  formatDate(date: Date, withTime = true): string {
    return date.toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
    });
  }
}
