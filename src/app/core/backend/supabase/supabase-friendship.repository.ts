import { Injectable } from '@angular/core';
import { Friendship } from '../../models/friendship.model';
import { FriendshipRepository } from '../../repositories/friendship.repository';
import { RepositoryResult } from '../../repositories/repository.types';
import { SupabaseClientService, toResult } from './supabase-client';

@Injectable()
export class SupabaseFriendshipRepository extends FriendshipRepository {
  constructor(private supabase: SupabaseClientService) {
    super();
  }

  async countPendingReceived(userId: string): Promise<number> {
    const { count } = await this.supabase.client
      .from('friendships')
      .select('*', { count: 'exact', head: true })
      .eq('receiver_id', userId)
      .eq('status', 'pending');
    return count ?? 0;
  }

  async getBetween(userId: string, otherId: string): Promise<Friendship | null> {
    const { data } = await this.supabase.client
      .from('friendships')
      .select('*')
      .or(
        `and(requester_id.eq.${userId},receiver_id.eq.${otherId}),and(requester_id.eq.${otherId},receiver_id.eq.${userId})`,
      )
      .maybeSingle();
    return data;
  }

  async getAccepted(userId: string): Promise<Friendship[]> {
    const { data } = await this.supabase.client
      .from('friendships')
      .select(
        '*, requester:profiles!requester_id(id, username, avatar_url), receiver:profiles!receiver_id(id, username, avatar_url)',
      )
      .or(`requester_id.eq.${userId},receiver_id.eq.${userId}`)
      .eq('status', 'accepted');
    return (data ?? []) as Friendship[];
  }

  async getPendingSent(userId: string): Promise<Friendship[]> {
    const { data } = await this.supabase.client
      .from('friendships')
      .select('*, receiver:profiles!receiver_id(id, username, avatar_url)')
      .eq('requester_id', userId)
      .eq('status', 'pending');
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

  async create(requesterId: string, receiverId: string): Promise<RepositoryResult<null>> {
    return toResult(
      await this.supabase.client
        .from('friendships')
        .insert({ requester_id: requesterId, receiver_id: receiverId }),
    );
  }

  async setStatus(
    friendshipId: string,
    status: 'accepted' | 'declined',
  ): Promise<RepositoryResult<null>> {
    return toResult(
      await this.supabase.client.from('friendships').update({ status }).eq('id', friendshipId),
    );
  }

  async delete(friendshipId: string): Promise<RepositoryResult<null>> {
    return toResult(await this.supabase.client.from('friendships').delete().eq('id', friendshipId));
  }
}
