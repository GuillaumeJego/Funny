import { Injectable } from '@angular/core';
import { RepositoryResult } from '../../repositories/repository.types';
import { StorageRepository } from '../../repositories/storage.repository';
import { SupabaseClientService, toError } from './supabase-client';

@Injectable()
export class SupabaseStorageRepository extends StorageRepository {
  constructor(private supabase: SupabaseClientService) {
    super();
  }

  async uploadAvatar(userId: string, image: Blob): Promise<RepositoryResult<string>> {
    const path = `${userId}/avatar.jpg`;
    await this.supabase.client.storage.from('avatars').remove([path]);
    return this.upload('avatars', path, image, { contentType: 'image/jpeg', upsert: true });
  }

  async uploadSortieImage(userId: string, image: File): Promise<RepositoryResult<string>> {
    return this.upload('sorties-images', `${userId}/${Date.now()}.jpg`, image, { upsert: true });
  }

  async uploadChatMedia(userId: string, file: File): Promise<RepositoryResult<string>> {
    const ext = file.name.split('.').pop();
    return this.upload('chat-media', `${userId}/${Date.now()}.${ext}`, file);
  }

  private async upload(
    bucket: string,
    path: string,
    file: Blob,
    options?: { contentType?: string; upsert?: boolean },
  ): Promise<RepositoryResult<string>> {
    const storage = this.supabase.client.storage.from(bucket);
    const { error } = await storage.upload(path, file, options);
    if (error) return { data: null, error: toError(error) };
    return { data: storage.getPublicUrl(path).data.publicUrl, error: null };
  }
}
