import { Injectable } from '@angular/core';
import { Models, Query } from 'appwrite';
import {
  AppNotification,
  NotificationRepository,
} from '../../repositories/notification.repository';
import { RepositoryResult } from '../../repositories/repository.types';
import { AppwriteClientService, DB, attempt } from './appwrite-client';
import { fromRow } from './rows';

/** Les notifications sont écrites par le serveur ; le membre ne fait que les lire. */
@Injectable()
export class AppwriteNotificationRepository extends NotificationRepository {
  constructor(private appwrite: AppwriteClientService) {
    super();
  }

  getForUser(userId: string): Promise<RepositoryResult<AppNotification[]>> {
    return attempt(async () => {
      const rows = await this.appwrite.listAll('notifications', [
        Query.equal('user_id', userId),
        Query.orderDesc('$createdAt'),
      ]);
      const notifications = rows.map((r) => fromRow<AppNotification>(r));
      const actorById = await this.appwrite.miniProfiles(
        notifications.map((n) => n.actor_id ?? ''),
      );
      return notifications.map((n) => {
        const actor = actorById.get(n.actor_id ?? '');
        return actor
          ? {
              ...n,
              actor: { username: actor.username, avatar_url: actor.avatar_url },
            }
          : n;
      });
    });
  }

  countUnread(userId: string): Promise<number> {
    return this.appwrite.count('notifications', [
      Query.equal('user_id', userId),
      Query.equal('read', false),
    ]);
  }

  markAllRead(userId: string): Promise<RepositoryResult<null>> {
    return attempt(async () => {
      const unread = await this.appwrite.listAll<Models.Row>('notifications', [
        Query.equal('user_id', userId),
        Query.equal('read', false),
      ]);
      for (const row of unread) {
        await this.appwrite.tables.updateRow({
          databaseId: DB,
          tableId: 'notifications',
          rowId: row.$id,
          data: { read: true },
        });
      }
      return null;
    });
  }
}
