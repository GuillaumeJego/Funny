import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase.service';

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  read: boolean;
  created_at: string;
}

@Injectable({ providedIn: 'root' })
export class NotificationService {
  constructor(private supabase: SupabaseService) {}

  async getMyNotifications(userId: string) {
    return await this.supabase.client
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
  }

  async countUnread(userId: string): Promise<number> {
    const { count } = await this.supabase.client
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('read', false);
    return count ?? 0;
  }

  async markAllRead(userId: string) {
    return await this.supabase.client
      .from('notifications')
      .update({ read: true })
      .eq('user_id', userId)
      .eq('read', false);
  }

  async markRead(id: string) {
    return await this.supabase.client
      .from('notifications')
      .update({ read: true })
      .eq('id', id);
  }

  async createMany(notifications: { user_id: string; title: string; message: string }[]) {
    if (notifications.length === 0) return;
    return await this.supabase.client
      .from('notifications')
      .insert(notifications);
  }
}
