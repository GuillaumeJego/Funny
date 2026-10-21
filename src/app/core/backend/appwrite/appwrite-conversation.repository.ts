import { Injectable } from '@angular/core';
import { Channel, ID, Models, Permission, Query, Role } from 'appwrite';
import { Conversation, Message, MessageReaction } from '../../models/message.model';
import { ConversationRepository, NewMessage } from '../../repositories/conversation.repository';
import { Unsubscribe } from '../../repositories/repository.types';
import { AppwriteClientService, DB } from './appwrite-client';
import { fromRow } from './rows';

type MessageRow = Models.Row & Omit<NewMessage, 'media_file_id'> & { media_file_id: string | null };
type ConversationRow = Models.Row & { participant_ids: string[] };
type ReactionRow = Models.Row & MessageReaction & { conversation_id: string };

/**
 * Chaque conversation est une équipe Appwrite à deux membres, créée par le serveur.
 * Messages, réactions et fichiers sont lisibles par cette équipe seulement.
 */
@Injectable()
export class AppwriteConversationRepository extends ConversationRepository {
  /** Fichiers privés déjà chargés, pour ne pas les retélécharger à chaque nouveau message. */
  private mediaUrls = new Map<string, Promise<string | null>>();

  constructor(private appwrite: AppwriteClientService) {
    super();
  }

  async open(otherUserId: string): Promise<string> {
    const { data, error } = await this.appwrite.run<{ conversationId: string }>(
      'social',
      'openConversation',
      { userId: otherUserId },
    );
    if (error || !data) throw new Error(error?.message ?? 'Conversation impossible.');
    return data.conversationId;
  }

  async getForUser(userId: string): Promise<Conversation[]> {
    const rows = await this.appwrite.listAll<ConversationRow>('conversations', [
      Query.contains('participant_ids', userId),
    ]);
    const profiles = await this.appwrite.miniProfiles(rows.flatMap((r) => r.participant_ids));
    return Promise.all(
      rows.map(async (row) => {
        const page = await this.appwrite.tables.listRows<MessageRow>({
          databaseId: DB,
          tableId: 'messages',
          queries: [
            Query.equal('conversation_id', row.$id),
            Query.orderDesc('$createdAt'),
            Query.limit(1),
          ],
        });
        const last = page.rows[0];
        return {
          id: row.$id,
          created_at: row.$createdAt,
          participants: row.participant_ids.map((id) => ({ user_id: id, user: profiles.get(id) })),
          last_message: last ? this.toMessage(last) : null,
        };
      }),
    );
  }

  async getOtherParticipant(conversationId: string, userId: string): Promise<string | null> {
    const row = await this.appwrite.getRowOrNull<ConversationRow>('conversations', conversationId);
    return row?.participant_ids.find((id) => id !== userId) ?? null;
  }

  async getMessages(conversationId: string): Promise<Message[]> {
    const [rows, reactions] = await Promise.all([
      this.appwrite.listAll<MessageRow>('messages', [
        Query.equal('conversation_id', conversationId),
        Query.orderAsc('$createdAt'),
      ]),
      this.appwrite.listAll<ReactionRow>('message_reactions', [
        Query.equal('conversation_id', conversationId),
      ]),
    ]);
    return this.enrich(rows, reactions);
  }

  async sendMessage(message: NewMessage): Promise<Message | null> {
    try {
      const row = await this.appwrite.tables.createRow<MessageRow>({
        databaseId: DB,
        tableId: 'messages',
        rowId: ID.unique(),
        data: message,
        permissions: this.permissions(message.conversation_id, message.sender_id),
      });
      const replied = message.reply_to_id
        ? await this.appwrite.getRowOrNull<MessageRow>('messages', message.reply_to_id)
        : null;
      const [enriched] = await this.enrich([row], [], replied ? [replied] : []);
      return enriched;
    } catch {
      return null;
    }
  }

  async setReaction(messageId: string, userId: string, emoji: string): Promise<void> {
    const existing = await this.ownReaction(messageId, userId);
    if (existing) {
      await this.appwrite.tables.updateRow({
        databaseId: DB,
        tableId: 'message_reactions',
        rowId: existing.$id,
        data: { emoji },
      });
      return;
    }
    const message = await this.appwrite.tables.getRow<MessageRow>({
      databaseId: DB,
      tableId: 'messages',
      rowId: messageId,
    });
    await this.appwrite.tables.createRow({
      databaseId: DB,
      tableId: 'message_reactions',
      rowId: ID.unique(),
      data: {
        message_id: messageId,
        conversation_id: message.conversation_id,
        user_id: userId,
        emoji,
      },
      permissions: this.permissions(message.conversation_id, userId),
    });
  }

  async removeReaction(messageId: string, userId: string): Promise<void> {
    const existing = await this.ownReaction(messageId, userId);
    if (existing) {
      await this.appwrite.tables.deleteRow({
        databaseId: DB,
        tableId: 'message_reactions',
        rowId: existing.$id,
      });
    }
  }

  onNewMessage(conversationId: string, callback: () => void): Unsubscribe {
    return this.appwrite.client.subscribe<MessageRow>(
      Channel.tablesdb(DB).table('messages').row().create(),
      (event) => {
        if (event.payload.conversation_id === conversationId) callback();
      },
    );
  }

  private permissions(conversationId: string, userId: string): string[] {
    return [
      Permission.read(Role.team(conversationId)),
      Permission.update(Role.user(userId)),
      Permission.delete(Role.user(userId)),
    ];
  }

  private async ownReaction(messageId: string, userId: string) {
    const [row] = await this.appwrite.listAll<ReactionRow>('message_reactions', [
      Query.equal('message_id', messageId),
      Query.equal('user_id', userId),
    ]);
    return row ?? null;
  }

  private toMessage(row: MessageRow): Message {
    const { media_file_id: _file, ...message } = fromRow<MessageRow & { id: string }>(row);
    return { ...message, media_url: null } as unknown as Message;
  }

  /** Ajoute l'auteur, le message cité, les réactions et l'adresse des photos et vidéos. */
  private async enrich(
    rows: MessageRow[],
    reactions: ReactionRow[],
    extraReplies: MessageRow[] = [],
  ): Promise<Message[]> {
    const byId = new Map([...rows, ...extraReplies].map((r) => [r.$id, r]));
    const profiles = await this.appwrite.miniProfiles([...byId.values()].map((r) => r.sender_id));
    return Promise.all(
      rows.map(async (row) => {
        const sender = profiles.get(row.sender_id);
        const replied = row.reply_to_id ? byId.get(row.reply_to_id) : undefined;
        return {
          ...this.toMessage(row),
          media_url: row.media_file_id ? await this.mediaUrl(row.media_file_id) : null,
          sender: sender ? { username: sender.username, avatar_url: sender.avatar_url } : undefined,
          reply_to: replied
            ? {
                id: replied.$id,
                content: replied.content,
                type: replied.type,
                sender: { username: profiles.get(replied.sender_id)?.username ?? '' },
              }
            : null,
          reactions: reactions
            .filter((r) => r.message_id === row.$id)
            .map((r) => ({ message_id: r.message_id, user_id: r.user_id, emoji: r.emoji })),
        };
      }),
    );
  }

  private mediaUrl(fileId: string): Promise<string | null> {
    if (!this.mediaUrls.has(fileId)) {
      this.mediaUrls.set(fileId, this.appwrite.privateFileUrl('chat-media', fileId));
    }
    return this.mediaUrls.get(fileId)!;
  }
}
