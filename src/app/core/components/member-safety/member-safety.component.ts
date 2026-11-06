import {
  Component,
  HostListener,
  ChangeDetectionStrategy,
  inject,
  input,
  output,
  signal,
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
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './member-safety.component.scss',
})
export class MemberSafetyComponent {
  private moderation = inject(ModerationService);

  readonly memberId = input.required<string>();
  readonly username = input('');
  readonly blocked = input(false);
  /** Émis après un blocage (true) ou un déblocage (false). */
  readonly blockedChange = output<boolean>();

  reasons = REPORT_REASONS;
  readonly menuOpen = signal(false);
  readonly dialog = signal<'report' | 'block' | 'reported' | null>(null);
  readonly reason = signal<ReportReason | ''>('');
  readonly details = signal('');
  readonly busy = signal(false);
  readonly errorMessage = signal('');

  /** Un clic ailleurs ou Échap ferment le menu. */
  @HostListener('document:click')
  @HostListener('document:keydown.escape')
  closeMenu() {
    this.menuOpen.set(false);
  }

  open(dialog: 'report' | 'block') {
    this.menuOpen.set(false);
    this.errorMessage.set('');
    this.reason.set('');
    this.details.set('');
    this.dialog.set(dialog);
  }

  close() {
    this.dialog.set(null);
  }

  async sendReport() {
    const reason = this.reason();
    if (!reason) return;
    this.busy.set(true);
    const { error } = await this.moderation.report(this.memberId(), reason, this.details());
    this.busy.set(false);
    if (error) {
      this.errorMessage.set(error.message);
      return;
    }
    this.dialog.set('reported');
  }

  async confirmBlock() {
    this.busy.set(true);
    const { error } = await this.moderation.block(this.memberId());
    this.busy.set(false);
    if (error) {
      this.errorMessage.set(error.message);
      return;
    }
    this.dialog.set(null);
    this.blockedChange.emit(true);
  }

  async unblock() {
    this.menuOpen.set(false);
    this.busy.set(true);
    const { error } = await this.moderation.unblock(this.memberId());
    this.busy.set(false);
    if (!error) this.blockedChange.emit(false);
  }
}
