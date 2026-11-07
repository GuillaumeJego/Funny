import {
  Component,
  OnInit,
  ChangeDetectionStrategy,
  inject,
  signal,
  computed,
} from '@angular/core';

import { DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { ProfileService } from '../../core/services/profile.service';
import { SettingsService } from '../../core/services/settings.service';
import { ModerationService } from '../../core/services/moderation.service';
import { Profile } from '../../core/models/profile.model';
import { Report, ReportMessage, reportReasonLabel } from '../../core/models/report.model';
import { AdminThemesComponent } from './admin-themes/admin-themes.component';
import { AdminStatsComponent } from './admin-stats/admin-stats.component';
import { ClickableDirective } from '../../core/directives/clickable.directive';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [ClickableDirective, FormsModule, DatePipe, AdminThemesComponent, AdminStatsComponent],
  templateUrl: './admin.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './admin.component.scss',
})
export class AdminComponent implements OnInit {
  private auth = inject(AuthService);
  private profileService = inject(ProfileService);
  private settingsService = inject(SettingsService);
  private moderationService = inject(ModerationService);
  router = inject(Router);

  readonly loading = signal(true);
  readonly tab = signal<'gestion' | 'stats'>('gestion');
  readonly saving = signal(false);
  readonly profilePagePremiumOnly = signal(false);
  readonly sortieCreationAccess = signal<'all' | 'premium' | 'admin'>('all');
  readonly membres = signal<Profile[]>([]);
  readonly searchQuery = signal('');
  readonly heartLimit = signal(1);
  readonly heartDays = signal(30);
  readonly heartSaved = signal(false);
  readonly currentUserRole = signal('');
  readonly currentUserId = signal('');
  readonly reports = signal<Report[]>([]);

  readonly banModal = signal<{ membre: Profile; days: number; reason: string } | null>(null);
  readonly banning = signal(false);
  readonly banError = signal('');
  banPresets = [
    { days: 1, label: '1 jour' },
    { days: 7, label: '7 jours' },
    { days: 30, label: '30 jours' },
    { days: 3650, label: 'Définitif' },
  ];

  async ngOnInit() {
    const {
      data: { user },
    } = await this.auth.getUser();
    if (!user) {
      this.router.navigate(['/login']);
      return;
    }

    const { data: profile } = await this.profileService.getMyProfile(user.id);
    if (profile?.role !== 'admin' && profile?.role !== 'developer') {
      this.router.navigate(['/dashboard']);
      return;
    }
    this.currentUserRole.set(profile.role ?? '');
    this.currentUserId.set(user.id);

    const [setting, creationSetting, membres, reports, heartLimit, heartDays] = await Promise.all([
      this.settingsService.get('profile_page_premium_only'),
      this.settingsService.get('sortie_creation_access'),
      this.profileService.getAllProfiles(),
      this.moderationService.getOpenReports(),
      this.settingsService.get('coeurs_par_periode'),
      this.settingsService.get('coeurs_periode_jours'),
    ]);
    if (Number(heartLimit) > 0) this.heartLimit.set(Number(heartLimit));
    if (Number(heartDays) > 0) this.heartDays.set(Number(heartDays));
    this.reports.set(reports.data ?? []);

    this.profilePagePremiumOnly.set(setting === true);
    this.sortieCreationAccess.set(creationSetting ?? 'all');
    this.membres.set((membres.data ?? []) as Profile[]);
    this.loading.set(false);
  }

  /** Coups de cœur : combien chaque membre peut en donner, et sur combien de jours. */
  async saveHeartRules(limit: number, days: number) {
    const cleanLimit = Math.min(50, Math.max(1, Math.round(Number(limit) || 1)));
    const cleanDays = Math.min(365, Math.max(1, Math.round(Number(days) || 30)));
    this.heartLimit.set(cleanLimit);
    this.heartDays.set(cleanDays);
    this.heartSaved.set(false);
    await Promise.all([
      this.settingsService.set('coeurs_par_periode', cleanLimit),
      this.settingsService.set('coeurs_periode_jours', cleanDays),
    ]);
    this.heartSaved.set(true);
  }

  async setSortieCreationAccess(value: 'all' | 'premium' | 'admin') {
    this.sortieCreationAccess.set(value);
    await this.settingsService.set('sortie_creation_access', value);
  }

  async togglePremiumOnly() {
    this.saving.set(true);
    this.profilePagePremiumOnly.set(!this.profilePagePremiumOnly());
    await this.settingsService.set('profile_page_premium_only', this.profilePagePremiumOnly());
    this.saving.set(false);
  }

  async setCanViewProfiles(membre: Profile, value: boolean | null) {
    await this.profileService.adminUpdateProfile(membre.id, { can_view_profiles: value });
    this.patchMembre(membre.id, { can_view_profiles: value });
  }

  canEditRole(membre: Profile): boolean {
    if (membre.role === 'developer' && this.currentUserRole() !== 'developer') return false;
    return true;
  }

  availableRoles(): { value: string; label: string }[] {
    if (this.currentUserRole() === 'developer') {
      return [
        { value: 'user', label: '👤 Membre' },
        { value: 'admin', label: '🛡️ Admin' },
        { value: 'developer', label: '🛠️ Développeur' },
      ];
    }
    return [
      { value: 'user', label: '👤 Membre' },
      { value: 'admin', label: '🛡️ Admin' },
    ];
  }

