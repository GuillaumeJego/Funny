import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { ProfileService } from '../../services/profile.service';

@Component({
  selector: 'app-navbar-top',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './navbar-top.component.html',
  styleUrl: './navbar-top.component.scss'
})
export class NavbarTopComponent implements OnInit {
  avatarUrl?: string;
  menuOpen = false;
  isPremium = false;
  subscriptionEndDate?: Date;

  constructor(
    private authService: AuthService,
    private profileService: ProfileService,
    private router: Router
  ) {}

  async ngOnInit() {
    const { data: { user } } = await this.authService.getUser();
    if (user) {
      const { data } = await this.profileService.getMyProfile(user.id);
      if (data) {
        this.avatarUrl = data.avatar_url;
        if (data.subscription_end_date) {
          this.subscriptionEndDate = new Date(data.subscription_end_date);
        }
        this.isPremium = ['user_premium', 'admin', 'developer'].includes(data.role || '')
          || (!!this.subscriptionEndDate && this.subscriptionEndDate > new Date());
      }
    }
  }

  get subscriptionLabel(): string {
    if (!this.isPremium || !this.subscriptionEndDate) return '';
    const now = new Date();
    const diffMs = this.subscriptionEndDate.getTime() - now.getTime();
    if (diffMs <= 0) return 'Expiré';
    const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    if (days === 1) return '1 jour';
    if (days < 30) return `${days} jours`;
    const months = Math.ceil(days / 30);
    return `${months} mois`;
  }

  toggleMenu() {
    this.menuOpen = !this.menuOpen;
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
