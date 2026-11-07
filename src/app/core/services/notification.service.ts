import { Injectable, inject, signal } from '@angular/core';
import { Subject } from 'rxjs';
import { AppNotification, NotificationRepository } from '../repositories/notification.repository';
import { Unsubscribe } from '../repositories/repository.types';

export type Notification = AppNotification;

// Les notifications sont envoyées par le serveur (inscription, like, demande d'ami…).
@Injectable({ providedIn: 'root' })
export class NotificationService {
  private notifications = inject(NotificationRepository);

  /** Nombre de notifications non lues, tenu à jour en direct (badge du menu). */
  readonly unreadCount = signal(0);
  /** Dernière notification arrivée pendant la visite, affichée quelques secondes. */
  readonly toast = signal<Notification | null>(null);
  /** Chaque nouvelle notification, au moment où elle arrive. */
  readonly incoming$ = new Subject<Notification>();

  private stopListening: Unsubscribe | null = null;
  private listeningFor = '';
  private toastTimer: ReturnType<typeof setTimeout> | undefined;

  /** Charge le compteur et écoute les nouvelles notifications du membre connecté. */
  async startListening(userId: string) {
    if (this.listeningFor === userId) return;
    this.stopListening?.();
    this.listeningFor = userId;
    this.unreadCount.set(await this.notifications.countUnread(userId));
    this.stopListening = this.notifications.onNew(userId, (n) => {
      this.unreadCount.update((count) => count + 1);
      this.showToast(n);
      this.incoming$.next(n);
    });
  }

  stop() {
    this.stopListening?.();
    this.stopListening = null;
    this.listeningFor = '';
    this.hideToast();
  }

  hideToast() {
    clearTimeout(this.toastTimer);
    this.toast.set(null);
  }

  showToast(n: Notification) {
    clearTimeout(this.toastTimer);
    this.toast.set(n);
    this.toastTimer = setTimeout(() => this.toast.set(null), 5000);
  }

  /**
   * Page à ouvrir quand on touche la notification : celle indiquée par le serveur, sinon
   * le profil du membre à l'origine (anciennes notifications), sinon aucune.
   */
  targetOf(n: Notification): string | null {
    // Seulement une page de l'application (« /… »), jamais un autre site (« //… »).
    if (n.link && n.link.startsWith('/') && !n.link.startsWith('//')) return n.link;
    if (n.actor_id) return `/membres/${n.actor_id}`;
    return null;
  }

  async getMyNotifications(userId: string) {
    return await this.notifications.getForUser(userId);
  }

  async countUnread(userId: string): Promise<number> {
    return await this.notifications.countUnread(userId);
  }

  async markAllRead(userId: string) {
    this.unreadCount.set(0);
    return await this.notifications.markAllRead(userId);
  }
}
