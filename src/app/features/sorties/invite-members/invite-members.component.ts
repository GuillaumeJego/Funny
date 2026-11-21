import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  OnInit,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { InviteCandidate } from '../../../core/models/sortie.model';
import { SortieService } from '../../../core/services/sortie.service';

type Tab = 'friends' | 'met';

/** Personnes affichées d'un coup, puis au fil du défilement. */
const PAGE = 30;

/**
 * Écran d'invitation d'une sortie pour abonnés : les amis de l'organisateur et les personnes
 * rencontrées lors de ses sorties passées (listes calculées par le serveur, qui retire les
 * blocages). La sélection est commune aux deux onglets : une personne présente dans les deux
 * n'est invitée qu'une fois. Le serveur revérifie tout à l'envoi.
 */
@Component({
  selector: 'app-invite-members',
  standalone: true,
  templateUrl: './invite-members.component.html',
  styleUrl: './invite-members.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InviteMembersComponent implements OnInit {
  private sortieService = inject(SortieService);

  /** La sortie ; vide dans le formulaire de création (la sortie n'existe pas encore). */
  readonly sortieId = input<string | null>(null);
  readonly sortieTitle = input('');
  /** Formulaire de création : nombre de places prévu (null : illimité). */
  readonly places = input<number | null>(null);
  /**
   * Formulaire de création : on choisit seulement ses invités, qui partiront avec la sortie
   * à la publication (rien n'est envoyé d'ici).
   */
  readonly pickOnly = input(false);
  /** Personnes déjà choisies dans le formulaire. */
  readonly initialSelection = input<InviteCandidate[]>([]);
  readonly closed = output<void>();
  /** Formulaire de création : les personnes choisies. */
  readonly picked = output<InviteCandidate[]>();
  /** Nombre de personnes invitées à cet envoi (pour rafraîchir la fiche). */
  readonly invited = output<number>();

  readonly loading = signal(true);
  readonly loadError = signal('');
  readonly tab = signal<Tab>('friends');
  readonly query = signal('');
  readonly friends = signal<InviteCandidate[]>([]);
  readonly met = signal<InviteCandidate[]>([]);
  /** Places libres au chargement (null : illimité). */
  private readonly placesAtLoad = signal<number | null>(null);
  readonly selected = signal<ReadonlySet<string>>(new Set());
  readonly shown = signal(PAGE);
  readonly sending = signal(false);
  readonly sendError = signal('');
  /** Après un envoi réussi : « 3 invitations envoyées ». */
  readonly success = signal('');

  /** Places encore libres une fois la sélection comptée. */
  readonly placesLeft = computed(() => {
    const places = this.placesAtLoad();
    return places === null ? null : Math.max(0, places - this.selected().size);
  });

  readonly list = computed(() => (this.tab() === 'friends' ? this.friends() : this.met()));

  readonly filtered = computed(() => {
    const q = normalize(this.query().trim());
    const list = this.list();
    return q ? list.filter((p) => normalize(p.username).includes(q)) : list;
  });

  readonly visible = computed(() => this.filtered().slice(0, this.shown()));

  /** Tout le monde dans l'onglet est déjà invité ou inscrit. */
  readonly allTaken = computed(() => {
    const list = this.list();
    return list.length > 0 && list.every((p) => p.state !== null);
  });

  readonly buttonLabel = computed(() => {
    const n = this.selected().size;
    if (n === 0) return this.pickOnly() ? 'Valider' : 'Choisis des personnes';
    const people = `${n} personne${n > 1 ? 's' : ''}`;
    return this.pickOnly() ? `Ajouter ${people}` : `Inviter ${people}`;
  });

  async ngOnInit() {
    await this.load();
  }

  async load() {
    this.loading.set(true);
    this.loadError.set('');
    this.selected.set(new Set(this.initialSelection().map((p) => p.id)));
    const { data, error } = await this.sortieService.getInviteCandidates(
      this.sortieId(),
      this.sortieId() ? null : this.places(),
    );
    this.loading.set(false);
    if (error || !data) {
      this.loadError.set(error?.message ?? 'Impossible de charger tes contacts.');
      return;
    }
    this.friends.set(data.friends);
    this.met.set(data.met);
    this.placesAtLoad.set(data.placesLeft);
    // Pas d'amis : on montre directement les personnes rencontrées.
    if (!data.friends.length && data.met.length) this.tab.set('met');
  }

  setTab(tab: Tab) {
    this.tab.set(tab);
    this.shown.set(PAGE);
  }

  onSearch(value: string) {
    this.query.set(value);
    this.shown.set(PAGE);
  }

  isSelected(person: InviteCandidate): boolean {
    return this.selected().has(person.id);
  }

  /** Cochable : pas déjà invité ou inscrit, et il reste une place. */
  canSelect(person: InviteCandidate): boolean {
    if (person.state !== null || this.sending()) return false;
    if (this.isSelected(person)) return true;
    const left = this.placesLeft();
    return left === null || left > 0;
  }

  toggle(person: InviteCandidate) {
    if (!this.canSelect(person)) return;
    this.success.set('');
    this.sendError.set('');
    this.selected.update((set) => {
      const next = new Set(set);
      if (next.has(person.id)) next.delete(person.id);
      else next.add(person.id);
      return next;
    });
  }

  stateLabel(person: InviteCandidate): string {
    switch (person.state) {
      case 'invited':
        return 'Déjà invité(e)';
      case 'inscrit':
        return 'Inscrit(e)';
      case 'waiting':
        return "En liste d'attente";
      default:
        return '';
    }
  }

  /** Chargement progressif : 30 de plus quand on approche du bas de la liste. */
  onScroll(event: Event) {
    const el = event.target as HTMLElement;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 200) this.showMore();
  }

  showMore() {
    if (this.shown() < this.filtered().length) this.shown.update((n) => n + PAGE);
  }

  /** Envoie les invitations ; le bouton est désactivé pendant l'envoi (pas de double envoi). */
  async send() {
    const ids = [...this.selected()];
    if (this.pickOnly()) {
      // Formulaire : on rend la sélection (même vide, pour tout retirer).
      const all = [...this.friends(), ...this.met()];
      this.picked.emit(ids.map((id) => all.find((p) => p.id === id)!).filter(Boolean));
      this.closed.emit();
      return;
    }
    const sortieId = this.sortieId();
    if (!ids.length || this.sending() || !sortieId) return;
    this.sending.set(true);
    this.sendError.set('');
    this.success.set('');
    const { data, error } = await this.sortieService.invite(sortieId, ids);
    this.sending.set(false);
    if (error || !data) {
      // La sélection est gardée : il suffit de réessayer.
      this.sendError.set(
        error?.message ?? 'Les invitations ne sont pas parties. Vérifie ta connexion et réessaie.',
      );
      return;
    }
    const invited = new Set(data.invited);
    const mark = (list: InviteCandidate[]) =>
      list.map((p) => (invited.has(p.id) ? { ...p, state: 'invited' as const } : p));
    this.friends.update(mark);
    this.met.update(mark);
    this.placesAtLoad.update((p) => (p === null ? null : Math.max(0, p - invited.size)));
    this.selected.set(new Set());
    const n = invited.size;
    const skipped = data.skipped.length;
    this.success.set(
      (n
        ? `💌 ${n} invitation${n > 1 ? 's' : ''} envoyée${n > 1 ? 's' : ''} !`
        : 'Aucune invitation envoyée.') +
        (skipped
          ? ` ${skipped} personne${skipped > 1 ? 's' : ''} ne pouvai${skipped > 1 ? 'ent' : 't'} plus être invitée${skipped > 1 ? 's' : ''}.`
          : ''),
    );
    if (n) this.invited.emit(n);
  }

  initial(person: InviteCandidate): string {
    return person.username.charAt(0).toUpperCase() || '?';
  }

  @HostListener('document:keydown.escape')
  close() {
    this.closed.emit();
  }
}

/** Sans accents ni majuscules : « Zoé » se trouve en tapant « zoe ». */
function normalize(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}
