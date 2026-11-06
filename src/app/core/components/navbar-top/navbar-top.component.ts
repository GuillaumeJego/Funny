import {
  Component,
  OnInit,
  HostListener,
  ChangeDetectionStrategy,
  inject,
  signal,
  computed,
} from '@angular/core';

import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { ProfileService } from '../../services/profile.service';
import { isPremiumMember } from '../../utils/premium';
import { ClickableDirective } from '../../directives/clickable.directive';

@Component({
  selector: 'app-navbar-top',
  standalone: true,
  imports: [ClickableDirective],
  templateUrl: './navbar-top.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './navbar-top.component.scss',
})
export class NavbarTopComponent implements OnInit {
  private authService = inject(AuthService);
  private profileService = inject(ProfileService);
  private router = inject(Router);

  readonly avatarUrl = signal<string | undefined>(undefined);
  readonly menuOpen = signal(false);
  readonly isPremium = signal(false);
  readonly subscriptionEndDate = signal<Date | undefined>(undefined);

  async ngOnInit() {
    const {
      data: { user },
    } = await this.authService.getUser();
    if (user) {
      const { data } = await this.profileService.getMyProfile(user.id);
      if (data) {
        this.avatarUrl.set(data.avatar_url);
        if (data.subscription_end_date) {
          this.subscriptionEndDate.set(new Date(data.subscription_end_date));
        }
        this.isPremium.set(isPremiumMember(data));
      }
    }
  }

  /** Temps restant d'abonnement, affiché dans le badge Premium. */
  readonly subscriptionLabel = computed(() => {
    const end = this.subscriptionEndDate();
    if (!this.isPremium() || !end) return '';
    const now = new Date();
    const diffMs = end.getTime() - now.getTime();
    if (diffMs <= 0) return 'Expiré';
    const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    if (days <= 1) return '1 jour';
    if (days < 30) return `${days} jours`;
    const months = (end.getFullYear() - now.getFullYear()) * 12 + (end.getMonth() - now.getMonth());
    if (months < 12) return `${months} mois`;
    const years = Math.floor(months / 12);
    const remMois = months % 12;
    if (remMois === 0) return `${years} an${years > 1 ? 's' : ''}`;
    return `${years} an${years > 1 ? 's' : ''} ${remMois} mois`;
  });

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event) {
    const target = event.target as HTMLElement;
    if (!target.closest('app-navbar-top')) {
      this.menuOpen.set(false);
    }
  }

  toggleMenu() {
    this.menuOpen.set(!this.menuOpen());
  }

  goToProfile() {
    this.router.navigate(['/profile/edit']);
  }

  goToPremium() {
    this.router.navigate(['/premium']);
  }

  async logout() {
    await this.authService.logout();
    this.router.navigate(['/login']);
  }
}
