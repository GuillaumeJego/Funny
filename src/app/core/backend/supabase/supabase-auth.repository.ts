import { Injectable } from '@angular/core';
import { AuthRepository } from '../../repositories/auth.repository';
import { AuthUser, RepositoryError } from '../../repositories/repository.types';
import { SupabaseClientService, toError } from './supabase-client';

@Injectable()
export class SupabaseAuthRepository extends AuthRepository {
  constructor(private supabase: SupabaseClientService) {
    super();
  }

  async register(email: string, password: string): Promise<{ error: RepositoryError | null }> {
    const { error } = await this.supabase.client.auth.signUp({ email, password });
    return { error: toError(error) };
  }

  async login(email: string, password: string): Promise<{ error: RepositoryError | null }> {
    const { error } = await this.supabase.client.auth.signInWithPassword({ email, password });
    return { error: toError(error) };
  }

  async logout(): Promise<{ error: RepositoryError | null }> {
    const { error } = await this.supabase.client.auth.signOut();
    return { error: toError(error) };
  }

  async getUser(): Promise<{ data: { user: AuthUser | null } }> {
    const { data } = await this.supabase.client.auth.getUser();
    const user = data.user ? { id: data.user.id, email: data.user.email } : null;
    return { data: { user } };
  }

  async hasSession(): Promise<boolean> {
    const { data } = await this.supabase.client.auth.getSession();
    return !!data.session;
  }
}
