import { Injectable } from '@angular/core';
import { Conversation, Message } from '../../models/message.model';
import { ConversationRepository, NewMessage } from '../../repositories/conversation.repository';
import { Unsubscribe } from '../../repositories/repository.types';
import { SupabaseClientService } from './supabase-client';

const MESSAGE_FIELDS = `*, sender:profiles!sender_id(username, avatar_url), reply_to:messages!reply_to_id(id, content, type, sender:profiles!sender_id(username)), reactions:message_reactions(message_id, user_id, emoji)`;

@Injectable()
export class SupabaseConversationRepository extends ConversationRepository {
  constructor(private supabase: SupabaseClientService) {
    super();
  }

  async getConversationIds(userId: string): Promise<string[]> {
    const { data } = await this.supabase.client
      .from('conversation_participants')
      .select('conversation_id')
      .eq('user_id', userId);
    return (data ?? []).map((p: any) => p.conversation_id);
  }

  async findShared(userId: string, conversationIds: string[]): Promise<string[]> {
    if (conversationIds.length === 0) return [];
    const { data } = await this.supabase.client
      .from('conversation_participants')
      .select('conversation_id')
      .eq('user_id', userId)
      .in('conversation_id', conversationIds);
    return (data ?? []).map((p: any) => p.conversation_id);
  }

  async create(participantIds: string[]): Promise<string> {
    const convId = crypto.randomUUID();

    const { error } = await this.supabase.client.from('conversations').insert({ id: convId });

    if (error) throw new Error('Failed to create conversation: ' + error.message);

    await this.supabase.client
      .from('conversation_participants')
      .insert(participantIds.map((user_id) => ({ conversation_id: convId, user_id })));

    return convId;
  }

  async getWithLastMessage(conversationIds: string[]): Promise<Conversation[]> {
    if (conversationIds.length === 0) return [];
    const { data } = await this.supabase.client
      .from('conversations')
      .select(
        `id, created_at, participants:conversation_participants(user_id, user:profiles!user_id(id, username, avatar_url))`,
      )
      .in('id', conversationIds);

    const conversations = (data ?? []) as unknown as Conversation[];

    await Promise.all(
      conversations.map(async (c) => {
        const { data: msgs } = await this.supabase.client
          .from('messages')
          .select('id, content, type, created_at, sender_id')
          .eq('conversation_id', c.id)
          .order('created_at', { ascending: false })
          .limit(1);
        c.last_message = (msgs?.[0] ?? null) as any;
      }),
    );

    return conversations;
  }

  async getMessages(conversationId: string): Promise<Message[]> {
    const { data } = await this.supabase.client
      .from('messages')
      .select(MESSAGE_FIELDS)
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });
    return (data ?? []) as Message[];
  }

  async sendMessage(message: NewMessage): Promise<Message | null> {
    const { data } = await this.supabase.client
      .from('messages')
      .insert(message)
      .select(MESSAGE_FIELDS)
      .single();
    return data;
  }

  async setReaction(messageId: string, userId: string, emoji: string): Promise<void> {
    await this.supabase.client
      .from('message_reactions')
      .upsert({ message_id: messageId, user_id: userId, emoji });
  }

  async removeReaction(messageId: string, userId: string): Promise<void> {
    await this.supabase.client
      .from('message_reactions')
      .delete()
      .eq('message_id', messageId)
      .eq('user_id', userId);
  }

  onNewMessage(conversationId: string, callback: () => void): Unsubscribe {
    const channel = this.supabase.client
      .channel(`conv-${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        () => callback(),
      )
      .subscribe();
    return () => {
      this.supabase.client.removeChannel(channel);
    };
  }
}
