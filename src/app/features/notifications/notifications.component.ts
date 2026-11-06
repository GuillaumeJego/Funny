import { Component, OnInit, ChangeDetectionStrategy, inject } from '@angular/core';

import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { NotificationService, Notification } from '../../core/services/notification.service';

@Component({
  selector: 'app-notifications',
  standalone: true,
  imports: [],
  templateUrl: './notifications.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './notifications.component.scss',
})
export class NotificationsComponent implements OnInit {
  private auth = inject(AuthService);
  private notifService = inject(NotificationService);
  private router = inject(Router);

  notifications: Notification[] = [];
  loading = true;
  userId = '';

  async ngOnInit() {
    const {
      data: { user },
    } = await this.auth.getUser();
    if (!user) {
      this.router.navigate(['/login']);
      return;
    }
    this.userId = user.id;

    const { data } = await this.notifService.getMyNotifications(user.id);
    this.notifications = (data ?? []) as Notification[];
    this.loading = false;

    // Marquer toutes comme lues après affichage
    await this.notifService.markAllRead(user.id);
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
