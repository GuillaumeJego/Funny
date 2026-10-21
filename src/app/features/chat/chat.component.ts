import {
  Component,
  OnInit,
  OnDestroy,
  ViewChild,
  ElementRef,
  AfterViewChecked,
  NgZone,
  ChangeDetectionStrategy,
} from '@angular/core';

import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, NavigationExtras } from '@angular/router';
import { ProfileService } from '../../core/services/profile.service';
import { AuthService } from '../../core/services/auth.service';
import { ConversationService } from '../../core/services/conversation.service';
import { Message } from '../../core/models/message.model';
import { ModerationService } from '../../core/services/moderation.service';
import { MemberSafetyComponent } from '../../core/components/member-safety/member-safety.component';

const EMOJIS = ['❤️', '😂', '😮', '😢', '😡', '👍'];

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [FormsModule, MemberSafetyComponent],
  templateUrl: './chat.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './chat.component.scss',
})
export class ChatComponent implements OnInit, OnDestroy, AfterViewChecked {
  @ViewChild('messagesEnd') messagesEnd!: ElementRef;
  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

  messages: Message[] = [];
  loading = true;
  myId = '';
  conversationId = '';
  friendName = '';
  friendAvatar: string | null = null;
  friendId = '';
  /** Le membre connecté a bloqué son interlocuteur. */
  blocked = false;
  /** La conversation n'est plus lisible (l'autre membre a bloqué le membre connecté). */
  unavailable = false;

  text = '';
  sending = false;
  uploading = false;

  replyTo: Message | null = null;
  reactionTarget: Message | null = null;
  reactionPickerPos = { top: 0, left: 0 };
  emojis = EMOJIS;

  private stopListening: (() => void) | null = null;
  private shouldScroll = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private auth: AuthService,
    private conversationService: ConversationService,
    private profileService: ProfileService,
    private moderationService: ModerationService,
    private zone: NgZone,
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

    this.conversationId = this.route.snapshot.paramMap.get('id') ?? '';
    if (!this.conversationId) {
      this.router.navigate(['/messages']);
      return;
    }

    // Récupère le nom/avatar depuis le state de navigation (passé à l'ouverture du chat)
    const nav = this.router.getCurrentNavigation();
    const state = nav?.extras?.state ?? history.state;
    if (state?.friendName) {
      this.friendName = state.friendName;
      this.friendAvatar = state.friendAvatar ?? null;
    } else if (state?.friendId) {
      // Sinon : charge le profil de l'ami
      const { data } = await this.profileService.getProfileById(state.friendId);
      this.friendName = data?.username ?? '';
      this.friendAvatar = data?.avatar_url ?? null;
    }

    this.friendId =
      (await this.conversationService.getOtherParticipant(this.conversationId, this.myId)) ?? '';
    if (!this.friendId) {
      this.unavailable = true;
      this.loading = false;
      return;
    }
    if (!this.friendName) {
      const { data } = await this.profileService.getProfileById(this.friendId);
      this.friendName = data?.username ?? '';
      this.friendAvatar = data?.avatar_url ?? null;
    }
    this.blocked = await this.moderationService.isBlocked(this.friendId);

    await this.loadMessages();
    this.loading = false;
    this.shouldScroll = true;

    this.stopListening = this.conversationService.subscribeToMessages(
      this.conversationId,
      async () => {
        const msgs = await this.conversationService.getMessages(this.conversationId);
        this.zone.run(() => {
          this.messages = msgs;
          this.shouldScroll = true;
        });
      },
    );
  }

  ngAfterViewChecked() {
    if (this.shouldScroll) {
      this.scrollToBottom();
      this.shouldScroll = false;
    }
  }

  ngOnDestroy() {
    this.stopListening?.();
  }

  async loadMessages() {
    this.messages = await this.conversationService.getMessages(this.conversationId);
  }

  scrollToBottom() {
    try {
      this.messagesEnd?.nativeElement?.scrollIntoView({ behavior: 'smooth' });
    } catch {}
  }

  isOwn(msg: Message): boolean {
    return msg.sender_id === this.myId;
  }

  async send() {
    const content = this.text.trim();
    if (!content || this.sending) return;
    this.sending = true;
    this.text = '';
    const replyId = this.replyTo?.id;
    this.replyTo = null;

    const msg = await this.conversationService.sendMessage(
      this.conversationId,
      this.myId,
      content,
      'text',
      replyId,
    );
    if (msg) {
      this.messages = [...this.messages, msg];
      this.shouldScroll = true;
    }
    this.sending = false;
  }

  onKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      this.send();
    }
  }

  triggerFileInput(type: 'image' | 'video') {
    const input = this.fileInput.nativeElement;
    input.accept = type === 'image' ? 'image/*' : 'video/*';
    input.click();
  }

  async onFileSelected(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.uploading = true;
    const type: 'image' | 'video' = file.type.startsWith('video') ? 'video' : 'image';
    const fileId = await this.conversationService.uploadMedia(file, this.myId, this.conversationId);
    if (fileId) {
      const msg = await this.conversationService.sendMessage(
        this.conversationId,
        this.myId,
        '',
        type,
        this.replyTo?.id,
        fileId,
      );
      if (msg) {
        this.messages = [...this.messages, msg];
        this.shouldScroll = true;
      }
      this.replyTo = null;
    }
    this.uploading = false;
    (event.target as HTMLInputElement).value = '';
  }

  openReactionPicker(event: MouseEvent, msg: Message) {
    event.preventDefault();
    event.stopPropagation();
    this.reactionTarget = msg;
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    this.reactionPickerPos = {
      top: rect.top - 60,
      left: Math.min(rect.left, window.innerWidth - 220),
    };
  }

  closeReactionPicker() {
    this.reactionTarget = null;
  }

  async react(emoji: string) {
    if (!this.reactionTarget) return;
    const msg = this.reactionTarget;
    const existing = msg.reactions?.find((r) => r.user_id === this.myId);
    await this.conversationService.toggleReaction(msg.id, this.myId, emoji, existing?.emoji);
    const msgs = await this.conversationService.getMessages(this.conversationId);
    this.messages = msgs;
    this.reactionTarget = null;
  }

  myReaction(msg: Message): string | undefined {
    return msg.reactions?.find((r) => r.user_id === this.myId)?.emoji;
  }

  reactionGroups(msg: Message): { emoji: string; count: number }[] {
    const map = new Map<string, number>();
    for (const r of msg.reactions ?? []) {
      map.set(r.emoji, (map.get(r.emoji) ?? 0) + 1);
    }
    return [...map.entries()].map(([emoji, count]) => ({ emoji, count }));
  }

  setReply(msg: Message) {
    this.replyTo = msg;
    this.reactionTarget = null;
  }

  cancelReply() {
    this.replyTo = null;
  }

  formatTime(dateStr: string): string {
    return new Date(dateStr).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  }

  formatDay(dateStr: string): string {
    const d = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
    if (diffDays === 0) return "Aujourd'hui";
    if (diffDays === 1) return 'Hier';
    return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  }

  showDayDivider(index: number): boolean {
    if (index === 0) return true;
    const prev = new Date(this.messages[index - 1].created_at).toDateString();
    const curr = new Date(this.messages[index].created_at).toDateString();
    return prev !== curr;
  }

  goBack() {
    this.router.navigate(['/messages']);
  }
}
