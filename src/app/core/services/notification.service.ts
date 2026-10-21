import { Injectable } from '@angular/core';
import { AppNotification, NotificationRepository } from '../repositories/notification.repository';

export type Notification = AppNotification;

// Les notifications sont envoyées par le serveur (inscription, like, demande d'ami…).
@Injectable({ providedIn: 'root' })
export class NotificationService {
  constructor(private notifications: NotificationRepository) {}

  async getMyNotifications(userId: string) {
    return await this.notifications.getForUser(userId);
  }

  async countUnread(userId: string): Promise<number> {
    return await this.notifications.countUnread(userId);
  }

  async markAllRead(userId: string) {
    return await this.notifications.markAllRead(userId);
  }
}
