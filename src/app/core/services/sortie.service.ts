import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { Sortie } from '../models/sortie.model';
import { NotificationService } from './notification.service';

@Injectable({ providedIn: 'root' })
export class SortieService {

  constructor(private supabase: SupabaseService, private notifService: NotificationService) {}

  // Récupérer toutes les sorties publiées
  async getAllSorties() {
    return await this.supabase.client
      .from('sorties')
      .select(`
        *,
        themes (name, icon),
        profiles (username, avatar_url)
      `)
      .eq('status', 'published')
      .order('date');
  }

  // Récupérer le nombre d'inscrits pour une sortie (hors organisateur)
  async getInscriptionsCount(sortieId: string): Promise<number> {
    const { count } = await this.supabase.client
      .from('inscriptions')
      .select('*', { count: 'exact', head: true })
      .eq('sortie_id', sortieId)
      .eq('status', 'pending');
    return count ?? 0;
  }

  // Récupérer la première image d'un thème (fallback image)
  async getFirstThemeImage(themeId: string): Promise<string | null> {
    const { data } = await this.supabase.client
      .from('theme_images')
      .select('image_url')
      .eq('theme_id', themeId)
      .order('position')
      .limit(1)
      .single();
    return data?.image_url ?? null;
  }

  // Récupérer une sortie par ID
  async getSortieById(id: string) {
    return await this.supabase.client
      .from('sorties')
      .select(`
        *,
        themes (name, icon),
        profiles (username, avatar_url)
      `)
      .eq('id', id)
      .single();
  }

  // Créer une sortie
  async createSortie(sortie: Partial<Sortie>) {
    return await this.supabase.client
      .from('sorties')
      .insert(sortie)
      .select()
      .single();
  }

  // Modifier une sortie
  async updateSortie(id: string, updates: Partial<Sortie>) {
    return await this.supabase.client
      .from('sorties')
      .update(updates)
      .eq('id', id);
  }

  // Supprimer une sortie (simple, sans notifications)
  async deleteSortie(id: string) {
    return await this.supabase.client
      .from('sorties')
      .delete()
      .eq('id', id);
  }

  // Supprimer une sortie + envoyer des notifications aux inscrits et aux likeurs
  async deleteSortieWithNotifications(sortieId: string, sortieTitle: string, organizerUsername: string) {
    // 1. Récupérer inscrits et likeurs avant suppression
    const [inscrits, likes] = await Promise.all([
      this.getMembresInscrits(sortieId),
      this.getMembresLikes(sortieId)
    ]);

    const inscritsProfiles = inscrits;
    const likesProfiles = likes;

    // 2. Construire les notifications (éviter les doublons)
    const notifications: { user_id: string; title: string; message: string }[] = [];
    const seen = new Set<string>();

    for (const p of inscritsProfiles) {
      if (!p?.id || seen.has(p.id)) continue;
      seen.add(p.id);
      notifications.push({
        user_id: p.id,
        title: 'Sortie annulée',
        message: `Vous étiez inscrit à la sortie "${sortieTitle}". L'organisateur ${organizerUsername} a annulé la sortie. Si vous avez payé pour y participer, vous serez remboursé.`
      });
    }

    for (const p of likesProfiles) {
      if (!p?.id || seen.has(p.id)) continue;
      seen.add(p.id);
      notifications.push({
        user_id: p.id,
        title: 'Sortie annulée',
        message: `Vous aviez liké la sortie "${sortieTitle}". L'organisateur ${organizerUsername} a annulé la sortie. Si vous avez payé pour y participer, vous serez remboursé.`
      });
    }

    // 3. Envoyer les notifications puis supprimer
    await this.notifService.createMany(notifications);
    return await this.deleteSortie(sortieId);
  }

  // Sorties créées par un utilisateur
  async getSortiesCreatedBy(userId: string) {
    return await this.supabase.client
      .from('sorties')
      .select(`*, themes (name, icon), profiles (username, avatar_url)`)
      .eq('created_by', userId)
      .eq('status', 'published')
      .order('date');
  }

