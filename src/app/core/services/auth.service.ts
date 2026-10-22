import { Injectable } from '@angular/core';
import { AuthRepository } from '../repositories/auth.repository';

@Injectable({ providedIn: 'root' })
export class AuthService {
  constructor(private auth: AuthRepository) {}

  // Inscription
  async register(
    email: string,
    password: string,
    username: string,
    consent: { adult: boolean; terms: boolean },
  ) {
    return await this.auth.register(email, password, username, consent);
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

  // Suppression définitive du compte (droit RGPD)
  async deleteAccount(password: string) {
    return await this.auth.deleteAccount(password);
  }

  // E-mail de confirmation de l'adresse, avec un lien vers /verifier-email
  async sendVerification() {
    return await this.auth.sendVerification(`${window.location.origin}/verifier-email`);
  }

  async confirmVerification(userId: string, secret: string) {
    return await this.auth.confirmVerification(userId, secret);
  }

  // Mot de passe oublié : lien vers /reinitialiser-mot-de-passe
  async sendPasswordRecovery(email: string) {
    return await this.auth.sendPasswordRecovery(
      email,
      `${window.location.origin}/reinitialiser-mot-de-passe`,
    );
  }

  async resetPassword(userId: string, secret: string, password: string) {
    return await this.auth.resetPassword(userId, secret, password);
  }
}
