import {
  Component,
  OnInit,
  ChangeDetectionStrategy,
  inject,
  signal,
  computed,
} from '@angular/core';

import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { ProfileService } from '../../core/services/profile.service';
import { SortieService } from '../../core/services/sortie.service';
import { SettingsService } from '../../core/services/settings.service';
import {
  NavbarFiltersComponent,
  Filters,
  ThemeOption,
} from '../../core/components/navbar-filters/navbar-filters.component';
import { SortieDrawerComponent } from '../sorties/sortie-drawer/sortie-drawer.component';
import { Profile } from '../../core/models/profile.model';
import { SortieWithRelations } from '../../core/models/sortie.model';
import { InscriptionService, InscriptionStatus } from '../../core/services/inscription.service';
import { FavoriService } from '../../core/services/favori.service';
import { FriendshipService } from '../../core/services/friendship.service';
import { ConversationService } from '../../core/services/conversation.service';
import { Friendship } from '../../core/models/friendship.model';
import { ModerationService } from '../../core/services/moderation.service';
import { MemberSafetyComponent } from '../../core/components/member-safety/member-safety.component';
import { isPremiumMember } from '../../core/utils/premium';
import { ClickableDirective } from '../../core/directives/clickable.directive';

type TabKey = 'organisees' | 'rejointes' | 'attente' | 'likees';

@Component({
  selector: 'app-membre-profile',
  standalone: true,
  imports: [ClickableDirective, RouterModule, SortieDrawerComponent, MemberSafetyComponent],
  templateUrl: './membre-profile.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './membre-profile.component.scss',
})
export class MembreProfileComponent implements OnInit {
  private route = inject(ActivatedRoute);
  router = inject(Router);
  private auth = inject(AuthService);
  private profileService = inject(ProfileService);
  private sortieService = inject(SortieService);
  private settingsService = inject(SettingsService);
  private inscriptionService = inject(InscriptionService);
  private favoriService = inject(FavoriService);
  private friendshipService = inject(FriendshipService);
  private conversationService = inject(ConversationService);
  private moderationService = inject(ModerationService);

  readonly profile = signal<Profile | null>(null);
  readonly loading = signal(true);
  readonly accessDenied = signal(false);
  readonly isOwnProfile = signal(false);

  readonly activeTab = signal<TabKey>('organisees');
  readonly viewMode = signal<'grid' | 'list'>('list');
  readonly currentFilters = signal<Filters>({ quickPeriod: 'upcoming' });
  readonly availableThemes = signal<ThemeOption[]>([]);
  readonly availableLocations = signal<string[]>([]);

  readonly sortiesOrganisees = signal<SortieWithRelations[]>([]);
  readonly sortiesRejointes = signal<SortieWithRelations[]>([]);
  readonly sortiesAttente = signal<SortieWithRelations[]>([]);
  readonly sortiesLikees = signal<SortieWithRelations[]>([]);

  readonly lightboxOpen = signal(false);
  readonly bioExpanded = signal(false);

  readonly friendship = signal<Friendship | null>(null);
  readonly friendshipLoading = signal(false);
  /** Le membre connecté a bloqué ce membre. */
  readonly blocked = signal(false);
  readonly friends = signal<Friendship[]>([]);
  readonly selectedSortie = signal<SortieWithRelations | null>(null);
  readonly drawerOpen = signal(false);
  readonly viewerUserId = signal('');
  readonly viewerRole = signal('user');
  readonly viewerIsPremium = signal(false);
  readonly viewerFavoris = signal<Set<string>>(new Set());
  readonly inscriptionStatus = signal<InscriptionStatus>('none');

  tabs: { key: TabKey; label: string; icon: string }[] = [
    { key: 'organisees', label: 'Organisées', icon: '📋' },
    { key: 'rejointes', label: 'Rejointes', icon: '✅' },
    { key: 'attente', label: 'En attente', icon: '⏳' },
    { key: 'likees', label: 'Likées', icon: '❤️' },
  ];

