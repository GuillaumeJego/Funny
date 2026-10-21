import { RepositoryResult } from './repository.types';

/** Envoi de fichiers : photos de profil et de sorties (adresse renvoyée) et médias du chat. */
export abstract class StorageRepository {
  abstract uploadAvatar(userId: string, image: Blob): Promise<RepositoryResult<string>>;
  abstract uploadSortieImage(userId: string, image: File): Promise<RepositoryResult<string>>;
  /** Fichier lisible par les seuls participants de la conversation ; renvoie son identifiant. */
  abstract uploadChatMedia(
    userId: string,
    conversationId: string,
    file: File,
  ): Promise<RepositoryResult<string>>;
}
