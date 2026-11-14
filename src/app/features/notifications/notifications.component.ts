import {
  Component,
  OnDestroy,
  OnInit,
  ChangeDetectionStrategy,
  inject,
  signal,
} from '@angular/core';

import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { ClickableDirective } from '../../core/directives/clickable.directive';
import { AuthService } from '../../core/services/auth.service';
import { NotificationService, Notification } from '../../core/services/notification.service';
import { ProfileLinkDirective } from '../../core/directives/profile-link.directive';
import { ProfileService } from '../../core/services/profile.service';
import { MiniProfile } from '../../core/repositories/repository.types';

type Tab = 'notifs' | 'visites';

@Component({
  selector: 'app-notifications',
  standalone: true,
  imports: [ProfileLinkDirective, ClickableDirective, RouterLink],
  templateUrl: './notifications.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './notifications.component.scss',
})
export class NotificationsComponent implements OnInit, OnDestroy {
  private auth = inject(AuthService);
  private notifService = inject(NotificationService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private profiles = inject(ProfileService);

  /** Onglet affiché : notifications ou visites de mon profil (?onglet=visites). */
  readonly tab = signal<Tab>('notifs');
  readonly visits = signal<{ at: string; visitor?: MiniProfile }[]>([]);
  readonly visitsPremium = signal(false);
  readonly visitsLoading = signal(true);
  private querySub?: Subscription;

  readonly notifications = signal<Notification[]>([]);
  readonly loading = signal(true);
  userId = '';
  private incomingSub?: Subscription;

  async ngOnInit() {
    const {
      data: { user },
    } = await this.auth.getUser();
    if (!user) {
      this.router.navigate(['/login']);
      return;
    }
    this.userId = user.id;

    // La notification « visite » ouvre directement l'onglet Visites, même depuis cette page.
    this.querySub = this.route.queryParamMap.subscribe((params) =>
      this.tab.set(params.get('onglet') === 'visites' ? 'visites' : 'notifs'),
    );
    void this.loadVisits();

    const { data } = await this.notifService.getMyNotifications(user.id);
    this.notifications.set((data ?? []) as Notification[]);
    this.loading.set(false);

    // Une notification qui arrive pendant qu'on regarde la page s'ajoute en haut de la liste.
    this.incomingSub = this.notifService.incoming$.subscribe((n) => {
      this.notifService.hideToast();
      this.notifications.update((list) => (list.some((x) => x.id === n.id) ? list : [n, ...list]));
      this.notifService.markAllRead(user.id);
    });

    // Marquer toutes comme lues après affichage
    await this.notifService.markAllRead(user.id);
  }

  ngOnDestroy() {
    this.incomingSub?.unsubscribe();
    this.querySub?.unsubscribe();
  }

  setTab(tab: Tab) {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { onglet: tab === 'visites' ? 'visites' : null },
      replaceUrl: true,
    });
  }

  private async loadVisits() {
    const result = await this.profiles.getProfileVisits();
    this.visits.set(result?.visits ?? []);
    this.visitsPremium.set(result?.premium ?? false);
    this.visitsLoading.set(false);
  }

  targetOf(n: Notification): string | null {
    return this.notifService.targetOf(n);
  }

  open(n: Notification) {
    const target = this.targetOf(n);
    if (target) this.router.navigateByUrl(target);
  }

  formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
}
