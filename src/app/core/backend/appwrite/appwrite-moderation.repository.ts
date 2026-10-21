import { Injectable } from '@angular/core';
import { Models } from 'appwrite';
import { ReportReason } from '../../models/report.model';
import { ModerationRepository } from '../../repositories/moderation.repository';
import { RepositoryResult } from '../../repositories/repository.types';
import { AppwriteClientService } from './appwrite-client';

type BlockRow = Models.Row & { blocker_id: string; blocked_id: string };

@Injectable()
export class AppwriteModerationRepository extends ModerationRepository {
  constructor(private appwrite: AppwriteClientService) {
    super();
  }

  report(userId: string, reason: ReportReason, details: string): Promise<RepositoryResult<null>> {
    return this.call('report', { userId, reason, details });
  }

  block(userId: string): Promise<RepositoryResult<null>> {
    return this.call('block', { userId });
  }

  unblock(userId: string): Promise<RepositoryResult<null>> {
    return this.call('unblock', { userId });
  }

  async getBlockedIds(): Promise<string[]> {
    // Chaque membre ne peut lire que ses propres blocages.
    const rows = await this.appwrite.listAll<BlockRow>('blocks');
    return rows.map((row) => row.blocked_id);
  }

  private async call(action: string, input: Record<string, unknown>) {
    const { error } = await this.appwrite.run('social', action, input);
    return { data: null, error };
  }
}
