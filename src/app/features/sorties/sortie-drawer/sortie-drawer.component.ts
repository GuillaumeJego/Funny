import { Component, Input, Output, EventEmitter, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { SortieWithRelations } from '../../../core/models/sortie.model';

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
  @Input() isInscrit = false;
  @Output() closed = new EventEmitter<void>();
  @Output() favoriToggled = new EventEmitter<string>();
  @Output() rejoindreClicked = new EventEmitter<string>();
  @Output() quitterClicked = new EventEmitter<string>();

  constructor(private router: Router) {}

  get isPremiumLocked(): boolean {
    if (!this.sortie?.is_premium) return false;
    return !['admin', 'developer', 'user_premium'].includes(this.userRole);
  }

  goToPremium() {
    this.router.navigate(['/premium']);
  }

  close() {
    this.closed.emit();
  }

  onBackdropClick(event: MouseEvent) {
    if ((event.target as HTMLElement).classList.contains('drawer-backdrop')) {
      this.close();
    }
  }

  formatDate(dateStr: string): string {
    const d = new Date(dateStr);
    const jour = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    const heure = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    return `${jour.charAt(0).toUpperCase() + jour.slice(1)} à ${heure}`;
  }

  ngOnChanges() {}
}
