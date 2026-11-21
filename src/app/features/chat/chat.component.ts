import {
  Component,
  OnInit,
  OnDestroy,
  HostListener,
  ElementRef,
  AfterViewChecked,
  NgZone,
  ChangeDetectionStrategy,
  inject,
  viewChild,
  signal,
} from '@angular/core';

import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, NavigationExtras, RouterLink } from '@angular/router';
import { ProfileService } from '../../core/services/profile.service';
import { AuthService } from '../../core/services/auth.service';
import { UnreadMessagesService } from '../../core/services/unread-messages.service';
import { ConversationService } from '../../core/services/conversation.service';
import {
  EphemeralContent,
  EphemeralView,
  Message,
  MessageType,
} from '../../core/models/message.model';
import { ModerationService } from '../../core/services/moderation.service';
import { MemberSafetyComponent } from '../../core/components/member-safety/member-safety.component';
import { ClickableDirective } from '../../core/directives/clickable.directive';
import { ProfileLinkDirective } from '../../core/directives/profile-link.directive';

const EMOJIS = ['❤️', '😂', '😮', '😢', '😡', '👍'];
/** Nombre de photos ou vidéos envoyées en une fois. */
const MAX_MEDIA = 10;
/** Durée maximale d'un message vocal, en secondes (10 minutes). */
const MAX_VOICE_SECONDS = 600;
/** Formats d'enregistrement essayés dans l'ordre, et l'extension du fichier envoyé. */
const VOICE_FORMATS = [
  { mime: 'audio/webm;codecs=opus', ext: 'webm' },
  { mime: 'audio/webm', ext: 'webm' },
  { mime: 'audio/mp4', ext: 'm4a' },
  { mime: 'audio/ogg;codecs=opus', ext: 'ogg' },
];

interface PendingMedia {
  file: File;
  type: 'image' | 'video';
  /** Adresse locale pour l'aperçu, avant l'envoi. */
  previewUrl: string;
}

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [
    ProfileLinkDirective,
    ClickableDirective,
    FormsModule,
    MemberSafetyComponent,
    RouterLink,
  ],
  templateUrl: './chat.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './chat.component.scss',
})
export class ChatComponent implements OnInit, OnDestroy, AfterViewChecked {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private auth = inject(AuthService);
  private conversationService = inject(ConversationService);
  private unread = inject(UnreadMessagesService);
  private profileService = inject(ProfileService);
  private moderationService = inject(ModerationService);
  private zone = inject(NgZone);

  readonly messagesArea = viewChild<ElementRef<HTMLElement>>('messagesArea');
  /**
   * Rester collé au dernier message : vrai à l'ouverture, faux dès que le membre remonte
   * lire l'historique. Les photos qui finissent de charger ne le font alors pas redescendre.
   */
  private stickToBottom = true;
  /** Premier affichage : on saute directement en bas, sans animation. */
  private firstScroll = true;
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
  /** Discussion de groupe : la sortie concernée (vide pour une conversation à deux). */
  readonly groupSortieId = signal('');
  readonly groupSize = signal(0);
  /** La conversation n'est plus lisible (l'autre membre a bloqué le membre connecté). */
  readonly unavailable = signal(false);

  readonly text = signal('');
  readonly sending = signal(false);
  readonly uploading = signal(false);
  /** Photos et vidéos choisies, pas encore envoyées. */
  readonly pendingMedia = signal<PendingMedia[]>([]);
  /** « 3/10 » pendant l'envoi de plusieurs fichiers. */
  readonly sendProgress = signal('');
  readonly maxMedia = MAX_MEDIA;

  readonly replyTo = signal<Message | null>(null);
  readonly reactionTarget = signal<Message | null>(null);
  readonly reactionPickerPos = signal({ top: 0, left: 0 });
  emojis = EMOJIS;

  /** Photo affichée en grand (adresse de l'image), ou null. */
  readonly lightboxUrl = signal<string | null>(null);

