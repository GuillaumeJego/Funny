import { RepositoryResult, Unsubscribe } from './repository.types';

export interface AppNotification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  read: boolean;
  created_at: string;
  actor_id?: string;
  /** Page à ouvrir quand on clique sur la notification (ex. /sorties/<id>/affinites). */
  link?: string | null;
  actor?: { username: string; avatar_url: string | null };
  /** Image de la sortie concernée, s'il y en a une. */
  sortie_image?: string | null;
}

/** Les notifications sont créées par le serveur (Appwrite Functions) ; ici, on les lit. */
export abstract class NotificationRepository {
  abstract getForUser(userId: string): Promise<RepositoryResult<AppNotification[]>>;
  abstract countUnread(userId: string): Promise<number>;
  abstract markAllRead(userId: string): Promise<RepositoryResult<null>>;
  /** Prévient dès qu'une nouvelle notification arrive pour ce membre (en direct). */
  abstract onNew(userId: string, callback: (n: AppNotification) => void): Unsubscribe;
}
