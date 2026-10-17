import { Injectable } from '@angular/core';
import { FriendshipRepository } from '../repositories/friendship.repository';
import { Friendship } from '../models/friendship.model';

@Injectable({ providedIn: 'root' })
export class FriendshipService {
  constructor(private friendships: FriendshipRepository) {}

  async getPendingReceivedCount(userId: string): Promise<number> {
    return await this.friendships.countPendingReceived(userId);
  }

  async getFriendshipStatus(userId: string, otherId: string): Promise<Friendship | null> {
    return await this.friendships.getBetween(userId, otherId);
  }

  async getFriends(userId: string): Promise<Friendship[]> {
    return await this.friendships.getAccepted(userId);
  }

  async getPendingSent(userId: string): Promise<Friendship[]> {
    return await this.friendships.getPendingSent(userId);
  }

  async getPendingReceived(userId: string): Promise<Friendship[]> {
    return await this.friendships.getPendingReceived(userId);
  }

  async sendRequest(requesterId: string, receiverId: string) {
    return await this.friendships.create(requesterId, receiverId);
  }

  async acceptRequest(friendshipId: string) {
    return await this.friendships.setStatus(friendshipId, 'accepted');
  }

  async declineRequest(friendshipId: string) {
    return await this.friendships.setStatus(friendshipId, 'declined');
  }

  async removeFriend(friendshipId: string) {
    return await this.friendships.delete(friendshipId);
  }

  getFriendProfile(friendship: Friendship, myId: string) {
    if (friendship.requester_id === myId) return friendship.receiver;
    return friendship.requester;
  }
}
