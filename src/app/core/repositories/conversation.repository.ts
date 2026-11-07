import { Conversation, Message, MessageReaction } from '../models/message.model';
import { Unsubscribe } from './repository.types';

export interface NewMessage {
  conversation_id: string;
  sender_id: string;
  content: string | null;
  type: 'text' | 'image' | 'video';
  reply_to_id: string | null;
  /** Identifiant du fichier envoyé avec StorageRepository.uploadChatMedia. */
  media_file_id: string | null;
}

export abstract class ConversationRepository {
  /** Ouvre (ou retrouve) la conversation avec un ami ; renvoie son identifiant. */
  abstract open(otherUserId: string): Promise<string>;
  /** Conversations du membre, avec leurs participants et leur dernier message. */
  abstract getForUser(userId: string): Promise<Conversation[]>;
  /** L'autre membre de la conversation, ou null si elle n'est pas lisible. */
  abstract getOtherParticipant(conversationId: string, userId: string): Promise<string | null>;
  abstract getMessages(conversationId: string): Promise<Message[]>;
  abstract sendMessage(message: NewMessage): Promise<Message | null>;
  abstract setReaction(messageId: string, userId: string, emoji: string): Promise<void>;
  abstract removeReaction(messageId: string, userId: string): Promise<void>;
  /** Prévient à chaque nouveau message de la conversation, avec le message prêt à afficher. */
  abstract onNewMessage(conversationId: string, callback: (message: Message) => void): Unsubscribe;
  /** Prévient à chaque nouveau message, dans n'importe laquelle de ses conversations. */
  abstract onAnyNewMessage(
    callback: (message: { conversation_id: string; sender_id: string }) => void,
  ): Unsubscribe;
  /** Nombre de messages reçus et pas encore lus, par conversation (absentes si zéro). */
  abstract getUnreadCounts(userId: string): Promise<Map<string, number>>;
  /** Note que le membre a lu la conversation jusqu'à maintenant. */
  abstract markRead(conversationId: string, userId: string): Promise<void>;
  /** Réactions d'un message (celles qui viennent vraiment de leur auteur). */
  abstract getReactions(messageId: string): Promise<MessageReaction[]>;
  /** Prévient quand une réaction est ajoutée, changée ou retirée : donne le message concerné. */
  abstract onReactionChange(
    conversationId: string,
    callback: (messageId: string) => void,
  ): Unsubscribe;
}
