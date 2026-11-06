import {
  Component,
  Input,
  OnChanges,
  SimpleChanges,
  ChangeDetectionStrategy,
  inject,
  input,
  output,
} from '@angular/core';

import { Router } from '@angular/router';
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
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './sortie-drawer.component.scss',
})
export class SortieDrawerComponent implements OnChanges {
  private router = inject(Router);
  private sortieService = inject(SortieService);

  @Input() sortie: SortieWithRelations | null = null;
  @Input() isOpen = false;
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
  confirmingDelete = false;

  activeTab: 'details' | 'membres' = 'details';
  membresInscrits: MiniProfile[] = [];
  membresLikes: MiniProfile[] = [];
  membresWaiting: MiniProfile[] = [];
  membresLoaded = false;
  membresLoading = false;

  get isOrganizer(): boolean {
    const currentUserId = this.currentUserId();
    return !!currentUserId && currentUserId === this.sortie?.created_by;
  }

  get isPremiumLocked(): boolean {
    if (!this.sortie?.is_premium) return false;
    if (this.userIsPremium()) return false;
    return !['admin', 'developer', 'user_premium'].includes(this.userRole());
  }

  get membresTabCount(): number {
    return this.membresInscrits.length + this.membresWaiting.length;
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
    this.activeTab = tab;
    if (tab === 'membres' && !this.membresLoaded && !this.membresLoading) {
      await this.loadMembres();
    }
  }

  async loadMembres() {
    if (!this.sortie) return;
    this.membresLoading = true;
    const [inscrits, likes, waiting] = await Promise.all([
      this.sortieService.getMembresInscrits(this.sortie.id),
      this.sortieService.getMembresLikes(this.sortie.id),
      this.sortieService.getMembresWaiting(this.sortie.id),
    ]);
    this.membresInscrits = inscrits;
    this.membresLikes = likes;
    this.membresWaiting = waiting;
    this.membresLoaded = true;
    this.membresLoading = false;
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

  getInitial(username: string): string {
    return username.charAt(0).toUpperCase();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['sortie'] && this.sortie) {
      this.activeTab = 'details';
      this.membresInscrits = [];
      this.membresLikes = [];
      this.membresWaiting = [];
      this.membresLoaded = false;
    }
  }
}
