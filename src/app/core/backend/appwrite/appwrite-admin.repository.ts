import { Injectable, inject } from '@angular/core';
import { Models, Query } from 'appwrite';
import { Report, ReportMessage } from '../../models/report.model';
import { ConnexionStats, StatsQuery } from '../../models/stats.model';
import { AdminRepository } from '../../repositories/admin.repository';
import { RepositoryResult } from '../../repositories/repository.types';
import { AppwriteClientService, DB, attempt } from './appwrite-client';

type ReportRow = Models.Row & {
  reporter_id: string;
  target_user_id: string;
  reason: string;
  details: string | null;
  evidence?: string | null;
};

type EvidenceRow = {
  id: string;
  sender_id: string;
  content: string;
  type: ReportMessage['type'];
  media_file_id: string | null;
  at: string;
  deleted?: boolean;
};

function parseEvidence(json: string | null | undefined): EvidenceRow[] {
  try {
    const value = JSON.parse(json || '[]');
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

@Injectable()
export class AppwriteAdminRepository extends AdminRepository {
  private appwrite = inject(AppwriteClientService);

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
      const evidence = new Map(rows.map((r) => [r.$id, parseEvidence(r.evidence)]));
      const profiles = await this.appwrite.miniProfiles(
        rows.flatMap((r) => [
          r.reporter_id,
          r.target_user_id,
          ...evidence.get(r.$id)!.map((m) => m.sender_id),
        ]),
      );
      const messagesOf = (row: ReportRow) =>
        Promise.all(
          evidence.get(row.$id)!.map(async (m): Promise<ReportMessage> => ({
            id: m.id,
            sender: profiles.get(m.sender_id) ?? null,
            sender_id: m.sender_id,
            content: m.content,
            type: m.type,
            media_url:
              m.media_file_id && !m.deleted
                ? await this.appwrite.privateFileUrl('chat-media', m.media_file_id)
                : null,
            at: m.at,
            deleted: !!m.deleted,
          })),
        );
      const messages = await Promise.all(rows.map(messagesOf));
      return rows.map((row, i) => ({
        id: row.$id,
        created_at: row.$createdAt,
        reason: row.reason,
        details: row.details || null,
        reporter: profiles.get(row.reporter_id) ?? null,
        target: profiles.get(row.target_user_id) ?? null,
        target_user_id: row.target_user_id,
        messages: messages[i],
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

  deleteReportedMessage(reportId: string, messageId: string): Promise<RepositoryResult<null>> {
    return this.call('deleteMessage', { reportId, messageId });
  }

  async getStats(query: StatsQuery): Promise<RepositoryResult<ConnexionStats>> {
    const { data, error } = await this.appwrite.run<ConnexionStats>('admin', 'stats', { ...query });
    if (error || !data) return { data: null, error };
    const { days, hours, pages, total, unique, pageViews, messages, sorties, joins, newMembers } =
      data;
    return {
      data: { days, hours, pages, total, unique, pageViews, messages, sorties, joins, newMembers },
      error: null,
    };
  }

  private async call(action: string, input: Record<string, unknown>) {
    const { error } = await this.appwrite.run('admin', action, input);
    return { data: null, error };
  }
}