  /** Mode « voir une fois » : le prochain envoi (texte, photos, vidéos) est éphémère. */
  readonly ephemeralMode = signal(false);
  /** Message éphémère ouvert, affiché en plein écran une seule fois. */
  readonly ephemeralShown = signal<EphemeralContent | null>(null);
  private ephemeralShownId = '';
  /** Message éphémère en cours d'ouverture ou de demande (bouton désactivé). */
  readonly ephemeralBusy = signal('');

  // ── Message vocal ──
  readonly recording = signal(false);
  /** Secondes enregistrées. */
  readonly recordSeconds = signal(0);
  readonly maxVoiceSeconds = MAX_VOICE_SECONDS;
  private recorder: MediaRecorder | null = null;
  private recordTimer: ReturnType<typeof setInterval> | null = null;
  /** Le vocal part à l'arrêt de l'enregistrement (faux : « Annuler »). */
  private sendVoiceOnStop = false;

  // ── Modifier et supprimer ses messages ──
  /** Message en cours de modification (son texte est dans la zone de saisie). */
  readonly editing = signal<Message | null>(null);
  /** Le sélecteur demande de confirmer la suppression. */
  readonly confirmDelete = signal(false);
  /** Jusqu'où chaque autre participant a lu la conversation. */
  private readonly readStates = signal(new Map<string, string>());

  /** Message qui n'a pas pu partir : affiché sous la zone de saisie. */
  readonly sendError = signal('');

  private stopListening: (() => void) | null = null;
  private stopReactions: (() => void) | null = null;
  private stopViews: (() => void) | null = null;
  private stopUpdates: (() => void) | null = null;
  private stopReads: (() => void) | null = null;
  private destroyed = false;
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

    // Discussion de groupe d'une sortie, ou conversation entre deux amis ?
    const conversation = await this.conversationService.getConversation(this.conversationId);
    if (conversation?.sortie_id) {
      this.groupSortieId.set(conversation.sortie_id);
      this.friendName.set(conversation.sortie_title ?? 'Sortie');
      this.friendAvatar.set(conversation.sortie_image ?? null);
      this.groupSize.set(conversation.participants?.length ?? 0);
    } else if (!(await this.loadFriend())) {
      this.unavailable.set(true);
      this.loading.set(false);
      return;
    }

    if (this.destroyed) return;

    // On écoute avant de charger : un message envoyé pendant le chargement n'est pas perdu.
    this.stopListening = this.conversationService.subscribeToMessages(
      this.conversationId,
      (message) => this.zone.run(() => this.addMessages([message])),
    );
    this.stopReactions = this.conversationService.subscribeToReactions(
      this.conversationId,
      (messageId) => this.zone.run(() => this.refreshReactions(messageId)),
    );
    this.stopViews = this.conversationService.subscribeToEphemeralViews(
      this.conversationId,
      (messageId) => this.zone.run(() => this.refreshViews(messageId)),
    );

    this.stopUpdates = this.conversationService.subscribeToMessageUpdates(
      this.conversationId,
      (message) => this.zone.run(() => this.applyUpdate(message)),
    );
    this.stopReads = this.conversationService.subscribeToReads(this.conversationId, (read) =>
      this.zone.run(() => this.setRead(read.user_id, read.last_read_at)),
    );