  // Sorties auxquelles un utilisateur est inscrit (exclut cancelled et confirmed=organisateur)
  async getSortiesRejointes(userId: string) {
    return await this.supabase.client
      .from('inscriptions')
      .select(`sortie_id, sorties (*, themes (name, icon), profiles (username, avatar_url))`)
      .eq('user_id', userId)
      .neq('status', 'cancelled')
      .neq('status', 'confirmed');
  }

  // Membres inscrits à une sortie (pending = membres, confirmed = organisateur)
  async getMembresInscrits(sortieId: string): Promise<{ id: string; username: string; avatar_url: string | null; isOrganizer: boolean }[]> {
    const { data: rows } = await this.supabase.client
      .from('inscriptions')
      .select('user_id, status')
      .eq('sortie_id', sortieId)
      .in('status', ['pending', 'confirmed']);
    if (!rows || rows.length === 0) return [];

    const userIds = rows.map((r: any) => r.user_id);
    const { data: profiles } = await this.supabase.client
      .from('profiles')
      .select('id, username, avatar_url')
      .in('id', userIds);

    return (profiles ?? []).map((p: any) => ({
      ...p,
      isOrganizer: rows.find((r: any) => r.user_id === p.id)?.status === 'confirmed'
    }));
  }

  // Membres en liste d'attente pour une sortie
  async getMembresWaiting(sortieId: string): Promise<{ id: string; username: string; avatar_url: string | null }[]> {
    const { data: rows } = await this.supabase.client
      .from('inscriptions')
      .select('user_id')
      .eq('sortie_id', sortieId)
      .eq('status', 'waiting')
      .order('created_at', { ascending: true });
    if (!rows || rows.length === 0) return [];

    const userIds = rows.map((r: any) => r.user_id);
    const { data: profiles } = await this.supabase.client
      .from('profiles')
      .select('id, username, avatar_url')
      .in('id', userIds);

    // Respecter l'ordre d'inscription
    return userIds
      .map((uid: string) => (profiles ?? []).find((p: any) => p.id === uid))
      .filter(Boolean) as any[];
  }

  // Quitter une sortie — promotion et notification gérées par le trigger DB
  async quitterSortie(sortieId: string, userId: string): Promise<{ error: any }> {
    const { error } = await this.supabase.client
      .rpc('quitter_sortie', { p_user_id: userId, p_sortie_id: sortieId });
    return { error };
  }

  // Membres qui ont liké une sortie
  async getMembresLikes(sortieId: string): Promise<{ id: string; username: string; avatar_url: string | null }[]> {
    const { data: rows } = await this.supabase.client
      .from('favoris')
      .select('user_id')
      .eq('sortie_id', sortieId);
    if (!rows || rows.length === 0) return [];

    const userIds = rows.map((r: any) => r.user_id);
    const { data: profiles } = await this.supabase.client
      .from('profiles')
      .select('id, username, avatar_url')
      .in('id', userIds);

    return (profiles ?? []) as any[];
  }

  // S'inscrire à une sortie
  async inscrire(sortieId: string, userId: string) {
    return await this.supabase.client
      .from('inscriptions')
      .insert({ sortie_id: sortieId, user_id: userId });
  }

  // Se désinscrire d'une sortie
  async desinscrire(sortieId: string, userId: string) {
    return await this.supabase.client
      .from('inscriptions')
      .update({ status: 'cancelled' })
      .eq('sortie_id', sortieId)
      .eq('user_id', userId);
  }

  // Vérifier si un utilisateur est inscrit
  async isInscrit(sortieId: string, userId: string) {
    return await this.supabase.client
      .from('inscriptions')
      .select('*')
      .eq('sortie_id', sortieId)
      .eq('user_id', userId)
      .eq('status', 'pending')
      .single();
  }
}