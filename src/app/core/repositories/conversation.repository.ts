import { Conversation, Message } from '../models/message.model';
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
  abstract onNewMessage(conversationId: string, callback: () => void): Unsubscribe;
}
