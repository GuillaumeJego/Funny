import { RepositoryResult } from './repository.types';

/** Actions réservées aux administrateurs : le serveur vérifie l'appartenance à l'équipe admins. */
export abstract class AdminRepository {
  abstract setRole(userId: string, role: string): Promise<RepositoryResult<null>>;
  /** `until` à null retire le Premium accordé à la main. */
  abstract setPremium(userId: string, until: string | null): Promise<RepositoryResult<null>>;
  abstract setCanViewProfiles(
    userId: string,
    value: boolean | null,
  ): Promise<RepositoryResult<null>>;
}
