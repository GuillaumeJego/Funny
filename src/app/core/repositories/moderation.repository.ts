import { ReportReason } from '../models/report.model';
import { RepositoryResult } from './repository.types';

/** Sécurité des membres : signaler et bloquer. Le serveur enregistre l'auteur lui-même. */
export abstract class ModerationRepository {
  abstract report(
    userId: string,
    reason: ReportReason,
    details: string,
  ): Promise<RepositoryResult<null>>;
  abstract block(userId: string): Promise<RepositoryResult<null>>;
  abstract unblock(userId: string): Promise<RepositoryResult<null>>;
  /** Membres bloqués par le membre connecté. */
  abstract getBlockedIds(): Promise<string[]>;
}
