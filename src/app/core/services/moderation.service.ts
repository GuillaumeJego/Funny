import { Injectable, inject } from '@angular/core';
import { AdminRepository } from '../repositories/admin.repository';
import { ModerationRepository } from '../repositories/moderation.repository';
import { ReportReason } from '../models/report.model';

/** Signaler, bloquer, et côté admin : suspendre et traiter les signalements. */
@Injectable({ providedIn: 'root' })
export class ModerationService {
  private moderation = inject(ModerationRepository);
  private admin = inject(AdminRepository);

  async report(userId: string, reason: ReportReason, details: string, conversationId?: string) {
    return await this.moderation.report(userId, reason, details, conversationId);
  }

  async block(userId: string) {
    return await this.moderation.block(userId);
  }

  async unblock(userId: string) {
    return await this.moderation.unblock(userId);
  }

  async isBlocked(userId: string): Promise<boolean> {
    return (await this.moderation.getBlockedIds()).includes(userId);
  }

  // Réservé aux admins (vérifié par le serveur)
  async banMember(userId: string, days: number, reason: string) {
    return await this.admin.ban(userId, days, reason);
  }

  async unbanMember(userId: string) {
    return await this.admin.unban(userId);
  }

  async getOpenReports() {
    return await this.admin.getOpenReports();
  }

  async markReportHandled(reportId: string) {
    return await this.admin.markReportHandled(reportId);
  }

  async deleteReportedMessage(reportId: string, messageId: string) {
    return await this.admin.deleteReportedMessage(reportId, messageId);
  }
}
