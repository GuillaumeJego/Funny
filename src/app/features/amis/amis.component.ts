import {
  Component,
  OnInit,
  ChangeDetectionStrategy,
  inject,
  signal,
  computed,
} from '@angular/core';

import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { FriendshipService } from '../../core/services/friendship.service';
import { ConversationService } from '../../core/services/conversation.service';
import { Friendship } from '../../core/models/friendship.model';
import { ClickableDirective } from '../../core/directives/clickable.directive';

type Tab = 'amis' | 'recues' | 'envoyees';

@Component({
  selector: 'app-amis',
  standalone: true,
  imports: [ClickableDirective, FormsModule],
  templateUrl: './amis.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './amis.component.scss',
})
export class AmisComponent implements OnInit {
  private auth = inject(AuthService);
  private friendshipService = inject(FriendshipService);
  private conversationService = inject(ConversationService);
  router = inject(Router);

  myId = '';
  readonly activeTab = signal<Tab>('amis');
  readonly loading = signal(true);
  readonly search = signal('');

  readonly friends = signal<Friendship[]>([]);
  readonly received = signal<Friendship[]>([]);
  readonly sent = signal<Friendship[]>([]);

  readonly actionLoading = signal<string | null>(null);

  readonly filteredFriends = computed<Friendship[]>(() => {
    const q = this.search().trim().toLowerCase();
    if (!q) return this.friends();
    return this.friends().filter((f) => {
      const p = this.friendshipService.getFriendProfile(f, this.myId);
      return p?.username?.toLowerCase().includes(q);
    });
  });

  async ngOnInit() {
    const {
      data: { user },
    } = await this.auth.getUser();
    if (!user) {
      this.router.navigate(['/login']);
      return;
    }
    this.myId = user.id;
    await this.loadAll();
    this.loading.set(false);
  }

  async loadAll() {
    const [friends, received, sent] = await Promise.all([
      this.friendshipService.getFriends(this.myId),
      this.friendshipService.getPendingReceived(this.myId),
      this.friendshipService.getPendingSent(this.myId),
    ]);
    this.friends.set(friends);
    this.received.set(received);
    this.sent.set(sent);
  }

  getProfile(f: Friendship, role: 'friend' | 'requester' | 'receiver') {
    if (role === 'friend') return this.friendshipService.getFriendProfile(f, this.myId);
    if (role === 'requester') return f.requester;
    return f.receiver;
  }

  getInitial(name?: string | null): string {
    return (name ?? '').charAt(0).toUpperCase() || '?';
  }

  goToProfile(f: Friendship, role: 'friend' | 'requester' | 'receiver') {
    const p = this.getProfile(f, role);
    if (p?.id) this.router.navigate(['/membres', p.id]);
  }

  async openChat(f: Friendship) {
    const p = this.friendshipService.getFriendProfile(f, this.myId);
    if (!p?.id) return;
    const convId = await this.conversationService.getOrCreateConversation(this.myId, p.id);
    this.router.navigate(['/messages', convId], {
      state: { friendName: p.username, friendAvatar: p.avatar_url, friendId: p.id },
    });
  }

  async acceptRequest(f: Friendship) {
    this.actionLoading.set(f.id);
    await this.friendshipService.acceptRequest(f.id);
    await this.loadAll();
    this.actionLoading.set(null);
  }

  async declineRequest(f: Friendship) {
    this.actionLoading.set(f.id);
    await this.friendshipService.declineRequest(f.id);
    await this.loadAll();
    this.actionLoading.set(null);
  }

  async cancelRequest(f: Friendship) {
    this.actionLoading.set(f.id);
    await this.friendshipService.removeFriend(f.id);
    await this.loadAll();
    this.actionLoading.set(null);
  }

  async removeFriend(f: Friendship) {
    this.actionLoading.set(f.id);
    await this.friendshipService.removeFriend(f.id);
    await this.loadAll();
    this.actionLoading.set(null);
  }
}
