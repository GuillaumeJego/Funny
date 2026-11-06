import {
  Component,
  OnDestroy,
  OnInit,
  ChangeDetectionStrategy,
  inject,
  signal,
} from '@angular/core';

import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
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
export class NavbarMainComponent implements OnInit, OnDestroy {
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

  /** Badge des notifications : tenu à jour en direct par le service. */
  readonly unreadCount = this.notifService.unreadCount;
  /** Notification qui vient d'arriver, affichée quelques secondes en bas de l'écran. */
  readonly toast = this.notifService.toast;
  readonly pendingFriendsCount = signal(0);
  readonly isAdmin = signal(false);
  private userId = '';
  private incomingSub?: Subscription;

  async ngOnInit() {
    const {
      data: { user },
    } = await this.auth.getUser();
    if (user) {
      this.userId = user.id;
      const [, profile, pendingFriends] = await Promise.all([
        this.notifService.startListening(user.id),
        this.profileService.getMyProfile(user.id),
        this.friendshipService.getPendingReceivedCount(user.id),
      ]);
      this.pendingFriendsCount.set(pendingFriends);
      // Une demande d'ami arrive avec sa notification : on recompte le badge Amis.
      this.incomingSub = this.notifService.incoming$.subscribe(() => this.refreshFriendsCount());
      this.isAdmin.set(profile.data?.role === 'admin' || profile.data?.role === 'developer');
    }
  }

  ngOnDestroy() {
    // La barre disparaît à la déconnexion : on arrête d'écouter.
    this.incomingSub?.unsubscribe();
    this.notifService.stop();
  }

  private async refreshFriendsCount() {
    if (!this.userId) return;
    this.pendingFriendsCount.set(await this.friendshipService.getPendingReceivedCount(this.userId));
  }

  openToast() {
    this.notifService.hideToast();
    this.navigate('/notifications');
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
