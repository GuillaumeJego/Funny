import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { Message, Conversation } from '../models/message.model';

@Injectable({ providedIn: 'root' })
export class ConversationService {
  constructor(private supabase: SupabaseService) {}

  async getOrCreateConversation(userId1: string, userId2: string): Promise<string> {
    const { data: p1 } = await this.supabase.client
      .from('conversation_participants')
      .select('conversation_id')
      .eq('user_id', userId1);

    if (p1?.length) {
      const ids = p1.map((p: any) => p.conversation_id);
      const { data: shared } = await this.supabase.client
        .from('conversation_participants')
        .select('conversation_id')
        .eq('user_id', userId2)
        .in('conversation_id', ids);

      if (shared?.length) return shared[0].conversation_id;
    }

    const { data: conv } = await this.supabase.client
      .from('conversations')
      .insert({})
      .select()
      .single();

    if (!conv) throw new Error('Failed to create conversation');

    await this.supabase.client
      .from('conversation_participants')
      .insert([
        { conversation_id: conv.id, user_id: userId1 },
        { conversation_id: conv.id, user_id: userId2 },
      ]);

    return conv.id;
  }

  async getConversations(userId: string): Promise<Conversation[]> {
    const { data: participations } = await this.supabase.client
      .from('conversation_participants')
      .select('conversation_id')
      .eq('user_id', userId);

    if (!participations?.length) return [];

    const convIds = participations.map((p: any) => p.conversation_id);

    const { data } = await this.supabase.client
      .from('conversations')
      .select(`id, created_at, participants:conversation_participants(user_id, user:profiles!user_id(id, username, avatar_url))`)
      .in('id', convIds);

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
      })
    );

    conversations.sort((a, b) => {
      const ta = a.last_message?.created_at ?? a.created_at;
      const tb = b.last_message?.created_at ?? b.created_at;
      return new Date(tb).getTime() - new Date(ta).getTime();
    });

    return conversations;
  }

  async getMessages(conversationId: string): Promise<Message[]> {
    const { data } = await this.supabase.client
      .from('messages')
      .select(`*, sender:profiles!sender_id(username, avatar_url), reply_to:messages!reply_to_id(id, content, type, sender:profiles!sender_id(username)), reactions:message_reactions(message_id, user_id, emoji)`)
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });
    return (data ?? []) as Message[];
  }

  async sendMessage(
    conversationId: string,
    senderId: string,
    content: string,
    type: 'text' | 'image' | 'video' = 'text',
    replyToId?: string,
    mediaUrl?: string
  ): Promise<Message | null> {
    const { data } = await this.supabase.client
      .from('messages')
      .insert({
        conversation_id: conversationId,
        sender_id: senderId,
        content: content || null,
        type,
        reply_to_id: replyToId || null,
        media_url: mediaUrl || null,
      })
      .select(`*, sender:profiles!sender_id(username, avatar_url), reply_to:messages!reply_to_id(id, content, type, sender:profiles!sender_id(username)), reactions:message_reactions(message_id, user_id, emoji)`)
      .single();
    return data;
  }

  async toggleReaction(messageId: string, userId: string, emoji: string, currentEmoji?: string) {
    if (currentEmoji === emoji) {
      await this.supabase.client
        .from('message_reactions')
        .delete()
        .eq('message_id', messageId)
        .eq('user_id', userId);
    } else {
      await this.supabase.client
        .from('message_reactions')
        .upsert({ message_id: messageId, user_id: userId, emoji });
    }
  }

  async uploadMedia(file: File, userId: string): Promise<string | null> {
    const ext = file.name.split('.').pop();
    const path = `${userId}/${Date.now()}.${ext}`;
    const { error } = await this.supabase.client.storage
      .from('chat-media')
      .upload(path, file);
    if (error) return null;
    const { data } = this.supabase.client.storage
      .from('chat-media')
      .getPublicUrl(path);
    return data.publicUrl;
  }

  subscribeToMessages(conversationId: string, callback: (payload: any) => void) {
    return this.supabase.client
      .channel(`conv-${conversationId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conversationId}`,
      }, callback)
      .subscribe();
  }

  unsubscribe(channel: any) {
    this.supabase.client.removeChannel(channel);
  }
}
