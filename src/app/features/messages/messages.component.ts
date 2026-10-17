import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';

import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { ConversationService } from '../../core/services/conversation.service';
import { FriendshipService } from '../../core/services/friendship.service';
import { Conversation } from '../../core/models/message.model';
import { Friendship } from '../../core/models/friendship.model';

@Component({
  selector: 'app-messages',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './messages.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './messages.component.scss',
})
export class MessagesComponent implements OnInit {
  conversations: Conversation[] = [];
  friends: Friendship[] = [];
  loading = true;
  myId = '';
  search = '';
  openingChat = false;

  constructor(
    private auth: AuthService,
    private conversationService: ConversationService,
    private friendshipService: FriendshipService,
    public router: Router,
  ) {}

  async ngOnInit() {
    const {
      data: { user },
    } = await this.auth.getUser();
    if (!user) {
      this.router.navigate(['/login']);
      return;
    }
    this.myId = user.id;
    [this.conversations, this.friends] = await Promise.all([
      this.conversationService.getConversations(user.id),
      this.friendshipService.getFriends(user.id),
    ]);
    this.loading = false;
  }

  get filteredFriends(): Friendship[] {
    const q = this.search.trim().toLowerCase();
    if (!q) return [];
    return this.friends.filter((f) => {
      const p = this.friendshipService.getFriendProfile(f, this.myId);
      return p?.username?.toLowerCase().includes(q);
    });
  }

  getFriendProfile(f: Friendship) {
    return this.friendshipService.getFriendProfile(f, this.myId);
  }

  getInitial(name?: string | null): string {
    return name?.charAt(0).toUpperCase() ?? '?';
  }

  async openChatWithFriend(f: Friendship) {
    const p = this.friendshipService.getFriendProfile(f, this.myId);
    if (!p?.id || this.openingChat) return;
    this.openingChat = true;
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
    if (!msg) return 'Démarrer la conversation…';
    if (msg.type === 'image') return '📷 Photo';
    if (msg.type === 'video') return '🎥 Vidéo';
    return msg.content ?? '';
  }

  openChat(conv: Conversation) {
    this.router.navigate(['/messages', conv.id]);
  }
}
