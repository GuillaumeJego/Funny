import { Injectable } from '@angular/core';
import { Models, Query } from 'appwrite';
import {
  InscriptionRepository,
  InscriptionStatus,
} from '../../repositories/inscription.repository';
import { RepositoryError } from '../../repositories/repository.types';
import { AppwriteClientService } from './appwrite-client';

type InscriptionRow = Models.Row & {
  sortie_id: string;
  user_id: string;
  status: 'pending' | 'waiting' | 'confirmed' | 'cancelled';
};

@Injectable()
export class AppwriteInscriptionRepository extends InscriptionRepository {
  constructor(private appwrite: AppwriteClientService) {
    super();
  }

  async getStatus(userId: string, sortieId: string): Promise<InscriptionStatus> {
    const [row] = await this.appwrite.listAll<InscriptionRow>('inscriptions', [
      Query.equal('user_id', userId),
      Query.equal('sortie_id', sortieId),
      Query.notEqual('status', 'cancelled'),
    ]);
    return row ? (row.status as InscriptionStatus) : 'none';
  }

  countPending(sortieId: string): Promise<number> {
    return this.appwrite.count('inscriptions', [
      Query.equal('sortie_id', sortieId),
      Query.equal('status', 'pending'),
    ]);
  }

  async getSortieIds(userId: string, status: 'pending' | 'waiting'): Promise<string[]> {
    const rows = await this.appwrite.listAll<InscriptionRow>('inscriptions', [
      Query.equal('user_id', userId),
      Query.equal('status', status),
      Query.orderAsc('$createdAt'),
    ]);
    return rows.map((r) => r.sortie_id);
  }

  async getParticipants(
    sortieId: string,
  ): Promise<{ user_id: string; status: 'pending' | 'confirmed' }[]> {
    const rows = await this.appwrite.listAll<InscriptionRow>('inscriptions', [
      Query.equal('sortie_id', sortieId),
      Query.equal('status', ['pending', 'confirmed']),
    ]);
    return rows.map((r) => ({ user_id: r.user_id, status: r.status as 'pending' | 'confirmed' }));
  }

  async getWaitingUserIds(sortieId: string): Promise<string[]> {
    const rows = await this.appwrite.listAll<InscriptionRow>('inscriptions', [
      Query.equal('sortie_id', sortieId),
      Query.equal('status', 'waiting'),
      Query.orderAsc('$createdAt'),
    ]);
    return rows.map((r) => r.user_id);
  }

  async rejoindre(
    _userId: string,
    sortieId: string,
  ): Promise<{ error: RepositoryError | null; status: 'pending' | 'waiting' | null }> {
    const { data, error } = await this.appwrite.run<{ status: 'pending' | 'waiting' }>(
      'sorties',
      'join',
      { sortieId },
    );
    return { error, status: data?.status ?? null };
  }

  async quitter(_userId: string, sortieId: string): Promise<{ error: RepositoryError | null }> {
    const { error } = await this.appwrite.run('sorties', 'leave', { sortieId });
    return { error };
  }
}
