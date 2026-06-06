import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase.service';

@Injectable({ providedIn: 'root' })
export class AuthService {

  constructor(private supabase: SupabaseService) {}

  // Inscription
  async register(email: string, password: string) {
    return await this.supabase.client.auth.signUp({ email, password });
  }

  // Connexion
  async login(email: string, password: string) {
    return await this.supabase.client.auth.signInWithPassword({ email, password });
  }

  // Déconnexion
  async logout() {
    return await this.supabase.client.auth.signOut();
  }

  // Récupérer l'utilisateur connecté
  async getUser() {
    return await this.supabase.client.auth.getUser();
  }

  // Écouter les changements de session
  onAuthChange(callback: (session: any) => void) {
    return this.supabase.client.auth.onAuthStateChange((_event, session) => {
      callback(session);
    });
  }
}