import { RepositoryResult } from './repository.types';

/** Envoi de fichiers : chaque méthode renvoie l'adresse publique du fichier envoyé. */
export abstract class StorageRepository {
  abstract uploadAvatar(userId: string, image: Blob): Promise<RepositoryResult<string>>;
  abstract uploadSortieImage(userId: string, image: File): Promise<RepositoryResult<string>>;
  abstract uploadChatMedia(userId: string, file: File): Promise<RepositoryResult<string>>;
}
