import {
  Component,
  EventEmitter,
  HostListener,
  Input,
  Output,
  ChangeDetectionStrategy,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ModerationService } from '../../services/moderation.service';
import { REPORT_REASONS, ReportReason } from '../../models/report.model';

/** Bouton « ⋯ » d'un membre : le signaler aux admins, le bloquer ou le débloquer. */
@Component({
  selector: 'app-member-safety',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './member-safety.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './member-safety.component.scss',
})
export class MemberSafetyComponent {
  @Input({ required: true }) memberId!: string;
  @Input() username = '';
  @Input() blocked = false;
  /** Émis après un blocage (true) ou un déblocage (false). */
  @Output() blockedChange = new EventEmitter<boolean>();

  reasons = REPORT_REASONS;
  menuOpen = false;
  dialog: 'report' | 'block' | 'reported' | null = null;
  reason: ReportReason | '' = '';
  details = '';
  busy = false;
  errorMessage = '';

  constructor(private moderation: ModerationService) {}

  /** Un clic ailleurs ou Échap ferment le menu. */
  @HostListener('document:click')
  @HostListener('document:keydown.escape')
  closeMenu() {
    this.menuOpen = false;
  }

  open(dialog: 'report' | 'block') {
    this.menuOpen = false;
    this.errorMessage = '';
    this.reason = '';
    this.details = '';
    this.dialog = dialog;
  }

  close() {
    this.dialog = null;
  }

  async sendReport() {
    if (!this.reason) return;
    this.busy = true;
    const { error } = await this.moderation.report(this.memberId, this.reason, this.details);
    this.busy = false;
    if (error) {
      this.errorMessage = error.message;
      return;
    }
    this.dialog = 'reported';
  }

  async confirmBlock() {
    this.busy = true;
    const { error } = await this.moderation.block(this.memberId);
    this.busy = false;
    if (error) {
      this.errorMessage = error.message;
      return;
    }
    this.dialog = null;
    this.blockedChange.emit(true);
  }

  async unblock() {
    this.menuOpen = false;
    this.busy = true;
    const { error } = await this.moderation.unblock(this.memberId);
    this.busy = false;
    if (!error) this.blockedChange.emit(false);
  }
}
