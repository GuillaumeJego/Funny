import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { ConversationService } from '../../core/services/conversation.service';
import { Conversation } from '../../core/models/message.model';

@Component({
  selector: 'app-messages',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './messages.component.html',
  styleUrl: './messages.component.scss'
})
export class MessagesComponent implements OnInit {
  conversations: Conversation[] = [];
  loading = true;
  myId = '';

  constructor(
    private auth: AuthService,
    private conversationService: ConversationService,
    public router: Router
  ) {}

  async ngOnInit() {
    const { data: { user } } = await this.auth.getUser();
    if (!user) { this.router.navigate(['/login']); return; }
    this.myId = user.id;
    this.conversations = await this.conversationService.getConversations(user.id);
    this.loading = false;
  }

  getFriend(conv: Conversation) {
    return conv.participants?.find(p => p.user_id !== this.myId)?.user ?? null;
  }

  formatTime(dateStr?: string): string {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
    if (diffDays === 0) return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
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