    const [, reads] = await Promise.all([
      this.loadMessages(),
      this.conversationService.getReadStates(this.conversationId),
    ]);
    for (const read of reads) this.setRead(read.user_id, read.last_read_at);
    this.loading.set(false);
    this.shouldScroll = true;
    // La conversation est lue : le badge « Messages » se met à jour.
    this.unread.opened(this.conversationId, this.myId);
  }

  /** Conversation à deux : l'ami, sa photo, et s'il est bloqué. Faux si elle n'est plus lisible. */
  private async loadFriend(): Promise<boolean> {
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
    if (!this.friendId()) return false;
    if (!this.friendName()) {
      const { data } = await this.profileService.getProfileById(this.friendId());
      this.friendName.set(data?.username ?? '');
      this.friendAvatar.set(data?.avatar_url ?? null);
    }
    this.blocked.set(await this.moderationService.isBlocked(this.friendId()));
    return true;
  }

  /**
   * Ajoute des messages sans doublon, dans l'ordre d'envoi. Un même message peut arriver
   * deux fois : par la réponse du serveur à l'envoi, et par le temps réel.
   */
  private addMessages(messages: Message[]) {
    const known = new Set(this.messages().map((m) => m.id));
    const fresh = messages.filter((m) => !known.has(m.id));
    if (!fresh.length) return;
    this.messages.set(
      [...this.messages(), ...fresh].sort((a, b) => a.created_at.localeCompare(b.created_at)),
    );
    this.shouldScroll = true;
  }

  /** Relit les réactions d'un seul message (après un ajout ou un retrait, chez soi ou chez l'autre). */
  private async refreshReactions(messageId: string) {
    if (!this.messages().some((m) => m.id === messageId)) return;
    const reactions = await this.conversationService.getReactions(messageId);
    this.messages.update((list) => list.map((m) => (m.id === messageId ? { ...m, reactions } : m)));
  }

  /** Un message a été modifié ou supprimé (par soi, ou en direct par son auteur). */
  private applyUpdate(updated: Message) {
    this.messages.update((list) =>
      list.map((m) => {
        if (m.id === updated.id) {
          return { ...updated, reactions: m.reactions, views: m.views, reply_to: m.reply_to };
        }
        // Les réponses à ce message montrent aussi le nouveau texte.
        if (m.reply_to?.id === updated.id) {
          return {
            ...m,
            reply_to: {
              ...m.reply_to,
              content: updated.deleted ? 'Message supprimé' : updated.content,
              type: updated.deleted ? 'text' : updated.type,
            },
          };
        }
        return m;
      }),
    );
    if (this.editing()?.id === updated.id && updated.deleted) this.cancelEdit();
  }

  private setRead(userId: string, lastReadAt: string) {
    if (userId === this.myId) return;
    const current = this.readStates().get(userId);
    if (current && current >= lastReadAt) return;
    this.readStates.update((map) => new Map(map).set(userId, lastReadAt));
  }

  /** Un autre participant a ouvert la conversation depuis l'envoi du message. */
  private readByOthers(msg: Message): boolean {
    return [...this.readStates().values()].some((at) => at >= msg.created_at);
  }

  /** Son propre texte, tant que personne d'autre ne l'a lu. */
  canEdit(msg: Message): boolean {
    return (
      this.isOwn(msg) &&
      msg.type === 'text' &&
      !msg.ephemeral &&
      !msg.deleted &&
      !this.readByOthers(msg)
    );
  }

  startEdit(msg: Message) {
    this.reactionTarget.set(null);
    this.replyTo.set(null);
    this.ephemeralMode.set(false);
    this.sendError.set('');
    this.editing.set(msg);
    this.text.set(msg.content ?? '');
  }

  cancelEdit() {
    this.editing.set(null);
    this.text.set('');
  }

  private async saveEdit(msg: Message) {
    const content = this.text().trim();
    if (!content || this.sending()) return;
    if (content === msg.content) {
      this.cancelEdit();
      return;
    }
    this.sending.set(true);
    this.sendError.set('');
    const error = await this.conversationService.editMessage(msg.id, content);
    this.sending.set(false);
    if (error) {
      this.sendError.set(error);
      return;
    }
    this.applyUpdate({ ...msg, content, edited_at: new Date().toISOString() });
    this.cancelEdit();
  }

  askDelete() {
    this.confirmDelete.set(true);
  }

  async deleteMessage() {
    const msg = this.reactionTarget();
    if (!msg) return;
    this.reactionTarget.set(null);
    this.confirmDelete.set(false);
    this.sendError.set('');
    const error = await this.conversationService.deleteMessage(msg.id);
    if (error) {
      this.sendError.set(error);
      return;
    }
    this.applyUpdate({ ...msg, content: null, media_url: null, deleted: true });
    if (this.replyTo()?.id === msg.id) this.replyTo.set(null);
  }

  // ── Messages vocaux ─────────────────────────

  /** Enregistre au micro ; s'arrête tout seul au bout de 10 minutes. */
  async startRecording() {
    if (this.recording() || this.sending()) return;
    this.sendError.set('');
    const format = VOICE_FORMATS.find(
      (f) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(f.mime),
    );
    if (!format || !navigator.mediaDevices?.getUserMedia) {
      this.sendError.set('Ton navigateur ne permet pas d’enregistrer un vocal.');
      return;
    }
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      this.sendError.set('Autorise le micro pour enregistrer un vocal.');
      return;
    }
    const chunks: Blob[] = [];
    const recorder = new MediaRecorder(stream, {
      mimeType: format.mime,
      audioBitsPerSecond: 32000,
    });
    recorder.ondataavailable = (e) => {
      if (e.data.size) chunks.push(e.data);
    };
    recorder.onstop = () =>
      this.zone.run(() => {
        stream.getTracks().forEach((t) => t.stop());
        const seconds = this.recordSeconds();
        this.recording.set(false);
        this.recorder = null;
        if (this.sendVoiceOnStop && chunks.length && !this.destroyed) {
          const type = format.mime.split(';')[0];
          const file = new File(chunks, `vocal-${Date.now()}.${format.ext}`, { type });
          this.sendVoice(file, seconds);
        }
      });
    this.recorder = recorder;
    this.sendVoiceOnStop = false;
    this.recordSeconds.set(0);
    this.recording.set(true);
    recorder.start(1000);
    this.recordTimer = setInterval(() => {
      this.recordSeconds.update((s) => s + 1);
      if (this.recordSeconds() >= MAX_VOICE_SECONDS) this.stopRecording(true);
    }, 1000);
  }

  /** Arrête l'enregistrement : « Envoyer » (true) ou « Annuler » (false). */
  stopRecording(send: boolean) {
    if (this.recordTimer) clearInterval(this.recordTimer);
    this.recordTimer = null;
    this.sendVoiceOnStop = send;
    if (this.recorder?.state === 'recording') this.recorder.stop();
    else this.recording.set(false);
  }

  private async sendVoice(file: File, seconds: number) {
    this.sending.set(true);
    this.uploading.set(true);
    const ephemeral = this.ephemeralMode();
    const replyTo = ephemeral ? null : this.replyTo();
    const fileId = await this.conversationService.uploadMedia(
      file,
      this.myId,
      this.conversationId,
      ephemeral,
    );
    let msg: Message | null = null;
    if (fileId) {
      msg = ephemeral
        ? await this.sendEphemeral('audio', null, fileId)
        : await this.conversationService.sendMessage(
            this.conversationId,
            this.myId,
            this.formatDuration(seconds),
            'audio',
            replyTo?.id,
            fileId,
          );
    }
    this.uploading.set(false);
    this.sending.set(false);
    if (!msg) {
      this.sendError.set(
        `Le vocal n'est pas parti${this.ephemeralError ? ` (${this.ephemeralError})` : ''}. Vérifie ta connexion et réessaie.`,
      );
      this.ephemeralError = '';
      return;
    }
    this.addMessages([msg]);
    if (!ephemeral) this.replyTo.set(null);
    else this.ephemeralMode.set(false);
  }

  /** 75 → « 1:15 ». */
  formatDuration(seconds: number): string {
    const s = Math.max(0, Math.floor(seconds));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }

  /**
   * Les vocaux enregistrés par Chrome n'annoncent pas leur durée : on la fait calculer au
   * navigateur (en sautant à la fin puis en revenant au début) pour que la barre soit juste.
   */
  fixAudioDuration(event: Event) {
    const audio = event.target as HTMLAudioElement;
    if (audio.duration !== Infinity) return;
    audio.ontimeupdate = () => {
      audio.ontimeupdate = null;
      audio.currentTime = 0;
    };
    audio.currentTime = 1e101;
  }

  /** Relit les vues d'un message éphémère (ouverture, demande, réponse). */
  private async refreshViews(messageId: string) {
    if (!this.messages().some((m) => m.id === messageId)) return;
    const views = await this.conversationService.getEphemeralViews(messageId);
    this.messages.update((list) => list.map((m) => (m.id === messageId ? { ...m, views } : m)));
  }

  // ── Messages éphémères ──────────────────────

  toggleEphemeral() {
    this.ephemeralMode.update((on) => !on);
  }

  /** Ma vue d'un message éphémère reçu (aucune ligne = jamais ouvert). */
  myView(msg: Message): EphemeralView {
    return (
      msg.views?.find((v) => v.user_id === this.myId) ?? {
        user_id: this.myId,
        seen: 0,
        allowed: 1,
        request: null,
      }
    );
  }

  canOpen(msg: Message): boolean {
    const view = this.myView(msg);
    return view.seen < view.allowed;
  }

  /** « Vu par Bob, Zoé » pour l'expéditeur. */
  seenBy(msg: Message): string {
    const names = (msg.views ?? []).filter((v) => v.seen > 0).map((v) => v.username ?? '?');
    if (!names.length) return 'Pas encore vu';
    return this.groupSortieId() ? `Vu par ${names.join(', ')}` : 'Vu ✓';
  }

  pendingRequests(msg: Message): EphemeralView[] {
    return (msg.views ?? []).filter((v) => v.request === 'pending');
  }

  ephemeralLabel(msg: Message): string {
    if (msg.type === 'audio') return 'Vocal éphémère';
    return msg.type === 'image'
      ? 'Photo éphémère'
      : msg.type === 'video'
        ? 'Vidéo éphémère'
        : 'Message éphémère';
  }

  async openEphemeral(event: Event, msg: Message) {
    event.stopPropagation();
    if (this.ephemeralBusy()) return;
    this.ephemeralBusy.set(msg.id);
    this.sendError.set('');
    const { data, error } = await this.conversationService.openEphemeral(msg.id);
    this.ephemeralBusy.set('');
    if (error || !data) {
      this.sendError.set(error ?? 'Impossible d’ouvrir ce message.');
      await this.refreshViews(msg.id);
      return;
    }
    this.ephemeralShownId = msg.id;
    this.ephemeralShown.set(data);
  }

  /** Fermé : le contenu disparaît de l'écran et de la mémoire du téléphone. */
  closeEphemeral() {
    const shown = this.ephemeralShown();
    if (shown?.url) URL.revokeObjectURL(shown.url);
    this.ephemeralShown.set(null);
    if (this.ephemeralShownId) this.refreshViews(this.ephemeralShownId);
    this.ephemeralShownId = '';
  }

  async askToSeeAgain(event: Event, msg: Message) {
    event.stopPropagation();
    this.ephemeralBusy.set(msg.id);
    const error = await this.conversationService.askToSeeAgain(msg.id);
    this.ephemeralBusy.set('');
    if (error) this.sendError.set(error);
    await this.refreshViews(msg.id);
  }

  async answerSeeAgain(event: Event, msg: Message, memberId: string, accept: boolean) {
    event.stopPropagation();
    this.ephemeralBusy.set(msg.id);
    const error = await this.conversationService.answerSeeAgain(msg.id, memberId, accept);
    this.ephemeralBusy.set('');
    if (error) this.sendError.set(error);
    await this.refreshViews(msg.id);
  }

  ngAfterViewChecked() {
    if (this.shouldScroll) {
      this.scrollToBottom();
      this.shouldScroll = false;
    }
  }

  ngOnDestroy() {
    this.destroyed = true;
    this.stopListening?.();
    this.stopReactions?.();
    this.stopViews?.();
    this.stopUpdates?.();
    this.stopReads?.();
    if (this.recording()) this.stopRecording(false);
    this.closeEphemeral();
    if (this.conversationId && this.myId) this.unread.closed(this.conversationId, this.myId);
    for (const media of this.pendingMedia()) URL.revokeObjectURL(media.previewUrl);
  }

  async loadMessages() {
    const loaded = await this.conversationService.getMessages(this.conversationId);
    // Garde les messages arrivés en direct pendant le chargement.
    const live = this.messages();
    this.messages.set(loaded);
    this.addMessages(live);
  }

  openLightbox(event: Event, url: string) {
    // Toucher la photo l'agrandit, au lieu d'ouvrir le choix des réactions.
    event.stopPropagation();
    this.reactionTarget.set(null);
    this.lightboxUrl.set(url);
  }

  @HostListener('document:keydown.escape')
  closeLightbox() {
    if (this.ephemeralShown()) this.closeEphemeral();
    this.lightboxUrl.set(null);
  }

  scrollToBottom() {
    const area = this.messagesArea()?.nativeElement;
    if (!area) return;
    this.stickToBottom = true;
    area.scrollTo({ top: area.scrollHeight, behavior: this.firstScroll ? 'auto' : 'smooth' });
    this.firstScroll = false;
  }

  onMessagesScroll() {
    const area = this.messagesArea()?.nativeElement;
    if (!area) return;
    this.stickToBottom = area.scrollHeight - area.scrollTop - area.clientHeight < 80;
  }

  /** Une photo ou une vidéo a pris sa taille : on reste sur le dernier message. */
  mediaLoaded() {
    const area = this.messagesArea()?.nativeElement;
    if (area && this.stickToBottom) area.scrollTop = area.scrollHeight;
  }

  isOwn(msg: Message): boolean {
    return msg.sender_id === this.myId;
  }

  /** Envoie les photos et vidéos choisies (dans l'ordre), puis le texte. */
  async send() {
    const edited = this.editing();
    if (edited) return this.saveEdit(edited);
    const content = this.text().trim();
    const files = this.pendingMedia();
    if ((!content && !files.length) || this.sending()) return;
    this.sending.set(true);
    this.sendError.set('');
    const ephemeral = this.ephemeralMode();
    // Un message éphémère ne cite pas d'autre message.
    let replyTo = ephemeral ? null : this.replyTo();
    if (!ephemeral) this.replyTo.set(null);

    // Photos et vidéos : une par message, celles qui échouent restent prêtes à renvoyer.
    const failed: PendingMedia[] = [];
    this.uploading.set(files.length > 0);
    for (const [index, media] of files.entries()) {
      this.sendProgress.set(files.length > 1 ? `${index + 1}/${files.length}` : '');
      const msg = await this.sendMedia(media, replyTo?.id, ephemeral);
      if (msg) {
        this.addMessages([msg]);
        URL.revokeObjectURL(media.previewUrl);
        replyTo = null; // seule la première pièce jointe répond au message cité
      } else {
        failed.push(media);
      }
    }
    this.pendingMedia.set(failed);
    this.sendProgress.set('');
    this.uploading.set(false);

    if (content && !failed.length) {
      this.text.set('');
      const msg = ephemeral
        ? await this.sendEphemeral('text', content, null)
        : await this.conversationService.sendMessage(
            this.conversationId,
            this.myId,
            content,
            'text',
            replyTo?.id,
          );
      if (msg) {
        this.addMessages([msg]);
        replyTo = null;
      } else if (!this.text()) {
        // Rien n'est perdu : le texte revient dans la zone de saisie pour réessayer.
        this.text.set(content);
      }
      if (!msg) this.sendError.set("Le message n'est pas parti. Vérifie ta connexion et réessaie.");
    }
    if (failed.length) {
      this.sendError.set(
        `${failed.length} fichier(s) n'ont pas pu partir${this.ephemeralError ? ` (${this.ephemeralError})` : ''}. Touche « Envoyer » pour réessayer.`,
      );
    }
    this.ephemeralError = '';
    if (replyTo) this.replyTo.set(replyTo);
    // Le mode éphémère vaut pour un envoi : on revient au mode normal ensuite.
    if (ephemeral && !failed.length && !this.text()) this.ephemeralMode.set(false);
    this.sending.set(false);
  }

  /** Envoi éphémère : en cas d'échec, la raison donnée par le serveur s'affiche. */
  private async sendEphemeral(
    type: MessageType,
    content: string | null,
    fileId: string | null,
  ): Promise<Message | null> {
    const { data, error } = await this.conversationService.sendEphemeral(
      this.conversationId,
      type,
      content,
      fileId,
    );
    if (error) this.ephemeralError = error;
    return data;
  }
  private ephemeralError = '';

  private async sendMedia(
    media: PendingMedia,
    replyToId?: string,
    ephemeral = false,
  ): Promise<Message | null> {
    const fileId = await this.conversationService.uploadMedia(
      media.file,
      this.myId,
      this.conversationId,
      ephemeral,
    );
    if (!fileId) return null;
    if (ephemeral) return this.sendEphemeral(media.type, null, fileId);
    return this.conversationService.sendMessage(
      this.conversationId,
      this.myId,
      '',
      media.type,
      replyToId,
      fileId,
    );
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

  /** Fichiers choisis : ils s'affichent en aperçu et partent au clic sur « Envoyer ». */
  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const chosen = Array.from(input.files ?? []);
    input.value = '';
    if (!chosen.length) return;
    this.sendError.set('');
    const room = MAX_MEDIA - this.pendingMedia().length;
    if (chosen.length > room) {
      this.sendError.set(`${MAX_MEDIA} photos ou vidéos au maximum à la fois.`);
    }
    const added = chosen.slice(0, Math.max(0, room)).map((file) => ({
      file,
      type: (file.type.startsWith('video') ? 'video' : 'image') as 'image' | 'video',
      previewUrl: URL.createObjectURL(file),
    }));
    this.pendingMedia.update((list) => [...list, ...added]);
  }

  removePendingMedia(media: PendingMedia) {
    URL.revokeObjectURL(media.previewUrl);
    this.pendingMedia.update((list) => list.filter((m) => m !== media));
  }

  openReactionPicker(event: MouseEvent, msg: Message) {
    event.preventDefault();
    event.stopPropagation();
    // Un message supprimé ne se commente plus.
    if (msg.deleted) return;
    this.reactionTarget.set(msg);
    this.confirmDelete.set(false);
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    // Ses propres messages ont aussi « Modifier » et « Supprimer », sur une deuxième ligne.
    this.reactionPickerPos.set({
      top: Math.max(8, rect.top - (this.isOwn(msg) ? 104 : 60)),
      left: Math.max(8, Math.min(rect.left, window.innerWidth - 310)),
    });
  }

  closeReactionPicker() {
    this.reactionTarget.set(null);
    this.confirmDelete.set(false);
  }

  /** Ajoute, change ou retire sa réaction : depuis le sélecteur, ou en touchant une réaction. */
  async react(emoji: string, target?: Message) {
    const msg = target ?? this.reactionTarget();
    if (!msg) return;
    this.reactionTarget.set(null);
    const existing = msg.reactions?.find((r) => r.user_id === this.myId);
    await this.conversationService.toggleReaction(msg.id, this.myId, emoji, existing?.emoji);
    await this.refreshReactions(msg.id);
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
    if (msg.deleted) return;
    if (this.editing()) this.cancelEdit();
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
