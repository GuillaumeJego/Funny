import { Injectable } from '@angular/core';
import { AppwriteException, ID } from 'appwrite';
import { AuthRepository } from '../../repositories/auth.repository';
import { AuthUser, RepositoryError } from '../../repositories/repository.types';
import { AppwriteClientService, toError } from './appwrite-client';

/** Messages compréhensibles pour les erreurs de connexion les plus courantes. */
const MESSAGES: Record<string, string> = {
  user_already_exists: 'Un compte existe déjà avec cet email.',
  user_invalid_credentials: 'Email ou mot de passe incorrect.',
  user_blocked: 'Ce compte est suspendu.',
  password_recently_used: 'Ce mot de passe a déjà été utilisé, choisissez-en un autre.',
  password_personal_data: 'Le mot de passe ne doit pas contenir votre nom ou votre email.',
  user_password_mismatch: 'Les mots de passe ne correspondent pas.',
  general_rate_limit_exceeded: 'Trop de tentatives, réessayez dans quelques minutes.',
};

function authError(error: unknown): RepositoryError {
  if (error instanceof AppwriteException) {
    if (MESSAGES[error.type]) return { message: MESSAGES[error.type] };
    if (error.type === 'general_argument_invalid' && /password/i.test(error.message)) {
      return {
        message:
          'Mot de passe trop faible : 10 caractères minimum, avec des majuscules, des minuscules, des chiffres et des symboles, et pas un mot courant.',
      };
    }
  }
  return toError(error);
}

@Injectable()
export class AppwriteAuthRepository extends AuthRepository {
  constructor(private appwrite: AppwriteClientService) {
    super();
  }

  async register(
    email: string,
    password: string,
    username: string,
  ): Promise<{ error: RepositoryError | null }> {
    try {
      await this.appwrite.account.create({ userId: ID.unique(), email, password });
      await this.openSession(email, password);
    } catch (error) {
      return { error: authError(error) };
    }
    const { error } = await this.appwrite.run('account', 'init', { username });
    if (error) {
      // Pseudo refusé : on supprime le compte tout juste créé (et sa session) pour pouvoir recommencer.
      const removed = await this.appwrite.run('account', 'delete', { confirm: 'SUPPRIMER' });
      if (removed.error) await this.logout();
      return { error };
    }
    return { error: null };
  }

  async login(email: string, password: string): Promise<{ error: RepositoryError | null }> {
    try {
      await this.openSession(email, password);
      return { error: null };
    } catch (error) {
      return { error: authError(error) };
    }
  }

  async logout(): Promise<{ error: RepositoryError | null }> {
    try {
      await this.appwrite.account.deleteSession({ sessionId: 'current' });
      return { error: null };
    } catch (error) {
      return { error: toError(error) };
    }
  }

  async getUser(): Promise<{ data: { user: AuthUser | null } }> {
    try {
      const user = await this.appwrite.account.get();
      return { data: { user: { id: user.$id, email: user.email } } };
    } catch {
      return { data: { user: null } };
    }
  }

  async hasSession(): Promise<boolean> {
    return (await this.getUser()).data.user !== null;
  }

  private async openSession(email: string, password: string) {
    try {
      await this.appwrite.account.createEmailPasswordSession({ email, password });
    } catch (error) {
      // Une ancienne session est restée ouverte : on la ferme et on recommence.
      if (error instanceof AppwriteException && error.type === 'user_session_already_exists') {
        await this.appwrite.account.deleteSession({ sessionId: 'current' });
        await this.appwrite.account.createEmailPasswordSession({ email, password });
        return;
      }
      throw error;
    }
  }
}
