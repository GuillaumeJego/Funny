import { Injectable } from '@angular/core';
import { AppwriteException, ID, Permission, Role } from 'appwrite';
import { RepositoryResult } from '../../repositories/repository.types';
import { StorageRepository } from '../../repositories/storage.repository';
import { AppwriteClientService, attempt } from './appwrite-client';

@Injectable()
export class AppwriteStorageRepository extends StorageRepository {
  constructor(private appwrite: AppwriteClientService) {
    super();
  }

  /** Une seule photo par membre : son identifiant est celui du membre. */
  uploadAvatar(userId: string, image: Blob): Promise<RepositoryResult<string>> {
    return attempt(async () => {
      try {
        await this.appwrite.storage.deleteFile({ bucketId: 'avatars', fileId: userId });
      } catch (error) {
        if (!(error instanceof AppwriteException && error.code === 404)) throw error;
      }
      await this.appwrite.storage.createFile({
        bucketId: 'avatars',
        fileId: userId,
        file: new File([image], 'avatar.jpg', { type: 'image/jpeg' }),
        permissions: ownedBy(userId),
      });
      return this.appwrite.fileUrl('avatars', userId);
    });
  }

  uploadSortieImage(userId: string, image: File): Promise<RepositoryResult<string>> {
    return attempt(async () => {
      const file = await this.appwrite.storage.createFile({
        bucketId: 'sorties-images',
        fileId: ID.unique(),
        file: image,
        permissions: ownedBy(userId),
      });
      return this.appwrite.fileUrl('sorties-images', file.$id);
    });
  }

  /** Fichier lisible par les seuls participants de la conversation ; renvoie son identifiant. */
  uploadChatMedia(
    userId: string,
    conversationId: string,
    file: File,
  ): Promise<RepositoryResult<string>> {
    return attempt(async () => {
      const created = await this.appwrite.storage.createFile({
        bucketId: 'chat-media',
        fileId: ID.unique(),
        file,
        permissions: [Permission.read(Role.team(conversationId)), ...ownedBy(userId)],
      });
      return created.$id;
    });
  }
}

function ownedBy(userId: string): string[] {
  return [Permission.update(Role.user(userId)), Permission.delete(Role.user(userId))];
}
