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
  /** Supprime définitivement le compte connecté et toutes ses données. */
  abstract deleteAccount(): Promise<{ error: RepositoryError | null }>;
}
