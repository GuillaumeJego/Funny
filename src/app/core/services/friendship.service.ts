import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { Friendship } from '../models/friendship.model';

@Injectable({ providedIn: 'root' })
export class FriendshipService {
  constructor(private supabase: SupabaseService) {}

  async getFriendshipStatus(userId: string, otherId: string): Promise<Friendship | null> {
    const { data } = await this.supabase.client
      .from('friendships')
      .select('*')
      .or(`and(requester_id.eq.${userId},receiver_id.eq.${otherId}),and(requester_id.eq.${otherId},receiver_id.eq.${userId})`)
      .maybeSingle();
    return data;
  }

  async getFriends(userId: string): Promise<Friendship[]> {
    const { data } = await this.supabase.client
      .from('friendships')
      .select('*, requester:profiles!requester_id(id, username, avatar_url), receiver:profiles!receiver_id(id, username, avatar_url)')
      .or(`requester_id.eq.${userId},receiver_id.eq.${userId}`)
      .eq('status', 'accepted');
    return (data ?? []) as Friendship[];
  }

  async getPendingReceived(userId: string): Promise<Friendship[]> {
    const { data } = await this.supabase.client
      .from('friendships')
      .select('*, requester:profiles!requester_id(id, username, avatar_url)')
      .eq('receiver_id', userId)
      .eq('status', 'pending');
    return (data ?? []) as Friendship[];
  }

  async sendRequest(requesterId: string, receiverId: string) {
    return await this.supabase.client
      .from('friendships')
      .insert({ requester_id: requesterId, receiver_id: receiverId });
  }

  async acceptRequest(friendshipId: string) {
    return await this.supabase.client
      .from('friendships')
      .update({ status: 'accepted' })
      .eq('id', friendshipId);
  }

  async declineRequest(friendshipId: string) {
    return await this.supabase.client
      .from('friendships')
      .update({ status: 'declined' })
      .eq('id', friendshipId);
  }

  async removeFriend(friendshipId: string) {
    return await this.supabase.client
      .from('friendships')
      .delete()
      .eq('id', friendshipId);
  }

  getFriendProfile(friendship: Friendship, myId: string) {
    if (friendship.requester_id === myId) return friendship.receiver;
    return friendship.requester;
  }
}
