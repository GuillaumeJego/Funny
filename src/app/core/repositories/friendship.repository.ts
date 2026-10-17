import { Friendship } from '../models/friendship.model';
import { RepositoryResult } from './repository.types';

export abstract class FriendshipRepository {
  abstract countPendingReceived(userId: string): Promise<number>;
  abstract getBetween(userId: string, otherId: string): Promise<Friendship | null>;
  abstract getAccepted(userId: string): Promise<Friendship[]>;
  abstract getPendingSent(userId: string): Promise<Friendship[]>;
  abstract getPendingReceived(userId: string): Promise<Friendship[]>;
  abstract create(requesterId: string, receiverId: string): Promise<RepositoryResult<null>>;
  abstract setStatus(
    friendshipId: string,
    status: 'accepted' | 'declined',
  ): Promise<RepositoryResult<null>>;
  abstract delete(friendshipId: string): Promise<RepositoryResult<null>>;
}
