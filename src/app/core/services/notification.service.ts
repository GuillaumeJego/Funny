import { Injectable } from '@angular/core';
import {
  AppNotification,
  NewNotification,
  NotificationRepository,
} from '../repositories/notification.repository';
import { ProfileRepository } from '../repositories/profile.repository';

export type Notification = AppNotification;

@Injectable({ providedIn: 'root' })
export class NotificationService {
  constructor(
    private notifications: NotificationRepository,
    private profiles: ProfileRepository,
  ) {}

  async getMyNotifications(userId: string) {
    return await this.notifications.getForUser(userId);
  }

  async countUnread(userId: string): Promise<number> {
    return await this.notifications.countUnread(userId);
  }

  async markAllRead(userId: string) {
    return await this.notifications.markAllRead(userId);
  }

  async createMany(notifications: NewNotification[]) {
    return await this.notifications.createMany(notifications);
  }

  async notifyFriendRequest(receiverId: string, actorId: string) {
    if (receiverId === actorId) return;
    const actor = await this.getUsername(actorId);
    await this.notifications.createMany([
      {
        user_id: receiverId,
        title: "👥 Demande d'ami",
        message: `${actor} vous a envoyé une demande d'ami`,
        actor_id: actorId,
      },
    ]);
  }

  async notifyOrganizer(
    organizerId: string,
    actorId: string,
    sortieTitle: string,
    type: 'joined' | 'waiting' | 'left' | 'liked',
  ) {
    if (organizerId === actorId) return; // pas de notif à soi-même
    const actor = await this.getUsername(actorId);
    const msgs: Record<typeof type, { title: string; message: string }> = {
      joined: {
        title: '✅ Nouvelle inscription',
        message: `${actor} a rejoint votre sortie « ${sortieTitle} »`,
      },
      waiting: {
        title: "⏳ Liste d'attente",
        message: `${actor} est en liste d'attente pour « ${sortieTitle} »`,
      },
      left: {
        title: '🚪 Désinscription',
        message: `${actor} a quitté votre sortie « ${sortieTitle} »`,
      },
      liked: {
        title: '❤️ Nouveau like',
        message: `${actor} a aimé votre sortie « ${sortieTitle} »`,
      },
    };
    const { title, message } = msgs[type];
    await this.notifications.createMany([
      { user_id: organizerId, title, message, actor_id: actorId },
    ]);
  }

  private async getUsername(userId: string): Promise<string> {
    const [profile] = await this.profiles.getMiniProfiles([userId]);
    return profile?.username ?? 'Un membre';
  }
}
