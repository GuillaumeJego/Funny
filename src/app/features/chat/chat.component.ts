import {
  Component,
  OnInit,
  OnDestroy,
  ElementRef,
  AfterViewChecked,
  NgZone,
  ChangeDetectionStrategy,
  inject,
  viewChild,
  signal,
} from '@angular/core';

import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, NavigationExtras } from '@angular/router';
import { ProfileService } from '../../core/services/profile.service';
import { AuthService } from '../../core/services/auth.service';
import { ConversationService } from '../../core/services/conversation.service';
import { Message } from '../../core/models/message.model';
import { ModerationService } from '../../core/services/moderation.service';
import { MemberSafetyComponent } from '../../core/components/member-safety/member-safety.component';
import { ClickableDirective } from '../../core/directives/clickable.directive';

const EMOJIS = ['❤️', '😂', '😮', '😢', '😡', '👍'];

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [ClickableDirective, FormsModule, MemberSafetyComponent],
  templateUrl: './chat.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './chat.component.scss',
})
export class ChatComponent implements OnInit, OnDestroy, AfterViewChecked {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private auth = inject(AuthService);
  private conversationService = inject(ConversationService);
  private profileService = inject(ProfileService);
  private moderationService = inject(ModerationService);
  private zone = inject(NgZone);

  readonly messagesEnd = viewChild.required<ElementRef>('messagesEnd');
  readonly fileInput = viewChild.required<ElementRef<HTMLInputElement>>('fileInput');

  readonly messages = signal<Message[]>([]);
  readonly loading = signal(true);
  myId = '';
  conversationId = '';
  readonly friendName = signal('');
  readonly friendAvatar = signal<string | null>(null);
  readonly friendId = signal('');
  /** Le membre connecté a bloqué son interlocuteur. */
  readonly blocked = signal(false);
  /** La conversation n'est plus lisible (l'autre membre a bloqué le membre connecté). */
  readonly unavailable = signal(false);

  readonly text = signal('');
  readonly sending = signal(false);
  readonly uploading = signal(false);

  readonly replyTo = signal<Message | null>(null);
  readonly reactionTarget = signal<Message | null>(null);
  readonly reactionPickerPos = signal({ top: 0, left: 0 });
  emojis = EMOJIS;

  private stopListening: (() => void) | null = null;
  private shouldScroll = false;

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
      this.friendName.set(state.friendName);
      this.friendAvatar.set(state.friendAvatar ?? null);
    } else if (state?.friendId) {
      // Sinon : charge le profil de l'ami
      const { data } = await this.profileService.getProfileById(state.friendId);
      this.friendName.set(data?.username ?? '');
      this.friendAvatar.set(data?.avatar_url ?? null);
    }

    this.friendId.set(
      (await this.conversationService.getOtherParticipant(this.conversationId, this.myId)) ?? '',
    );
    if (!this.friendId()) {
      this.unavailable.set(true);
      this.loading.set(false);
      return;
    }
    if (!this.friendName()) {
      const { data } = await this.profileService.getProfileById(this.friendId());
      this.friendName.set(data?.username ?? '');
      this.friendAvatar.set(data?.avatar_url ?? null);
    }
    this.blocked.set(await this.moderationService.isBlocked(this.friendId()));

    await this.loadMessages();
    this.loading.set(false);
    this.shouldScroll = true;

    this.stopListening = this.conversationService.subscribeToMessages(
      this.conversationId,
      (message) => {
        // Ajoute seulement le nouveau message, sans recharger toute la conversation.
        this.zone.run(() => {
          if (this.messages().some((m) => m.id === message.id)) return;
          this.messages.set([...this.messages(), message]);
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
    this.messages.set(await this.conversationService.getMessages(this.conversationId));
  }

  scrollToBottom() {
    try {
      this.messagesEnd()?.nativeElement?.scrollIntoView({ behavior: 'smooth' });
    } catch {}
  }

  isOwn(msg: Message): boolean {
    return msg.sender_id === this.myId;
  }

  async send() {
    const content = this.text().trim();
    if (!content || this.sending()) return;
    this.sending.set(true);
    this.text.set('');
    const replyId = this.replyTo()?.id;
    this.replyTo.set(null);

    const msg = await this.conversationService.sendMessage(
      this.conversationId,
      this.myId,
      content,
      'text',
      replyId,
    );
    if (msg) {
      this.messages.set([...this.messages(), msg]);
      this.shouldScroll = true;
    }
    this.sending.set(false);
  }

  onKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      this.send();
    }
  }

  triggerFileInput(type: 'image' | 'video') {
    const input = this.fileInput().nativeElement;
    input.accept = type === 'image' ? 'image/*' : 'video/*';
    input.click();
  }

  async onFileSelected(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.uploading.set(true);
    const type: 'image' | 'video' = file.type.startsWith('video') ? 'video' : 'image';
    const fileId = await this.conversationService.uploadMedia(file, this.myId, this.conversationId);
    if (fileId) {
      const msg = await this.conversationService.sendMessage(
        this.conversationId,
        this.myId,
        '',
        type,
        this.replyTo()?.id,
        fileId,
      );
      if (msg) {
        this.messages.set([...this.messages(), msg]);
        this.shouldScroll = true;
      }
      this.replyTo.set(null);
    }
    this.uploading.set(false);
    (event.target as HTMLInputElement).value = '';
  }

  openReactionPicker(event: MouseEvent, msg: Message) {
    event.preventDefault();
    event.stopPropagation();
    this.reactionTarget.set(msg);
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    this.reactionPickerPos.set({
      top: rect.top - 60,
      left: Math.min(rect.left, window.innerWidth - 220),
    });
  }

  closeReactionPicker() {
    this.reactionTarget.set(null);
  }

  async react(emoji: string) {
    const msg = this.reactionTarget();
    if (!msg) return;
    const existing = msg.reactions?.find((r) => r.user_id === this.myId);
    await this.conversationService.toggleReaction(msg.id, this.myId, emoji, existing?.emoji);
    const msgs = await this.conversationService.getMessages(this.conversationId);
    this.messages.set(msgs);
    this.reactionTarget.set(null);
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
    this.replyTo.set(msg);
    this.reactionTarget.set(null);
  }

  cancelReply() {
    this.replyTo.set(null);
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
    const prev = new Date(this.messages()[index - 1].created_at).toDateString();
    const curr = new Date(this.messages()[index].created_at).toDateString();
    return prev !== curr;
  }

  goBack() {
    this.router.navigate(['/messages']);
  }
}
