import {
  Component,
  OnDestroy,
  OnInit,
  ChangeDetectionStrategy,
  inject,
  signal,
} from '@angular/core';

import { NavigationEnd, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs/operators';
import { Subscription } from 'rxjs';
import { DrawerService } from '../../services/drawer.service';
import { AuthService } from '../../services/auth.service';
import { NotificationService } from '../../services/notification.service';
import { FriendshipService } from '../../services/friendship.service';
import { UnreadMessagesService } from '../../services/unread-messages.service';

@Component({
  selector: 'app-navbar-main',
  standalone: true,
  templateUrl: './navbar-main.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './navbar-main.component.scss',
})
export class NavbarMainComponent implements OnInit, OnDestroy {
  router = inject(Router);
  private drawerService = inject(DrawerService);
  private auth = inject(AuthService);
  private notifService = inject(NotificationService);
  private friendshipService = inject(FriendshipService);
  private unreadMessages = inject(UnreadMessagesService);

  /** Les 5 onglets du bas, comme le prototype ; « match » liste les pages qui allument l'onglet. */
  navItems: NavItem[] = [
    { key: 'sorties', label: 'Sorties', route: '/dashboard', match: ['/dashboard', '/sorties/'] },
    { key: 'membres', label: 'Membres', route: '/membres', match: ['/membres', '/amis'] },
    // Au milieu : le gros bouton jaune.
    { key: 'creer', label: 'Créer', route: '/sorties/creer', match: ['/sorties/creer'] },
    { key: 'mes-sorties', label: 'Mes sorties', route: '/mes-sorties', match: ['/mes-sorties'] },
    { key: 'messages', label: 'Messages', route: '/messages', match: ['/messages'] },
  ];

  /** Page affichée, suivie en direct pour allumer le bon onglet. */
  private readonly url = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );

  /** Badge des notifications : tenu à jour en direct par le service. */
  readonly unreadCount = this.notifService.unreadCount;
  /** Notification qui vient d'arriver, affichée quelques secondes en bas de l'écran. */
  readonly toast = this.notifService.toast;
  readonly pendingFriendsCount = signal(0);
  /** Badge « Messages » : messages reçus pas encore lus, en direct. */
  readonly unreadMessagesCount = this.unreadMessages.total;
  private userId = '';
  private incomingSub?: Subscription;

  async ngOnInit() {
    const {
      data: { user },
    } = await this.auth.getUser();
    if (user) {
      this.userId = user.id;
      const [, , pendingFriends] = await Promise.all([
        this.notifService.startListening(user.id),
        this.unreadMessages.startListening(user.id),
        this.friendshipService.getPendingReceivedCount(user.id),
      ]);
      this.pendingFriendsCount.set(pendingFriends);
      // Une demande d'ami arrive avec sa notification : on recompte le badge Amis.
      this.incomingSub = this.notifService.incoming$.subscribe(() => this.refreshFriendsCount());
    }
  }

  ngOnDestroy() {
    // La barre disparaît à la déconnexion : on arrête d'écouter.
    this.incomingSub?.unsubscribe();
    this.notifService.stop();
    this.unreadMessages.stop();
  }

  private async refreshFriendsCount() {
    if (!this.userId) return;
    this.pendingFriendsCount.set(await this.friendshipService.getPendingReceivedCount(this.userId));
  }

  /** La notification ouvre directement ce dont elle parle (sortie, profil…). */
  openToast() {
    const n = this.notifService.toast();
    this.notifService.hideToast();
    const target = n ? this.notifService.targetOf(n) : null;
    if (!target) {
      this.navigate('/notifications');
      return;
    }
    this.drawerService.closeAll();
    this.router.navigateByUrl(target);
  }

  navigate(route: string) {
    this.drawerService.closeAll();
    this.router.navigate([route]);
  }

  isActive(item: NavItem): boolean {
    const url = this.url().split('?')[0];
    if (item.key === 'sorties' && url.startsWith('/sorties/creer')) return false;
    return item.match.some((m) => url === m || url.startsWith(m.endsWith('/') ? m : m + '/'));
  }
}

interface NavItem {
  key: 'sorties' | 'membres' | 'creer' | 'mes-sorties' | 'messages';
  label: string;
  route: string;
  match: string[];
}
