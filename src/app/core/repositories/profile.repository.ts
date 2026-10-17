import { Profile } from '../models/profile.model';
import { MiniProfile, RepositoryResult } from './repository.types';

export abstract class ProfileRepository {
  abstract getById(userId: string): Promise<RepositoryResult<Profile>>;
  abstract getAll(): Promise<RepositoryResult<Profile[]>>;
  /** Profils réduits (id, pseudo, photo), dans un ordre quelconque. */
  abstract getMiniProfiles(userIds: string[]): Promise<MiniProfile[]>;
  abstract update(userId: string, updates: Partial<Profile>): Promise<RepositoryResult<null>>;
}
