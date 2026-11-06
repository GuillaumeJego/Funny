import { Component, OnInit, ChangeDetectionStrategy, inject } from '@angular/core';

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
  changeDetection: ChangeDetectionStrategy.Eager,
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

  unreadCount = 0;
  pendingFriendsCount = 0;
  isAdmin = false;

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
      this.unreadCount = count;
      this.pendingFriendsCount = pendingFriends;
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
