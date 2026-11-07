import { Injectable, inject } from '@angular/core';
import { Channel, Models, Query } from 'appwrite';
import {
  AppNotification,
  NotificationRepository,
} from '../../repositories/notification.repository';
import { RepositoryResult, Unsubscribe } from '../../repositories/repository.types';
import { AppwriteClientService, DB, attempt } from './appwrite-client';
import { fromRow } from './rows';

/** Sortie visée par le lien d'une notification (/sorties/<id>… ou ?sortie=<id>). */
export function sortieIdOf(link: string | null | undefined): string | null {
  if (!link) return null;
  return (
    link.match(/^\/sorties\/([A-Za-z0-9_-]{1,36})/)?.[1] ??
    link.match(/[?&]sortie=([A-Za-z0-9_-]{1,36})/)?.[1] ??
    null
  );
}

/** Les notifications sont écrites par le serveur ; le membre ne fait que les lire. */
@Injectable()
export class AppwriteNotificationRepository extends NotificationRepository {
  private appwrite = inject(AppwriteClientService);

  getForUser(userId: string): Promise<RepositoryResult<AppNotification[]>> {
    return attempt(async () => {
      const rows = await this.appwrite.listAll('notifications', [
        Query.equal('user_id', userId),
        Query.orderDesc('$createdAt'),
      ]);
      return this.withActors(rows.map((r) => fromRow<AppNotification>(r)));
    });
  }

  onNew(userId: string, callback: (n: AppNotification) => void): Unsubscribe {
    // Appwrite n'envoie que les lignes que le membre a le droit de lire : les siennes.
    return this.appwrite.client.subscribe<Models.Row & { user_id: string }>(
      Channel.tablesdb(DB).table('notifications').row().create(),
      async (event) => {
        if (event.payload.user_id !== userId) return;
        const [notification] = await this.withActors([fromRow<AppNotification>(event.payload)]);
        callback(notification);
      },
    );
  }

  /**
   * Ajoute le pseudo et la photo du membre à l'origine de chaque notification, et l'image
   * de la sortie quand la notification en concerne une.
   */
  private async withActors(notifications: AppNotification[]): Promise<AppNotification[]> {
    const [actorById, sorties] = await Promise.all([
      this.appwrite.miniProfiles(notifications.map((n) => n.actor_id ?? '')),
      this.appwrite
        .sortieInfos(notifications.map((n) => sortieIdOf(n.link)).filter((id) => !!id) as string[])
        .catch(() => new Map<string, { title: string; image: string | null }>()),
    ]);
    return notifications.map((n) => {
      const actor = actorById.get(n.actor_id ?? '');
      const sortieImage = sorties.get(sortieIdOf(n.link) ?? '')?.image ?? null;
      return {
        ...n,
        ...(actor ? { actor: { username: actor.username, avatar_url: actor.avatar_url } } : {}),
        ...(sortieImage ? { sortie_image: sortieImage } : {}),
      };
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
