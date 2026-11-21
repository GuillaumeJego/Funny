import { Injectable, inject } from '@angular/core';
import { ConversationRepository } from '../repositories/conversation.repository';
import { StorageRepository } from '../repositories/storage.repository';
import { Unsubscribe } from '../repositories/repository.types';
import { Message, Conversation, MessageType, ReadState } from '../models/message.model';

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
    type: MessageType = 'text',
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
  // (éphémère : lisible par personne, le serveur la sert une fois à chacun)
  async uploadMedia(
    file: File,
    userId: string,
    conversationId: string,
    ephemeral = false,
  ): Promise<string | null> {
    const { data } = await this.storage.uploadChatMedia(userId, conversationId, file, ephemeral);
    return data;
  }

  // ── Messages éphémères (« voir une fois ») ──
  async sendEphemeral(
    conversationId: string,
    type: MessageType,
    content: string | null,
    mediaFileId: string | null = null,
  ) {
    return await this.conversations.sendEphemeral(conversationId, type, content, mediaFileId);
  }

  async openEphemeral(messageId: string) {
    return await this.conversations.openEphemeral(messageId);
  }

  async askToSeeAgain(messageId: string) {
    return await this.conversations.askToSeeAgain(messageId);
  }

  async answerSeeAgain(messageId: string, memberId: string, accept: boolean) {
    return await this.conversations.answerSeeAgain(messageId, memberId, accept);
  }

  // ── Modifier et supprimer ses messages ──
  async editMessage(messageId: string, content: string) {
    return await this.conversations.editMessage(messageId, content);
  }

  async deleteMessage(messageId: string) {
    return await this.conversations.deleteMessage(messageId);
  }

  subscribeToMessageUpdates(
    conversationId: string,
    callback: (message: Message) => void,
  ): Unsubscribe {
    return this.conversations.onMessageUpdate(conversationId, callback);
  }

  async getReadStates(conversationId: string): Promise<ReadState[]> {
    return await this.conversations.getReadStates(conversationId);
  }

  subscribeToReads(conversationId: string, callback: (read: ReadState) => void): Unsubscribe {
    return this.conversations.onReadChange(conversationId, callback);
  }

  async getEphemeralViews(messageId: string) {
    return await this.conversations.getEphemeralViews(messageId);
  }

  subscribeToEphemeralViews(
    conversationId: string,
    callback: (messageId: string) => void,
  ): Unsubscribe {
    return this.conversations.onEphemeralViewChange(conversationId, callback);
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
