import { Profile } from '../models/profile.model';
import { MiniProfile, ProfileVisitsResult, RepositoryResult } from './repository.types';

export abstract class ProfileRepository {
  abstract getById(userId: string): Promise<RepositoryResult<Profile>>;
  abstract getAll(): Promise<RepositoryResult<Profile[]>>;
  /** Profils réduits (id, pseudo, photo), dans un ordre quelconque. */
  abstract getMiniProfiles(userIds: string[]): Promise<MiniProfile[]>;
  abstract update(userId: string, updates: Partial<Profile>): Promise<RepositoryResult<null>>;
  /** Catégories de notifications que le membre ne veut plus recevoir. */
  abstract setMutedNotifications(
    userId: string,
    categories: string[],
  ): Promise<RepositoryResult<null>>;
  /** Signale au serveur que je regarde le profil de ce membre (sans effet visible). */
  abstract recordProfileVisit(memberId: string): Promise<void>;
  /** Qui a visité mon profil ces 30 derniers jours ; null si le serveur ne répond pas. */
  abstract getProfileVisits(): Promise<ProfileVisitsResult | null>;
}
