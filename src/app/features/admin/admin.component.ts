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
    if (profile?.role !== 'admin') { this.router.navigate(['/dashboard']); return; }

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

  get filteredMembres(): Profile[] {
    if (!this.searchQuery.trim()) return this.membres;
    const q = this.searchQuery.toLowerCase();
    return this.membres.filter(m => m.username.toLowerCase().includes(q));
  }

  getAccessLabel(m: Profile): string {
    if (m.role === 'admin') return 'Admin';
    if (m.can_view_profiles === true) return 'Accès accordé';
    if (m.can_view_profiles === false) return 'Accès refusé';
    return 'Règle globale';
  }

  getAccessClass(m: Profile): string {
    if (m.role === 'admin') return 'tag-admin';
    if (m.can_view_profiles === true) return 'tag-allowed';
    if (m.can_view_profiles === false) return 'tag-denied';
    return 'tag-default';
  }
}
