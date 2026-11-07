import { Injectable, computed, inject, signal } from '@angular/core';
import { ConversationRepository } from '../repositories/conversation.repository';
import { Unsubscribe } from '../repositories/repository.types';
import { NotificationService } from './notification.service';

/**
 * Messages reçus et pas encore lus, tenus à jour en direct : badge « Messages » du menu
 * et pastille de chaque conversation.
 */
@Injectable({ providedIn: 'root' })
export class UnreadMessagesService {
  private conversations = inject(ConversationRepository);
  private notifications = inject(NotificationService);

  /** Non lus par conversation (absente si zéro). */
  readonly byConversation = signal(new Map<string, number>());
  readonly total = computed(() => [...this.byConversation().values()].reduce((a, b) => a + b, 0));

  private userId = '';
  /** Conversation ouverte à l'écran : ses messages sont lus dès qu'ils arrivent. */
  private openConversation = '';
  private stopListening: Unsubscribe | null = null;

  async startListening(userId: string) {
    if (this.userId === userId) return;
    this.stop();
    this.userId = userId;
    this.stopListening = this.conversations.onAnyNewMessage((m) => {
      if (m.sender_id === this.userId) return;
      if (m.conversation_id === this.openConversation) {
        this.conversations.markRead(m.conversation_id, this.userId);
        return;
      }
      this.byConversation.update((map) =>
        new Map(map).set(m.conversation_id, (map.get(m.conversation_id) ?? 0) + 1),
      );
      // Petit message en bas de l'écran ; un clic ouvre la conversation.
      this.notifications.showToast({
        id: `message-${Date.now()}`,
        user_id: this.userId,
        title: '💬 Nouveau message',
        message: 'Tu as reçu un nouveau message.',
        read: false,
        created_at: new Date().toISOString(),
        link: `/messages/${m.conversation_id}`,
      });
    });
    try {
      this.byConversation.set(await this.conversations.getUnreadCounts(userId));
    } catch {
      // Table pas encore créée sur le serveur : pas de badge, rien de cassé.
    }
  }

  stop() {
    this.stopListening?.();
    this.stopListening = null;
    this.userId = '';
    this.openConversation = '';
    this.byConversation.set(new Map());
  }

  /** La conversation est à l'écran : tout est lu, et ce qui arrive le sera aussi. */
  async opened(conversationId: string, userId: string) {
    this.openConversation = conversationId;
    this.clear(conversationId);
    await this.conversations.markRead(conversationId, userId).catch(() => undefined);
  }

  /** On quitte la conversation : on note qu'elle est lue jusqu'ici. */
  async closed(conversationId: string, userId: string) {
    if (this.openConversation === conversationId) this.openConversation = '';
    await this.conversations.markRead(conversationId, userId).catch(() => undefined);
  }

  private clear(conversationId: string) {
    this.byConversation.update((map) => {
      const next = new Map(map);
      next.delete(conversationId);
      return next;
    });
  }
}
