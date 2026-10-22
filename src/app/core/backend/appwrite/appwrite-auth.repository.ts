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
  user_invalid_token: 'Ce lien n’est plus valable. Demandez-en un nouveau.',
  general_smtp_disabled: 'L’envoi d’e-mails n’est pas encore activé. Réessayez plus tard.',
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

/** Erreur d'un lien reçu par e-mail : lien expiré, déjà utilisé ou modifié. */
function linkError(error: unknown): RepositoryError {
  if (
    error instanceof AppwriteException &&
    (error.type === 'user_not_found' || error.code === 401 || error.code === 404)
  ) {
    return { message: MESSAGES['user_invalid_token'] };
  }
  return authError(error);
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
    consent: { adult: boolean; terms: boolean },
  ): Promise<{ error: RepositoryError | null }> {
    try {
      await this.appwrite.account.create({ userId: ID.unique(), email, password });
      await this.openSession(email, password);
    } catch (error) {
      return { error: authError(error) };
    }
    const { error } = await this.appwrite.run('account', 'init', { username, ...consent });
    if (error) {
      // Pseudo ou consentement refusé : on supprime le compte tout juste créé (et sa session) pour pouvoir recommencer.
      const removed = await this.appwrite.run('account', 'delete', { password });
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
      return {
        data: { user: { id: user.$id, email: user.email, emailVerified: user.emailVerification } },
      };
    } catch {
      return { data: { user: null } };
    }
  }

  async hasSession(): Promise<boolean> {
    return (await this.getUser()).data.user !== null;
  }

  async deleteAccount(password: string): Promise<{ error: RepositoryError | null }> {
    // Le serveur vérifie le mot de passe, puis supprime aussi le compte Appwrite : la session disparaît avec lui.
    const { error } = await this.appwrite.run('account', 'delete', { password });
    return { error };
  }

  async sendVerification(url: string): Promise<{ error: RepositoryError | null }> {
    try {
      await this.appwrite.account.createEmailVerification({ url });
      return { error: null };
    } catch (error) {
      return { error: authError(error) };
    }
  }

  async confirmVerification(
    userId: string,
    secret: string,
  ): Promise<{ error: RepositoryError | null }> {
    try {
      await this.appwrite.account.updateEmailVerification({ userId, secret });
      return { error: null };
    } catch (error) {
      return { error: linkError(error) };
    }
  }

  async sendPasswordRecovery(
    email: string,
    url: string,
  ): Promise<{ error: RepositoryError | null }> {
    try {
      await this.appwrite.account.createRecovery({ email, url });
    } catch (error) {
      // Adresse inconnue : on répond comme si l'e-mail était parti, pour ne rien révéler.
      if (error instanceof AppwriteException && error.type === 'user_not_found') {
        return { error: null };
      }
      return { error: authError(error) };
    }
    return { error: null };
  }

  async resetPassword(
    userId: string,
    secret: string,
    password: string,
  ): Promise<{ error: RepositoryError | null }> {
    try {
      await this.appwrite.account.updateRecovery({ userId, secret, password });
      return { error: null };
    } catch (error) {
      return { error: linkError(error) };
    }
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
