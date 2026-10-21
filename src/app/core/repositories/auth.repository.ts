import { AuthUser, RepositoryError } from './repository.types';

export abstract class AuthRepository {
  /** Crée le compte, ouvre la session et crée le profil avec ce pseudo. */
  abstract register(
    email: string,
    password: string,
    username: string,
  ): Promise<{ error: RepositoryError | null }>;
  abstract login(email: string, password: string): Promise<{ error: RepositoryError | null }>;
  abstract logout(): Promise<{ error: RepositoryError | null }>;
  abstract getUser(): Promise<{ data: { user: AuthUser | null } }>;
  abstract hasSession(): Promise<boolean>;
}
