import { Injectable } from '@angular/core';
import { ConversationRepository } from '../repositories/conversation.repository';
import { StorageRepository } from '../repositories/storage.repository';
import { Unsubscribe } from '../repositories/repository.types';
import { Message, Conversation } from '../models/message.model';

@Injectable({ providedIn: 'root' })
export class ConversationService {
  constructor(
    private conversations: ConversationRepository,
    private storage: StorageRepository,
  ) {}

  async getOrCreateConversation(userId1: string, userId2: string): Promise<string> {
    const ids = await this.conversations.getConversationIds(userId1);
    const shared = await this.conversations.findShared(userId2, ids);
    if (shared.length) return shared[0];
    return await this.conversations.create([userId1, userId2]);
  }

  async getConversations(userId: string): Promise<Conversation[]> {
    const convIds = await this.conversations.getConversationIds(userId);
    let conversations = await this.conversations.getWithLastMessage(convIds);

    conversations.sort((a, b) => {
      const ta = a.last_message?.created_at ?? a.created_at;
      const tb = b.last_message?.created_at ?? b.created_at;
      return new Date(tb).getTime() - new Date(ta).getTime();
    });

    // Déduplique : une seule conversation par binôme d'utilisateurs (garde la plus récente)
    const seen = new Map<string, Conversation>();
    for (const conv of conversations) {
      const other = conv.participants?.find((p: any) => p.user_id !== userId);
      const key = other?.user_id ?? conv.id;
      if (!seen.has(key)) seen.set(key, conv);
    }
    conversations = [...seen.values()];

    return conversations;
  }

  async getMessages(conversationId: string): Promise<Message[]> {
    return await this.conversations.getMessages(conversationId);
  }

  async sendMessage(
    conversationId: string,
    senderId: string,
    content: string,
    type: 'text' | 'image' | 'video' = 'text',
    replyToId?: string,
    mediaUrl?: string,
  ): Promise<Message | null> {
    return await this.conversations.sendMessage({
      conversation_id: conversationId,
      sender_id: senderId,
      content: content || null,
      type,
      reply_to_id: replyToId || null,
      media_url: mediaUrl || null,
    });
  }

  async toggleReaction(messageId: string, userId: string, emoji: string, currentEmoji?: string) {
    if (currentEmoji === emoji) {
      await this.conversations.removeReaction(messageId, userId);
    } else {
      await this.conversations.setReaction(messageId, userId, emoji);
    }
  }

  async uploadMedia(file: File, userId: string): Promise<string | null> {
    const { data } = await this.storage.uploadChatMedia(userId, file);
    return data;
  }

  // Écoute les nouveaux messages ; appeler la fonction renvoyée pour arrêter
  subscribeToMessages(conversationId: string, callback: () => void): Unsubscribe {
    return this.conversations.onNewMessage(conversationId, callback);
  }
}
