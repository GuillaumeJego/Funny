import {
  Component,
  OnDestroy,
  OnInit,
  ChangeDetectionStrategy,
  inject,
  signal,
  computed,
} from '@angular/core';

import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { ConversationService } from '../../core/services/conversation.service';
import { FriendshipService } from '../../core/services/friendship.service';
import { UnreadMessagesService } from '../../core/services/unread-messages.service';
import { Conversation } from '../../core/models/message.model';
import { Friendship } from '../../core/models/friendship.model';
import { ClickableDirective } from '../../core/directives/clickable.directive';

@Component({
  selector: 'app-messages',
  standalone: true,
  imports: [ClickableDirective, FormsModule],
  templateUrl: './messages.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './messages.component.scss',
})
export class MessagesComponent implements OnInit, OnDestroy {
  private auth = inject(AuthService);
  private conversationService = inject(ConversationService);
  private friendshipService = inject(FriendshipService);
  /** Messages non lus par conversation (pastille et texte en gras). */
  readonly unread = inject(UnreadMessagesService).byConversation;
  router = inject(Router);

  readonly conversations = signal<Conversation[]>([]);
  readonly friends = signal<Friendship[]>([]);
  readonly loading = signal(true);
  myId = '';
  readonly search = signal('');
  readonly openingChat = signal(false);
  private stopListening: (() => void) | null = null;
  private destroyed = false;
  private refreshTimer: ReturnType<typeof setTimeout> | undefined;

  async ngOnInit() {
    const {
      data: { user },
    } = await this.auth.getUser();
    if (!user) {
      this.router.navigate(['/login']);
      return;
    }
    this.myId = user.id;
    const [conversations, friends] = await Promise.all([
      this.conversationService.getConversations(user.id),
      this.friendshipService.getFriends(user.id),
    ]);
    this.conversations.set(conversations);
    this.friends.set(friends);
    this.loading.set(false);
    if (this.destroyed) return;

    // Un nouveau message remonte sa conversation en haut de la liste, sans recharger la page.
    this.stopListening = this.conversationService.subscribeToAllMessages(() => {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = setTimeout(async () => {
        this.conversations.set(await this.conversationService.getConversations(this.myId));
      }, 500);
    });
  }

  ngOnDestroy() {
    this.destroyed = true;
    clearTimeout(this.refreshTimer);
    this.stopListening?.();
  }

  readonly filteredFriends = computed<Friendship[]>(() => {
    const q = this.search().trim().toLowerCase();
    if (!q) return [];
    return this.friends().filter((f) => {
      const p = this.friendshipService.getFriendProfile(f, this.myId);
      return p?.username?.toLowerCase().includes(q);
    });
  });

  getFriendProfile(f: Friendship) {
    return this.friendshipService.getFriendProfile(f, this.myId);
  }

  getInitial(name?: string | null): string {
    return name?.charAt(0).toUpperCase() ?? '?';
  }

  async openChatWithFriend(f: Friendship) {
    const p = this.friendshipService.getFriendProfile(f, this.myId);
    if (!p?.id || this.openingChat()) return;
    this.openingChat.set(true);
    const convId = await this.conversationService.getOrCreateConversation(this.myId, p.id);
    this.router.navigate(['/messages', convId], {
      state: { friendName: p.username, friendAvatar: p.avatar_url, friendId: p.id },
    });
  }

  getFriend(conv: Conversation) {
    return conv.participants?.find((p) => p.user_id !== this.myId)?.user ?? null;
  }

  formatTime(dateStr?: string): string {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
    if (diffDays === 0)
      return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    if (diffDays === 1) return 'Hier';
    if (diffDays < 7) return d.toLocaleDateString('fr-FR', { weekday: 'short' });
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
  }

  previewMessage(conv: Conversation): string {
    const msg = conv.last_message;
    if (!msg) return conv.sortie_id ? 'Discussion du groupe' : 'Démarrer la conversation…';
    const body =
      msg.type === 'image' ? '📷 Photo' : msg.type === 'video' ? '🎥 Vidéo' : (msg.content ?? '');
    // Discussion de groupe : on précise qui a écrit.
    if (!conv.sortie_id) return body;
    const who = msg.sender_id === this.myId ? 'Vous' : (msg.sender?.username ?? '');
    return who ? `${who} : ${body}` : body;
  }

  openChat(conv: Conversation) {
    this.router.navigate(['/messages', conv.id]);
  }
}