  async setRole(membre: Profile, role: string) {
    if (!this.canEditRole(membre)) return;
    const previousRole = membre.role;
    this.patchMembre(membre.id, { role });
    const { error } = await this.profileService.adminUpdateProfile(membre.id, { role });
    if (error) this.patchMembre(membre.id, { role: previousRole }); // revert si erreur DB
  }

  /** Met à jour un membre de la liste par copie, pour que l'affichage suive. */
  private patchMembre(id: string, change: Partial<Profile>) {
    this.membres.set(this.membres().map((m) => (m.id === id ? { ...m, ...change } : m)));
  }

  readonly premiumModal = signal<{ membre: Profile; mois: number } | null>(null);

  isPremium(m: Profile): boolean {
    if (!m.subscription_end_date) return false;
    return new Date(m.subscription_end_date) > new Date();
  }

  remainingDays(m: Profile): number {
    if (!m.subscription_end_date) return 0;
    const diff = new Date(m.subscription_end_date).getTime() - new Date().getTime();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }

  openPremiumModal(m: Profile) {
    if (this.isPremium(m)) {
      this.revokePremium(m);
    } else {
      this.premiumModal.set({ membre: m, mois: 1 });
    }
  }

  async confirmPremium() {
    const modal = this.premiumModal();
    if (!modal) return;
    const { membre, mois } = modal;
    const end = new Date();
    end.setMonth(end.getMonth() + mois);
    await this.profileService.adminUpdateProfile(membre.id, {
      subscription_end_date: end.toISOString(),
    });
    this.patchMembre(membre.id, { subscription_end_date: end.toISOString() });
    this.premiumModal.set(null);
  }

  async revokePremium(m: Profile) {
    await this.profileService.adminUpdateProfile(m.id, { subscription_end_date: null as any });
    this.patchMembre(m.id, { subscription_end_date: undefined });
  }

  reasonLabel(reason: string): string {
    return reportReasonLabel(reason);
  }

  memberById(id: string): Profile | undefined {
    return this.membres().find((m) => m.id === id);
  }

  /** Supprime le message pour tout le monde (avec sa photo ou vidéo). */
  async deleteMessage(report: Report, message: ReportMessage) {
    if (!confirm('Supprimer ce message pour tout le monde ? Cette action est définitive.')) return;
    const { error } = await this.moderationService.deleteReportedMessage(report.id, message.id);
    if (error) {
      alert(error.message);
      return;
    }
    this.reports.update((list) =>
      list.map((r) =>
        r.id !== report.id
          ? r
          : {
              ...r,
              messages: r.messages.map((m) =>
                m.id === message.id ? { ...m, deleted: true, media_url: null } : m,
              ),
            },
      ),
    );
  }

  async markHandled(report: Report) {
    const { error } = await this.moderationService.markReportHandled(report.id);
    if (!error) this.reports.set(this.reports().filter((r) => r.id !== report.id));
  }

  isBanned(m: Profile): boolean {
    return !!m.is_banned && !!m.banned_until && new Date(m.banned_until) > new Date();
  }

  openBanModal(m: Profile) {
    this.banError.set('');
    this.banModal.set({ membre: m, days: 7, reason: '' });
  }

  async confirmBan() {
    const modal = this.banModal();
    if (!modal) return;
    const { membre, days, reason } = modal;
    this.banning.set(true);
    const { error } = await this.moderationService.banMember(membre.id, days, reason);
    this.banning.set(false);
    if (error) {
      this.banError.set(error.message);
      return;
    }
    this.patchMembre(membre.id, {
      is_banned: true,
      banned_until: new Date(Date.now() + days * 86400000).toISOString(),
    });
    this.banModal.set(null);
  }

  async unban(m: Profile) {
    const { error } = await this.moderationService.unbanMember(m.id);
    if (!error) {
      this.patchMembre(m.id, { is_banned: false, banned_until: undefined });
    }
  }

  /** Le compte développeur et son propre compte n'apparaissent pas : aucune action possible dessus. */
  readonly visibleMembres = computed<Profile[]>(() =>
    this.membres().filter((m) => m.role !== 'developer' && m.id !== this.currentUserId()),
  );

  readonly filteredMembres = computed<Profile[]>(() => {
    if (!this.searchQuery().trim()) return this.visibleMembres();
    const q = this.searchQuery().toLowerCase();
    return this.visibleMembres().filter((m) => m.username.toLowerCase().includes(q));
  });

  getRoleLabel(m: Profile): string {
    if (m.role === 'admin') return '🛡️ Admin';
    if (m.role === 'developer') return '🛠️ Développeur';
    return '👤 Membre';
  }

  getRoleClass(m: Profile): string {
    if (m.role === 'admin') return 'tag-admin';
    if (m.role === 'developer') return 'tag-developer';
    return 'tag-default';
  }

  getAccessLabel(m: Profile): string {
    if (m.role === 'admin' || m.role === 'developer') return '—';
    if (m.can_view_profiles === true) return 'Accordé';
    if (m.can_view_profiles === false) return 'Refusé';
    return 'Globale';
  }

  getAccessClass(m: Profile): string {
    if (m.role === 'admin' || m.role === 'developer') return 'tag-admin';
    if (m.can_view_profiles === true) return 'tag-allowed';
    if (m.can_view_profiles === false) return 'tag-denied';
    return 'tag-default';
  }
}