  async ngOnInit() {
    const targetId = this.route.snapshot.paramMap.get('id');
    if (!targetId) {
      this.router.navigate(['/membres']);
      return;
    }

    const {
      data: { user },
    } = await this.auth.getUser();
    if (!user) {
      this.router.navigate(['/login']);
      return;
    }

    this.viewerUserId.set(user.id);
    this.isOwnProfile.set(user.id === targetId);

    const { data: viewerProfile } = await this.profileService.getMyProfile(user.id);
    if (viewerProfile) {
      this.viewerRole.set(viewerProfile.role ?? 'user');
      this.viewerIsPremium.set(isPremiumMember(viewerProfile));
      if (!this.isOwnProfile()) {
        const canView = await this.settingsService.canViewProfiles(viewerProfile);
        if (!canView) {
          this.accessDenied.set(true);
          this.loading.set(false);
          return;
        }
      }
    }

    const favorisIds = await this.favoriService.getFavoris(user.id);
    this.viewerFavoris.set(new Set(favorisIds));

    const [profileRes, organisees, rejointes, attente, likees] = await Promise.all([
      this.profileService.getProfileById(targetId),
      this.sortieService.getSortiesCreatedBy(targetId),
      this.sortieService.getSortiesRejointes(targetId),
      this.sortieService.getSortiesEnAttente(targetId),
      this.sortieService.getSortiesLikees(targetId),
    ]);

    this.profile.set(profileRes.data as Profile);
    this.sortiesOrganisees.set((organisees.data ?? []) as SortieWithRelations[]);
    this.sortiesRejointes.set(rejointes);
    this.sortiesAttente.set(attente);
    this.sortiesLikees.set(likees);

    // Les images et le nombre d’inscrits sont déjà calculés par le service.
    const all = [
      ...this.sortiesOrganisees(),
      ...this.sortiesRejointes(),
      ...this.sortiesAttente(),
      ...this.sortiesLikees(),
    ];
    // Thèmes et villes disponibles
    const themesMap = new Map<string, ThemeOption>();
    const locationsSet = new Set<string>();
    for (const s of all) {
      if (s.theme_id && s.themes)
        themesMap.set(s.theme_id, { id: s.theme_id, name: s.themes.name, icon: s.themes.icon });
      if (s.location) locationsSet.add(s.location);
    }
    this.availableThemes.set([...themesMap.values()]);
    this.availableLocations.set([...locationsSet].sort());

    if (!this.isOwnProfile()) {
      this.blocked.set(await this.moderationService.isBlocked(targetId));
      this.friendship.set(
        await this.friendshipService.getFriendshipStatus(this.viewerUserId(), targetId),
      );
    }
    this.friends.set(await this.friendshipService.getFriends(targetId));

    this.loading.set(false);
  }

  onFiltersChanged(f: Filters) {
    this.currentFilters.set(f);
  }

  private applyFilters(list: SortieWithRelations[]): SortieWithRelations[] {
    const now = new Date();
    const f = this.currentFilters();
    return list.filter((s) => {
      if (f.themeIds?.length && !f.themeIds.includes(s.theme_id ?? '')) return false;
      if (f.ou && s.location !== f.ou) return false;
      if (f.quickPeriod === 'past' && new Date(s.date) >= now) return false;
      if (f.quickPeriod === 'upcoming' && new Date(s.date) < now) return false;
      if (!f.quickPeriod && (f.dateDebut || f.dateFin)) {
        const d = new Date(s.date);
        if (f.dateDebut && d < new Date(f.dateDebut)) return false;
        if (f.dateFin) {
          const fin = new Date(f.dateFin);
          fin.setHours(23, 59, 59);
          if (d > fin) return false;
        }
      }
      if (f.prix === 'gratuit' && s.price > 0) return false;
      if (f.prix === 'payant' && s.price === 0) return false;
      if (f.premium && !s.is_premium) return false;
      return true;
    });
  }

  readonly currentList = computed<SortieWithRelations[]>(() => {
    const base =
      this.activeTab() === 'organisees'
        ? this.sortiesOrganisees()
        : this.activeTab() === 'rejointes'
          ? this.sortiesRejointes()
          : this.activeTab() === 'attente'
            ? this.sortiesAttente()
            : this.sortiesLikees();
    return this.applyFilters(base);
  });

  countFor(tab: TabKey): number {
    const base =
      tab === 'organisees'
        ? this.sortiesOrganisees()
        : tab === 'rejointes'
          ? this.sortiesRejointes()
          : tab === 'attente'
            ? this.sortiesAttente()
            : this.sortiesLikees();
    return this.applyFilters(base).length;
  }

  isPremium(): boolean {
    const end = this.profile()?.subscription_end_date;
    if (!end) return false;
    return new Date(end) > new Date();
  }

  getInitial(username?: string | null): string {
    return (username ?? '').charAt(0).toUpperCase() || '?';
  }

  getAge(): number | null {
    const birthdate = this.profile()?.birthdate;
    if (!birthdate) return null;
    const birth = new Date(birthdate);
    const now = new Date();
    let age = now.getFullYear() - birth.getFullYear();
    const m = now.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
    return age;
  }

  hasExtraInfo(): boolean {
    const p = this.profile();
    return !!(p?.relationship || p?.children || p?.smoking || p?.vaping || p?.alcohol || p?.gender);
  }

  readonly totalSorties = computed<number>(() => {
    return this.sortiesOrganisees().length + this.sortiesRejointes().length;
  });

  formatDate(dateStr: string): string {
    const d = new Date(dateStr);
    const j = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
    return j
      .split(' ')
      .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }

  formatDateCourte(dateStr: string): string {
    const d = new Date(dateStr);
    const j = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
    return j
      .split(' ')
      .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }

  formatHeure(dateStr: string): string {
    return new Date(dateStr).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  }

  goBack() {
    window.history.back();
  }

