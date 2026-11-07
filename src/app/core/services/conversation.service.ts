import { Injectable, inject } from '@angular/core';
import { ConversationRepository } from '../repositories/conversation.repository';
import { StorageRepository } from '../repositories/storage.repository';
import { Unsubscribe } from '../repositories/repository.types';
import { Message, Conversation } from '../models/message.model';

@Injectable({ providedIn: 'root' })
export class ConversationService {
  private conversations = inject(ConversationRepository);
  private storage = inject(StorageRepository);

  // Ouvre (ou retrouve) la conversation avec un ami : le serveur vérifie l'amitié
  async getOrCreateConversation(_myId: string, friendId: string): Promise<string> {
    return await this.conversations.open(friendId);
  }

  async getConversations(userId: string): Promise<Conversation[]> {
    let conversations = await this.conversations.getForUser(userId);

    conversations.sort((a, b) => {
      const ta = a.last_message?.created_at ?? a.created_at;
      const tb = b.last_message?.created_at ?? b.created_at;
      return new Date(tb).getTime() - new Date(ta).getTime();
    });

    // Déduplique : une seule conversation par binôme d'utilisateurs (garde la plus récente)
    const seen = new Map<string, Conversation>();
    for (const conv of conversations) {
      const other = conv.participants?.find((p: any) => p.user_id !== userId);
      // Une discussion de groupe (sortie) n'est jamais un doublon d'une conversation à deux.
      const key = conv.sortie_id ? conv.id : (other?.user_id ?? conv.id);
      if (!seen.has(key)) seen.set(key, conv);
    }
    conversations = [...seen.values()];

    return conversations;
  }

  // Discussion de groupe d'une sortie : le serveur vérifie qu'on y participe
  async openSortieChat(sortieId: string): Promise<string> {
    return await this.conversations.openSortieChat(sortieId);
  }

  async getConversation(conversationId: string): Promise<Conversation | null> {
    return await this.conversations.getConversation(conversationId);
  }

  // L'autre membre de la conversation (pour signaler ou bloquer depuis le chat)
  async getOtherParticipant(conversationId: string, myId: string): Promise<string | null> {
    return await this.conversations.getOtherParticipant(conversationId, myId);
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
    mediaFileId?: string,
  ): Promise<Message | null> {
    return await this.conversations.sendMessage({
      conversation_id: conversationId,
      sender_id: senderId,
      content: content || null,
      type,
      reply_to_id: replyToId || null,
      media_file_id: mediaFileId || null,
    });
  }

  async toggleReaction(messageId: string, userId: string, emoji: string, currentEmoji?: string) {
    if (currentEmoji === emoji) {
      await this.conversations.removeReaction(messageId, userId);
    } else {
      await this.conversations.setReaction(messageId, userId, emoji);
    }
  }

  // Envoie une photo ou une vidéo, lisible par les seuls participants ; renvoie son identifiant
  async uploadMedia(file: File, userId: string, conversationId: string): Promise<string | null> {
    const { data } = await this.storage.uploadChatMedia(userId, conversationId, file);
    return data;
  }

  // Écoute les nouveaux messages de toutes ses conversations (liste des conversations)
  subscribeToAllMessages(
    callback: (message: { conversation_id: string; sender_id: string }) => void,
  ): Unsubscribe {
    return this.conversations.onAnyNewMessage(callback);
  }

  async getReactions(messageId: string) {
    return await this.conversations.getReactions(messageId);
  }

  // Écoute les réactions (ajoutées, changées, retirées) ; donne le message concerné
  subscribeToReactions(conversationId: string, callback: (messageId: string) => void): Unsubscribe {
    return this.conversations.onReactionChange(conversationId, callback);
  }

  // Écoute les nouveaux messages ; appeler la fonction renvoyée pour arrêter
  subscribeToMessages(conversationId: string, callback: (message: Message) => void): Unsubscribe {
    return this.conversations.onNewMessage(conversationId, callback);
  }
}
