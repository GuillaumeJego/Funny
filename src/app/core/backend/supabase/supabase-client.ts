import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../../../environments/environment';
import { RepositoryError, RepositoryResult } from '../../repositories/repository.types';

/** Client Supabase partagé par les repositories de ce dossier, et seulement par eux. */
@Injectable({ providedIn: 'root' })
export class SupabaseClientService {
  readonly client: SupabaseClient = createClient(environment.supabaseUrl, environment.supabaseKey);
}

export function toError(error: { message: string } | null): RepositoryError | null {
  return error ? { message: error.message } : null;
}

export function toResult<T>(response: {
  data: unknown;
  error: { message: string } | null;
}): RepositoryResult<T> {
  return { data: (response.data ?? null) as T | null, error: toError(response.error) };
}