  readonly friendshipStatus = computed<'none' | 'pending_sent' | 'pending_received' | 'accepted'>(
    () => {
      const friendship = this.friendship();
      if (!friendship) return 'none';
      if (friendship.status === 'accepted') return 'accepted';
      if (friendship.status === 'pending') {
        return friendship.requester_id === this.viewerUserId()
          ? 'pending_sent'
          : 'pending_received';
      }
      return 'none';
    },
  );

  async sendFriendRequest() {
    this.friendshipLoading.set(true);
    const targetId = this.route.snapshot.paramMap.get('id')!;
    await this.friendshipService.sendRequest(this.viewerUserId(), targetId);
    this.friendship.set(
      await this.friendshipService.getFriendshipStatus(this.viewerUserId(), targetId),
    );
    this.friendshipLoading.set(false);
  }

  async acceptFriend() {
    const friendship = this.friendship();
    if (!friendship) return;
    this.friendshipLoading.set(true);
    await this.friendshipService.acceptRequest(friendship.id);
    this.friendship.set({ ...friendship, status: 'accepted' });
    const targetId = this.route.snapshot.paramMap.get('id')!;
    this.friends.set(await this.friendshipService.getFriends(targetId));
    this.friendshipLoading.set(false);
  }

  async declineFriend() {
    const friendship = this.friendship();
    if (!friendship) return;
    this.friendshipLoading.set(true);
    await this.friendshipService.declineRequest(friendship.id);
    this.friendship.set(null);
    this.friendshipLoading.set(false);
  }

  async removeFriend() {
    const friendship = this.friendship();
    if (!friendship) return;
    this.friendshipLoading.set(true);
    await this.friendshipService.removeFriend(friendship.id);
    this.friendship.set(null);
    const targetId = this.route.snapshot.paramMap.get('id')!;
    this.friends.set(await this.friendshipService.getFriends(targetId));
    this.friendshipLoading.set(false);
  }

  async onBlockedChange(blocked: boolean) {
    this.blocked.set(blocked);
    if (!blocked) return;
    // Le blocage supprime l'amitié : on met l'affichage à jour.
    this.friendship.set(null);
    this.friends.set(
      await this.friendshipService.getFriends(this.route.snapshot.paramMap.get('id')!),
    );
  }

  async openChat() {
    const targetId = this.route.snapshot.paramMap.get('id')!;
    const convId = await this.conversationService.getOrCreateConversation(
      this.viewerUserId(),
      targetId,
    );
    this.router.navigate(['/messages', convId], {
      state: {
        friendName: this.profile()?.username,
        friendAvatar: this.profile()?.avatar_url,
        friendId: targetId,
      },
    });
  }

  getFriendProfile(f: Friendship) {
    return this.friendshipService.getFriendProfile(f, this.route.snapshot.paramMap.get('id')!);
  }

  async openDrawer(sortie: SortieWithRelations) {
    this.selectedSortie.set(sortie);
    this.drawerOpen.set(true);
    this.inscriptionStatus.set(
      await this.inscriptionService.getInscriptionStatus(this.viewerUserId(), sortie.id),
    );
  }

  closeDrawer() {
    this.drawerOpen.set(false);
    this.selectedSortie.set(null);
  }

  isFavori(id: string): boolean {
    return this.viewerFavoris().has(id);
  }

  async onFavoriFromDrawer(sortieId: string) {
    const next = new Set(this.viewerFavoris());
    const wasFavori = next.has(sortieId);
    if (wasFavori) next.delete(sortieId);
    else next.add(sortieId);
    this.viewerFavoris.set(next);
    if (wasFavori) await this.favoriService.removeFavori(this.viewerUserId(), sortieId);
    else await this.favoriService.addFavori(this.viewerUserId(), sortieId);
  }

  async onRejoindre(sortieId: string) {
    const { error, status } = await this.inscriptionService.rejoindre(
      this.viewerUserId(),
      sortieId,
    );
    if (!error && status) {
      this.inscriptionStatus.set(
        await this.inscriptionService.getInscriptionStatus(this.viewerUserId(), sortieId),
      );
      await this.refreshInscriptionsCount(sortieId);
    }
  }

  /** Relit le nombre d'inscrits d'une sortie et l'affiche dans les listes et le tiroir. */
  private async refreshInscriptionsCount(sortieId: string) {
    const inscriptionsCount = await this.sortieService.getInscriptionsCount(sortieId);
    const withCount = (s: SortieWithRelations) =>
      s.id === sortieId ? { ...s, inscriptionsCount } : s;
    this.sortiesOrganisees.set(this.sortiesOrganisees().map(withCount));
    this.sortiesRejointes.set(this.sortiesRejointes().map(withCount));
    this.sortiesAttente.set(this.sortiesAttente().map(withCount));
    this.sortiesLikees.set(this.sortiesLikees().map(withCount));
    const selected = this.selectedSortie();
    if (selected) this.selectedSortie.set(withCount(selected));
  }

  async onQuitter(sortieId: string) {
    const { error } = await this.inscriptionService.quitter(this.viewerUserId(), sortieId);
    if (!error) {
      this.inscriptionStatus.set('none');
      await this.refreshInscriptionsCount(sortieId);
    }
  }
}
