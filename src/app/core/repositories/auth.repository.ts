import { AuthUser, RepositoryError } from './repository.types';

export abstract class AuthRepository {
  /**
   * Crée le compte, ouvre la session et crée le profil avec ce pseudo.
   * `consent` : le membre déclare avoir 18 ans ou plus et accepte les conditions.
   */
  abstract register(
    email: string,
    password: string,
    username: string,
    consent: { adult: boolean; terms: boolean },
  ): Promise<{ error: RepositoryError | null }>;
  abstract login(email: string, password: string): Promise<{ error: RepositoryError | null }>;
  abstract logout(): Promise<{ error: RepositoryError | null }>;
  abstract getUser(): Promise<{ data: { user: AuthUser | null } }>;
  abstract hasSession(): Promise<boolean>;
  /** Supprime définitivement le compte connecté et toutes ses données, après vérification du mot de passe. */
  abstract deleteAccount(password: string): Promise<{ error: RepositoryError | null }>;
  /** Envoie au membre connecté un e-mail avec un lien vers `url` pour confirmer son adresse. */
  abstract sendVerification(url: string): Promise<{ error: RepositoryError | null }>;
  /** Valide l'adresse avec les paramètres du lien reçu (marche aussi sans session). */
  abstract confirmVerification(
    userId: string,
    secret: string,
  ): Promise<{ error: RepositoryError | null }>;
  /** Envoie un lien vers `url` pour choisir un nouveau mot de passe, si un compte existe. */
  abstract sendPasswordRecovery(
    email: string,
    url: string,
  ): Promise<{ error: RepositoryError | null }>;
  /** Enregistre le nouveau mot de passe avec les paramètres du lien reçu. */
  abstract resetPassword(
    userId: string,
    secret: string,
    password: string,
  ): Promise<{ error: RepositoryError | null }>;
}
