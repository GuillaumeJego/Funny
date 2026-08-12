import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { DrawerService } from '../../services/drawer.service';
import { AuthService } from '../../services/auth.service';
import { ProfileService } from '../../services/profile.service';
import { NotificationService } from '../../services/notification.service';

@Component({
  selector: 'app-navbar-main',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './navbar-main.component.html',
  styleUrl: './navbar-main.component.scss'
})
export class NavbarMainComponent implements OnInit {

  navItems = [
    { icon: '🏠', label: 'Sorties', route: '/dashboard' },
    { icon: '⭐', label: 'Mes sorties', route: '/mes-sorties' },
    { icon: '➕', label: 'Créer', route: '/sorties/creer' },
    { icon: '👥', label: 'Membres', route: '/membres' },
    { icon: '💬', label: 'Messages', route: '/messages' },
    { icon: '🔔', label: 'Notifs', route: '/notifications' },
  ];

  unreadCount = 0;
  isAdmin = false;

  constructor(
    public router: Router,
    private drawerService: DrawerService,
    private auth: AuthService,
    private profileService: ProfileService,
    private notifService: NotificationService
  ) {}

  async ngOnInit() {
    const { data: { user } } = await this.auth.getUser();
    if (user) {
      const [count, profile] = await Promise.all([
        this.notifService.countUnread(user.id),
        this.profileService.getMyProfile(user.id)
      ]);
      this.unreadCount = count;
      this.isAdmin = profile.data?.role === 'admin' || profile.data?.role === 'developer';
    }
  }

  navigate(route: string) {
    if (route === '/notifications') this.unreadCount = 0;
    this.drawerService.closeAll();
    this.router.navigate([route]);
  }

  isActive(route: string): boolean {
    return this.router.url === route;
  }
}
