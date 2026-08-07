import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { SortieWithRelations } from '../../../core/models/sortie.model';
import { SortieService } from '../../../core/services/sortie.service';
import { InscriptionStatus } from '../../../core/services/inscription.service';

interface MiniProfile {
  id: string;
  username: string;
  avatar_url: string | null;
  isOrganizer?: boolean;
}

@Component({
  selector: 'app-sortie-drawer',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './sortie-drawer.component.html',
  styleUrl: './sortie-drawer.component.scss'
})
export class SortieDrawerComponent implements OnChanges {
  @Input() sortie: SortieWithRelations | null = null;
  @Input() isOpen = false;
  @Input() userRole = 'user';
  @Input() isFavori = false;
  @Input() inscriptionStatus: InscriptionStatus = 'none';
  @Input() currentUserId = '';
  @Input() userIsPremium = false;
  @Output() closed = new EventEmitter<void>();
  @Output() favoriToggled = new EventEmitter<string>();
  @Output() rejoindreClicked = new EventEmitter<string>();
  @Output() quitterClicked = new EventEmitter<string>();
  @Output() supprimerClicked = new EventEmitter<string>();

  activeTab: 'details' | 'membres' = 'details';
  membresInscrits: MiniProfile[] = [];
  membresLikes: MiniProfile[] = [];
  membresWaiting: MiniProfile[] = [];
  membresLoaded = false;
  membresLoading = false;

  constructor(private router: Router, private sortieService: SortieService) {}

  get isOrganizer(): boolean {
    return !!this.currentUserId && this.currentUserId === this.sortie?.created_by;
  }

  get isPremiumLocked(): boolean {
    if (!this.sortie?.is_premium) return false;
    if (this.userIsPremium) return false;
    return !['admin', 'developer', 'user_premium'].includes(this.userRole);
  }

  get membresTabCount(): number {
    return this.membresInscrits.length + this.membresWaiting.length;
  }

  goToPremium() { this.router.navigate(['/premium']); }

  goToProfile(userId: string) {
    this.close();
    this.router.navigate(['/membres', userId]);
  }

  close() { this.closed.emit(); }

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
      this.sortieService.getMembresWaiting(this.sortie.id)
    ]);
    this.membresInscrits = inscrits;
    this.membresLikes = likes;
    this.membresWaiting = waiting;
    this.membresLoaded = true;
    this.membresLoading = false;
  }

  formatDate(dateStr: string): string {
    const d = new Date(dateStr);
    const jour = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
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
