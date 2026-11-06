import { Component, OnInit, ChangeDetectionStrategy, inject, signal } from '@angular/core';

import { Router } from '@angular/router';
import { DrawerService } from '../../services/drawer.service';
import { AuthService } from '../../services/auth.service';
import { ProfileService } from '../../services/profile.service';
import { NotificationService } from '../../services/notification.service';
import { FriendshipService } from '../../services/friendship.service';
import { ClickableDirective } from '../../directives/clickable.directive';

@Component({
  selector: 'app-navbar-main',
  standalone: true,
  imports: [ClickableDirective],
  templateUrl: './navbar-main.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './navbar-main.component.scss',
})
export class NavbarMainComponent implements OnInit {
  router = inject(Router);
  private drawerService = inject(DrawerService);
  private auth = inject(AuthService);
  private profileService = inject(ProfileService);
  private notifService = inject(NotificationService);
  private friendshipService = inject(FriendshipService);

  navItems = [
    { icon: '🏠', label: 'Sorties', route: '/dashboard' },
    { icon: '⭐', label: 'Mes sorties', route: '/mes-sorties' },
    { icon: '➕', label: 'Créer', route: '/sorties/creer' },
    { icon: '👥', label: 'Membres', route: '/membres' },
    { icon: '🤝', label: 'Amis', route: '/amis' },
    { icon: '💬', label: 'Messages', route: '/messages' },
    { icon: '🔔', label: 'Notifs', route: '/notifications' },
  ];

  readonly unreadCount = signal(0);
  readonly pendingFriendsCount = signal(0);
  readonly isAdmin = signal(false);

  async ngOnInit() {
    const {
      data: { user },
    } = await this.auth.getUser();
    if (user) {
      const [count, profile, pendingFriends] = await Promise.all([
        this.notifService.countUnread(user.id),
        this.profileService.getMyProfile(user.id),
        this.friendshipService.getPendingReceivedCount(user.id),
      ]);
      this.unreadCount.set(count);
      this.pendingFriendsCount.set(pendingFriends);
      this.isAdmin.set(profile.data?.role === 'admin' || profile.data?.role === 'developer');
    }
  }

  navigate(route: string) {
    if (route === '/notifications') this.unreadCount.set(0);
    this.drawerService.closeAll();
    this.router.navigate([route]);
  }

  isActive(route: string): boolean {
    return this.router.url === route;
  }
}
