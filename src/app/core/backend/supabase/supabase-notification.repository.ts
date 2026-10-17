import { Injectable } from '@angular/core';
import {
  AppNotification,
  NewNotification,
  NotificationRepository,
} from '../../repositories/notification.repository';
import { RepositoryResult } from '../../repositories/repository.types';
import { SupabaseClientService, toResult } from './supabase-client';

@Injectable()
export class SupabaseNotificationRepository extends NotificationRepository {
  constructor(private supabase: SupabaseClientService) {
    super();
  }

  async getForUser(userId: string): Promise<RepositoryResult<AppNotification[]>> {
    return toResult(
      await this.supabase.client
        .from('notifications')
        .select('*, actor:profiles!actor_id(username, avatar_url)')
        .eq('user_id', userId)
        .order('created_at', { ascending: false }),
    );
  }

  async countUnread(userId: string): Promise<number> {
    const { count } = await this.supabase.client
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('read', false);
    return count ?? 0;
  }

  async markAllRead(userId: string): Promise<RepositoryResult<null>> {
    return toResult(
      await this.supabase.client
        .from('notifications')
        .update({ read: true })
        .eq('user_id', userId)
        .eq('read', false),
    );
  }

  async createMany(notifications: NewNotification[]): Promise<RepositoryResult<null>> {
    if (notifications.length === 0) return { data: null, error: null };
    return toResult(await this.supabase.client.from('notifications').insert(notifications));
  }
}
