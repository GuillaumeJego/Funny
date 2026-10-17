import { AuthUser, RepositoryError } from './repository.types';

export abstract class AuthRepository {
  abstract register(email: string, password: string): Promise<{ error: RepositoryError | null }>;
  abstract login(email: string, password: string): Promise<{ error: RepositoryError | null }>;
  abstract logout(): Promise<{ error: RepositoryError | null }>;
  abstract getUser(): Promise<{ data: { user: AuthUser | null } }>;
  abstract hasSession(): Promise<boolean>;
}
