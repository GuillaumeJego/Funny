import { Injectable } from '@angular/core';
import { Models, Query } from 'appwrite';
import { Friendship } from '../../models/friendship.model';
import { FriendshipRepository } from '../../repositories/friendship.repository';
import { RepositoryResult } from '../../repositories/repository.types';
import { AppwriteClientService } from './appwrite-client';
import { fromRow } from './rows';

@Injectable()
export class AppwriteFriendshipRepository extends FriendshipRepository {
  constructor(private appwrite: AppwriteClientService) {
    super();
  }

  countPendingReceived(userId: string): Promise<number> {
    return this.appwrite.count('friendships', [
      Query.equal('receiver_id', userId),
      Query.equal('status', 'pending'),
    ]);
  }

  async getBetween(userId: string, otherId: string): Promise<Friendship | null> {
    const [row] = await this.appwrite.listAll('friendships', [
      Query.or([
        Query.and([Query.equal('requester_id', userId), Query.equal('receiver_id', otherId)]),
        Query.and([Query.equal('requester_id', otherId), Query.equal('receiver_id', userId)]),
      ]),
    ]);
    return row ? fromRow<Friendship>(row) : null;
  }

  getAccepted(userId: string): Promise<Friendship[]> {
    return this.list([
      Query.or([Query.equal('requester_id', userId), Query.equal('receiver_id', userId)]),
      Query.equal('status', 'accepted'),
    ]);
  }

  getPendingSent(userId: string): Promise<Friendship[]> {
    return this.list([Query.equal('requester_id', userId), Query.equal('status', 'pending')]);
  }

  getPendingReceived(userId: string): Promise<Friendship[]> {
    return this.list([Query.equal('receiver_id', userId), Query.equal('status', 'pending')]);
  }

  /** Passe par le serveur, qui vérifie les blocages et prévient l'autre membre. */
  create(_requesterId: string, receiverId: string): Promise<RepositoryResult<null>> {
    return this.call('friendRequest', { userId: receiverId });
  }

  setStatus(
    friendshipId: string,
    status: 'accepted' | 'declined',
  ): Promise<RepositoryResult<null>> {
    return this.call('friendRespond', { friendshipId, accept: status === 'accepted' });
  }

  delete(friendshipId: string): Promise<RepositoryResult<null>> {
    return this.call('friendRemove', { friendshipId });
  }

  private async call(action: string, input: Record<string, unknown>) {
    const { error } = await this.appwrite.run('social', action, input);
    return { data: null, error };
  }

  /** Amitiés avec le profil réduit des deux membres. */
  private async list(queries: string[]): Promise<Friendship[]> {
    const friendships = (await this.appwrite.listAll('friendships', queries)).map((r) =>
      fromRow<Friendship>(r),
    );
    const mini = await this.appwrite.miniProfiles(
      friendships.flatMap((f) => [f.requester_id, f.receiver_id]),
    );
    return friendships.map((f) => ({
      ...f,
      requester: mini.get(f.requester_id),
      receiver: mini.get(f.receiver_id),
    }));
  }
}
