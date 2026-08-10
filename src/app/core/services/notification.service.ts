import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase.service';

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  read: boolean;
  created_at: string;
  actor_id?: string;
  actor?: { username: string; avatar_url: string | null };
}

@Injectable({ providedIn: 'root' })
export class NotificationService {
  constructor(private supabase: SupabaseService) {}

  async getMyNotifications(userId: string) {
    return await this.supabase.client
      .from('notifications')
      .select('*, actor:profiles!actor_id(username, avatar_url)')
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

  async notifyOrganizer(
    organizerId: string,
    actorId: string,
    sortieTitle: string,
    type: 'joined' | 'waiting' | 'left' | 'liked'
  ) {
    if (organizerId === actorId) return; // pas de notif à soi-même
    const { data: actorProfile } = await this.supabase.client
      .from('profiles')
      .select('username')
      .eq('id', actorId)
      .single();
    const actor = actorProfile?.username ?? 'Un membre';
    const msgs: Record<typeof type, { title: string; message: string }> = {
      joined:  { title: '✅ Nouvelle inscription',  message: `${actor} a rejoint votre sortie « ${sortieTitle} »` },
      waiting: { title: '⏳ Liste d\'attente',       message: `${actor} est en liste d'attente pour « ${sortieTitle} »` },
      left:    { title: '🚪 Désinscription',         message: `${actor} a quitté votre sortie « ${sortieTitle} »` },
      liked:   { title: '❤️ Nouveau like',           message: `${actor} a aimé votre sortie « ${sortieTitle} »` },
    };
    const { title, message } = msgs[type];
    await this.supabase.client.from('notifications').insert({ user_id: organizerId, title, message, actor_id: actorId });
  }
}
