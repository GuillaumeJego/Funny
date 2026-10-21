import { Injectable } from '@angular/core';
import { Models, Query } from 'appwrite';
import { Profile } from '../../models/profile.model';
import { ProfileRepository } from '../../repositories/profile.repository';
import { MiniProfile, RepositoryResult } from '../../repositories/repository.types';
import { AppwriteClientService, DB, attempt } from './appwrite-client';

type ProfileRow = Models.Row & Omit<Profile, 'id'>;
type StatusRow = Models.Row & Pick<Profile, 'role' | 'subscription_end_date' | 'can_view_profiles'>;

/**
 * Assemble le profil public, le statut (rôle, abonnement) et, quand le membre a le droit
 * de les lire, la partie privée et la fiche de modération. Les valeurs vides sont omises.
 */
function toProfile(row: ProfileRow, ...parts: (Models.Row | null)[]): Profile {
  const profile: Record<string, unknown> = { id: row.$id };
  for (const part of [row, ...parts]) {
    if (!part) continue;
    for (const [key, value] of Object.entries(part)) {
      if (!key.startsWith('$') && value !== null) profile[key] = value;
    }
  }
  // Date de naissance au format AAAA-MM-JJ, comme l'attend le champ <input type="date">.
  if (typeof profile['birthdate'] === 'string')
    profile['birthdate'] = profile['birthdate'].slice(0, 10);
  return profile as unknown as Profile;
}

@Injectable()
export class AppwriteProfileRepository extends ProfileRepository {
  constructor(private appwrite: AppwriteClientService) {
    super();
  }

  async getById(userId: string): Promise<RepositoryResult<Profile>> {
    return attempt(async () => {
      const [row, status, personal, moderation] = await Promise.all([
        this.appwrite.tables.getRow<ProfileRow>({
          databaseId: DB,
          tableId: 'profiles',
          rowId: userId,
        }),
        this.appwrite.getRowOrNull('member_status', userId),
        this.appwrite.getRowOrNull('profiles_private', userId),
        this.appwrite.getRowOrNull('moderation', userId),
      ]);
      return toProfile(row, status, personal, moderation);
    });
  }

  async getAll(): Promise<RepositoryResult<Profile[]>> {
    return attempt(async () => {
      // Les fiches de modération ne sont lisibles que par les admins (et chacun pour la sienne).
      const [rows, statuses, moderation] = await Promise.all([
        this.appwrite.listAll<ProfileRow>('profiles', [Query.orderAsc('username')]),
        this.appwrite.listAll<StatusRow>('member_status'),
        this.appwrite.listAll('moderation'),
      ]);
      const statusById = new Map(statuses.map((s) => [s.$id, s]));
      const moderationById = new Map(moderation.map((m) => [m.$id, m]));
      return rows.map((row) =>
        toProfile(row, statusById.get(row.$id) ?? null, moderationById.get(row.$id) ?? null),
      );
    });
  }

  async getMiniProfiles(userIds: string[]): Promise<MiniProfile[]> {
    return [...(await this.appwrite.miniProfiles(userIds)).values()];
  }

  async update(userId: string, updates: Partial<Profile>): Promise<RepositoryResult<null>> {
    const { birthdate, ...publicFields } = updates;
    return attempt(async () => {
      if (Object.keys(publicFields).length) {
        await this.appwrite.tables.updateRow({
          databaseId: DB,
          tableId: 'profiles',
          rowId: userId,
          data: publicFields,
        });
      }
      if (birthdate !== undefined) {
        await this.appwrite.tables.updateRow({
          databaseId: DB,
          tableId: 'profiles_private',
          rowId: userId,
          data: { birthdate: birthdate || null },
        });
      }
      return null;
    });
  }
}
