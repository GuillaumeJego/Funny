import { Injectable, inject } from '@angular/core';
import { Models, Query } from 'appwrite';
import {
  Affinite,
  AffiniteChoice,
  AffiniteRepository,
} from '../../repositories/affinite.repository';
import { RepositoryResult } from '../../repositories/repository.types';
import { AppwriteClientService } from './appwrite-client';
import { fromRow } from './rows';

@Injectable()
export class AppwriteAffiniteRepository extends AffiniteRepository {
  private appwrite = inject(AppwriteClientService);

  async getMine(userId: string, sortieId: string): Promise<Affinite[]> {
    const rows = await this.appwrite.listAll('affinites', [
      Query.equal('sortie_id', sortieId),
      Query.equal('from_user', userId),
    ]);
    return rows.map((r) => fromRow<Affinite>(r));
  }

  async getHeartDatesSince(userId: string, since: string): Promise<string[]> {
    const rows = await this.appwrite.listAll('affinites', [
      Query.equal('from_user', userId),
      Query.equal('choice', 'coup_de_coeur'),
      Query.greaterThan('$createdAt', since),
      Query.orderAsc('$createdAt'),
    ]);
    return rows.map((r) => r.$createdAt);
  }

  /** Passe par le serveur, qui vérifie le délai, le quota et prévient si c'est réciproque. */
  async answer(
    sortieId: string,
    toUserId: string,
    choice: AffiniteChoice,
  ): Promise<RepositoryResult<{ affinite: Affinite; mutual: boolean }>> {
    const { data, error } = await this.appwrite.run<{ affinite: Models.Row; mutual: boolean }>(
      'sorties',
      'affinite',
      { sortieId, toUserId, choice },
    );
    if (error || !data) return { data: null, error };
    return {
      data: { affinite: fromRow<Affinite>(data.affinite), mutual: data.mutual },
      error: null,
    };
  }
}
