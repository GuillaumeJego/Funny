import {
  Component,
  OnChanges,
  SimpleChanges,
  ChangeDetectionStrategy,
  inject,
  input,
  output,
  signal,
  computed,
} from '@angular/core';

import { Router } from '@angular/router';
import { ConversationService } from '../../../core/services/conversation.service';
import { SortieWithRelations } from '../../../core/models/sortie.model';
import { SortieService } from '../../../core/services/sortie.service';
import { InscriptionStatus } from '../../../core/services/inscription.service';
import { ClickableDirective } from '../../../core/directives/clickable.directive';

interface MiniProfile {
  id: string;
  username: string;
  avatar_url: string | null;
  isOrganizer?: boolean;
}

@Component({
  selector: 'app-sortie-drawer',
  standalone: true,
  imports: [ClickableDirective],
  templateUrl: './sortie-drawer.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './sortie-drawer.component.scss',
})
export class SortieDrawerComponent implements OnChanges {
  private router = inject(Router);
  private conversationService = inject(ConversationService);
  readonly openingChat = signal(false);
  readonly chatError = signal('');
  private sortieService = inject(SortieService);

  readonly sortie = input<SortieWithRelations | null>(null);
  readonly isOpen = input(false);
  readonly userRole = input('user');
  readonly isFavori = input(false);
  readonly inscriptionStatus = input<InscriptionStatus>('none');
  readonly currentUserId = input('');
  readonly userIsPremium = input(false);
  readonly closed = output<void>();
  readonly favoriToggled = output<string>();
  readonly rejoindreClicked = output<string>();
  readonly quitterClicked = output<string>();
  readonly supprimerClicked = output<string>();
  /** Le bouton Supprimer demande une confirmation dans le tiroir lui-même. */
  readonly confirmingDelete = signal(false);

  readonly activeTab = signal<'details' | 'membres'>('details');
  readonly membresInscrits = signal<MiniProfile[]>([]);
  readonly membresLikes = signal<MiniProfile[]>([]);
  readonly membresWaiting = signal<MiniProfile[]>([]);
  readonly membresLoaded = signal(false);
  readonly membresLoading = signal(false);

  readonly isOrganizer = computed<boolean>(() => {
    const currentUserId = this.currentUserId();
    return !!currentUserId && currentUserId === this.sortie()?.created_by;
  });

  readonly isPremiumLocked = computed<boolean>(() => {
    const sortie = this.sortie();
    // Aperçu seulement : le serveur n'a pas donné les détails, on reste verrouillé.
    if (sortie?.locked) return true;
    if (!sortie?.is_premium) return false;
    if (this.userIsPremium()) return false;
    return !['admin', 'developer', 'user_premium'].includes(this.userRole());
  });

  readonly membresTabCount = computed<number>(() => {
    return this.membresInscrits().length + this.membresWaiting().length;
  });

  goToEdit(sortieId: string) {
    this.close();
    this.router.navigate(['/sorties', sortieId, 'modifier']);
  }

  /** Ouvre la discussion de groupe de la sortie (créée à la première ouverture). */
  async openGroupChat(sortieId: string) {
    this.chatError.set('');
    this.openingChat.set(true);
    try {
      const conversationId = await this.conversationService.openSortieChat(sortieId);
      this.close();
      this.router.navigate(['/messages', conversationId]);
    } catch (error) {
      this.chatError.set((error as Error).message || 'Discussion impossible pour le moment.');
    } finally {
      this.openingChat.set(false);
    }
  }

  goToPremium() {
    this.router.navigate(['/premium']);
  }

  goToProfile(userId: string) {
    this.close();
    this.router.navigate(['/membres', userId]);
  }

  close() {
    this.closed.emit();
  }

  onBackdropClick(event: MouseEvent) {
    if ((event.target as HTMLElement).classList.contains('drawer-backdrop')) this.close();
  }

  async switchTab(tab: 'details' | 'membres') {
    this.activeTab.set(tab);
    if (tab === 'membres' && !this.membresLoaded() && !this.membresLoading()) {
      await this.loadMembres();
    }
  }

  async loadMembres() {
    const sortie = this.sortie();
    if (!sortie) return;
    this.membresLoading.set(true);
    const [inscrits, likes, waiting] = await Promise.all([
      this.sortieService.getMembresInscrits(sortie.id),
      this.sortieService.getMembresLikes(sortie.id),
      this.sortieService.getMembresWaiting(sortie.id),
    ]);
    this.membresInscrits.set(inscrits);
    this.membresLikes.set(likes);
    this.membresWaiting.set(waiting);
    this.membresLoaded.set(true);
    this.membresLoading.set(false);
  }

  formatDate(dateStr: string): string {
    const d = new Date(dateStr);
    const jour = d.toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    const heure = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    return `${jour.charAt(0).toUpperCase() + jour.slice(1)} à ${heure}`;
  }

  /** « Ven. 13 nov. » */
  formatDay(dateStr: string): string {
    const d = new Date(dateStr);
    const jour = d.toLocaleDateString('fr-FR', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });
    return jour.charAt(0).toUpperCase() + jour.slice(1);
  }

  /** « 18h30 » */
  formatHour(dateStr: string): string {
    const d = new Date(dateStr);
    return `${d.getHours()}h${String(d.getMinutes()).padStart(2, '0')}`;
  }

  getInitial(username: string): string {
    return username.charAt(0).toUpperCase();
  }

  ngOnChanges(changes: SimpleChanges) {
    // Une autre sortie s'ouvre : on revient au premier onglet. Une simple mise à jour
    // de la même sortie (nombre d'inscrits) garde l'onglet affiché.
    const change = changes['sortie'];
    if (change && this.sortie() && change.previousValue?.id !== change.currentValue?.id) {
      this.activeTab.set('details');
      this.membresInscrits.set([]);
      this.membresLikes.set([]);
      this.membresWaiting.set([]);
      this.membresLoaded.set(false);
    }
  }
}
