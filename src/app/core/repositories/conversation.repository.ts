import { Conversation, Message } from '../models/message.model';
import { Unsubscribe } from './repository.types';

export interface NewMessage {
  conversation_id: string;
  sender_id: string;
  content: string | null;
  type: 'text' | 'image' | 'video';
  reply_to_id: string | null;
  media_url: string | null;
}

export abstract class ConversationRepository {
  abstract getConversationIds(userId: string): Promise<string[]>;
  /** Parmi `conversationIds`, celles où `userId` participe aussi. */
  abstract findShared(userId: string, conversationIds: string[]): Promise<string[]>;
  abstract create(participantIds: string[]): Promise<string>;
  /** Conversations avec leurs participants et leur dernier message. */
  abstract getWithLastMessage(conversationIds: string[]): Promise<Conversation[]>;
  abstract getMessages(conversationId: string): Promise<Message[]>;
  abstract sendMessage(message: NewMessage): Promise<Message | null>;
  abstract setReaction(messageId: string, userId: string, emoji: string): Promise<void>;
  abstract removeReaction(messageId: string, userId: string): Promise<void>;
  abstract onNewMessage(conversationId: string, callback: () => void): Unsubscribe;
}
