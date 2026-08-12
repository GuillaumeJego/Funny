export interface MessageReaction {
  message_id: string;
  user_id: string;
  emoji: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string | null;
  type: 'text' | 'image' | 'video';
  media_url: string | null;
  reply_to_id: string | null;
  created_at: string;
  sender?: { username: string; avatar_url: string | null };
  reply_to?: { id: string; content: string | null; type: string; sender?: { username: string } } | null;
  reactions?: MessageReaction[];
}

export interface ConversationParticipant {
  user_id: string;
  user?: { id: string; username: string; avatar_url: string | null };
}

export interface Conversation {
  id: string;
  created_at: string;
  participants?: ConversationParticipant[];
  last_message?: Message | null;
}
