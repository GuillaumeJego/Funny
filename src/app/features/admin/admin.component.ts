import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { ProfileService } from '../../core/services/profile.service';
import { SettingsService } from '../../core/services/settings.service';
import { Profile } from '../../core/models/profile.model';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin.component.html',
  styleUrl: './admin.component.scss'
})
export class AdminComponent implements OnInit {
  loading = true;
  saving = false;
  profilePagePremiumOnly = false;
  membres: Profile[] = [];
  searchQuery = '';

  constructor(
    private auth: AuthService,
    private profileService: ProfileService,
    private settingsService: SettingsService,
    private router: Router
  ) {}

  async ngOnInit() {
    const { data: { user } } = await this.auth.getUser();
    if (!user) { this.router.navigate(['/login']); return; }

    const { data: profile } = await this.profileService.getMyProfile(user.id);
    if (profile?.role !== 'admin' && profile?.role !== 'developer') { this.router.navigate(['/dashboard']); return; }

    const [setting, membres] = await Promise.all([
      this.settingsService.get('profile_page_premium_only'),
      this.profileService.getAllProfiles()
    ]);

    this.profilePagePremiumOnly = setting === true;
    this.membres = (membres.data ?? []) as Profile[];
    this.loading = false;
  }

  async togglePremiumOnly() {
    this.saving = true;
    this.profilePagePremiumOnly = !this.profilePagePremiumOnly;
    await this.settingsService.set('profile_page_premium_only', this.profilePagePremiumOnly);
    this.saving = false;
  }

  async setCanViewProfiles(membre: Profile, value: boolean | null) {
    await this.profileService.updateProfile(membre.id, { can_view_profiles: value });
    membre.can_view_profiles = value;
  }

  async setRole(membre: Profile, role: string) {
    await this.profileService.updateProfile(membre.id, { role });
    membre.role = role;
  }

  isPremium(m: Profile): boolean {
    if (!m.subscription_end_date) return false;
    return new Date(m.subscription_end_date) > new Date();
  }

  async togglePremium(m: Profile) {
    const newDate = this.isPremium(m) ? null : '2099-12-31T23:59:59Z';
    await this.profileService.updateProfile(m.id, { subscription_end_date: newDate ?? undefined });
    m.subscription_end_date = newDate ?? undefined;
  }

  get filteredMembres(): Profile[] {
    if (!this.searchQuery.trim()) return this.membres;
    const q = this.searchQuery.toLowerCase();
    return this.membres.filter(m => m.username.toLowerCase().includes(q));
  }

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
