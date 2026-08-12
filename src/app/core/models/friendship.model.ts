export interface Friendship {
  id: string;
  requester_id: string;
  receiver_id: string;
  status: 'pending' | 'accepted' | 'declined';
  created_at: string;
  requester?: { id: string; username: string; avatar_url: string | null };
  receiver?: { id: string; username: string; avatar_url: string | null };
}
