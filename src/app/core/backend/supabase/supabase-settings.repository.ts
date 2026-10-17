import { Injectable } from '@angular/core';
import { RepositoryError } from '../../repositories/repository.types';
import { SettingsRepository } from '../../repositories/settings.repository';
import { SupabaseClientService, toError } from './supabase-client';

@Injectable()
export class SupabaseSettingsRepository extends SettingsRepository {
  constructor(private supabase: SupabaseClientService) {
    super();
  }

  async get(key: string): Promise<any> {
    const { data } = await this.supabase.client
      .from('app_settings')
      .select('value')
      .eq('key', key)
      .single();
    return data?.value;
  }

  async set(key: string, value: any): Promise<{ error: RepositoryError | null }> {
    const { error } = await this.supabase.client
      .from('app_settings')
      .update({ value, updated_at: new Date().toISOString() })
      .eq('key', key);
    return { error: toError(error) };
  }
}
