import { RepositoryError } from './repository.types';

export abstract class SettingsRepository {
  abstract get(key: string): Promise<any>;
  abstract set(key: string, value: any): Promise<{ error: RepositoryError | null }>;
}
