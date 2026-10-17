import { Injectable } from '@angular/core';
import { AuthRepository } from '../repositories/auth.repository';

@Injectable({ providedIn: 'root' })
export class AuthService {
  constructor(private auth: AuthRepository) {}

  // Inscription
  async register(email: string, password: string) {
    return await this.auth.register(email, password);
  }

  // Connexion
  async login(email: string, password: string) {
    return await this.auth.login(email, password);
  }

  // Déconnexion
  async logout() {
    return await this.auth.logout();
  }

  // Récupérer l'utilisateur connecté
  async getUser() {
    return await this.auth.getUser();
  }

  // Une session est-elle ouverte ?
  async hasSession() {
    return await this.auth.hasSession();
  }
}
