import { Injectable } from '@angular/core';
import { Models, Query } from 'appwrite';
import { Report } from '../../models/report.model';
import { AdminRepository } from '../../repositories/admin.repository';
import { RepositoryResult } from '../../repositories/repository.types';
import { AppwriteClientService, DB, attempt } from './appwrite-client';

type ReportRow = Models.Row & {
  reporter_id: string;
  target_user_id: string;
  reason: string;
  details: string | null;
};

@Injectable()
export class AppwriteAdminRepository extends AdminRepository {
  constructor(private appwrite: AppwriteClientService) {
    super();
  }

  setRole(userId: string, role: string): Promise<RepositoryResult<null>> {
    return this.call('setRole', { userId, role });
  }

  setPremium(userId: string, until: string | null): Promise<RepositoryResult<null>> {
    return this.call('setPremium', { userId, until });
  }

  setCanViewProfiles(userId: string, value: boolean | null): Promise<RepositoryResult<null>> {
    return this.call('setCanViewProfiles', { userId, value });
  }

  ban(userId: string, days: number, reason: string): Promise<RepositoryResult<null>> {
    return this.call('ban', { userId, days, reason });
  }

  unban(userId: string): Promise<RepositoryResult<null>> {
    return this.call('unban', { userId });
  }

  getOpenReports(): Promise<RepositoryResult<Report[]>> {
    return attempt(async () => {
      const rows = await this.appwrite.listAll<ReportRow>('reports', [
        Query.equal('status', 'open'),
        Query.orderDesc('$createdAt'),
      ]);
      const profiles = await this.appwrite.miniProfiles(
        rows.flatMap((r) => [r.reporter_id, r.target_user_id]),
      );
      return rows.map((row) => ({
        id: row.$id,
        created_at: row.$createdAt,
        reason: row.reason,
        details: row.details || null,
        reporter: profiles.get(row.reporter_id) ?? null,
        target: profiles.get(row.target_user_id) ?? null,
        target_user_id: row.target_user_id,
      }));
    });
  }

  markReportHandled(reportId: string): Promise<RepositoryResult<null>> {
    return attempt(async () => {
      await this.appwrite.tables.updateRow({
        databaseId: DB,
        tableId: 'reports',
        rowId: reportId,
        data: { status: 'handled' },
      });
      return null;
    });
  }

  private async call(action: string, input: Record<string, unknown>) {
    const { error } = await this.appwrite.run('admin', action, input);
    return { data: null, error };
  }
}
