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

  constructor(
    private authService: AuthService,
    private profileService: ProfileService,
    private router: Router
  ) {}

  async ngOnInit() {
    const { data: { user } } = await this.authService.getUser();
    if (user) {
      const { data } = await this.profileService.getMyProfile(user.id);
      if (data) this.avatarUrl = data.avatar_url;
    }
  }

  toggleMenu() {
    this.menuOpen = !this.menuOpen;
  }

  goToProfile() {
    this.router.navigate(['/profile/edit']);
  }

  async logout() {
    await this.authService.logout();
    this.router.navigate(['/login']);
  }
}