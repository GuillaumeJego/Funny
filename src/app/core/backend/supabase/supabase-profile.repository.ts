import { Injectable } from '@angular/core';
import { Profile } from '../../models/profile.model';
import { ProfileRepository } from '../../repositories/profile.repository';
import { MiniProfile, RepositoryResult } from '../../repositories/repository.types';
import { SupabaseClientService, toResult } from './supabase-client';

@Injectable()
export class SupabaseProfileRepository extends ProfileRepository {
  constructor(private supabase: SupabaseClientService) {
    super();
  }

  async getById(userId: string): Promise<RepositoryResult<Profile>> {
    return toResult(
      await this.supabase.client.from('profiles').select('*').eq('id', userId).single(),
    );
  }

  async getAll(): Promise<RepositoryResult<Profile[]>> {
    return toResult(
      await this.supabase.client
        .from('profiles')
        .select(
          'id, username, avatar_url, bio, role, can_view_profiles, subscription_end_date, gender, smoking, vaping, alcohol, relationship',
        )
        .order('username'),
    );
  }

  async getMiniProfiles(userIds: string[]): Promise<MiniProfile[]> {
    if (userIds.length === 0) return [];
    const { data } = await this.supabase.client
      .from('profiles')
      .select('id, username, avatar_url')
      .in('id', userIds);
    return (data ?? []) as MiniProfile[];
  }

  async update(userId: string, updates: Partial<Profile>): Promise<RepositoryResult<null>> {
    return toResult(await this.supabase.client.from('profiles').update(updates).eq('id', userId));
  }
}
