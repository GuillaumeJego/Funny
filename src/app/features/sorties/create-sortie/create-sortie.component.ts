import {
  Component,
  OnInit,
  OnDestroy,
  ChangeDetectionStrategy,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, Subscription, firstValueFrom } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';
import { GeoService, GeoFullPlace } from '../../../core/services/geo.service';
import { AuthService } from '../../../core/services/auth.service';
import { ProfileService } from '../../../core/services/profile.service';
import { SettingsService } from '../../../core/services/settings.service';
import { SortieService } from '../../../core/services/sortie.service';
import { ThemeService } from '../../../core/services/theme.service';
import { OTHER_THEME_ID, Theme, ThemeImage } from '../../../core/models/theme.model';
import { Profile } from '../../../core/models/profile.model';
import { Sortie } from '../../../core/models/sortie.model';
import { SortieImageUploadComponent } from '../sortie-image-upload/sortie-image-upload.component';
import { isPremiumMember } from '../../../core/utils/premium';
import { ClickableDirective } from '../../../core/directives/clickable.directive';

@Component({
  selector: 'app-create-sortie',
  standalone: true,
  imports: [ClickableDirective, CommonModule, FormsModule, SortieImageUploadComponent],
  templateUrl: './create-sortie.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './create-sortie.component.scss',
})
export class CreateSortieComponent implements OnInit, OnDestroy {
  private authService = inject(AuthService);
  private sortieService = inject(SortieService);
  private themeService = inject(ThemeService);
  router = inject(Router);
  private route = inject(ActivatedRoute);
  private geo = inject(GeoService);
  private profileService = inject(ProfileService);
  private settingsService = inject(SettingsService);

  readonly themes = signal<Theme[]>([]);
  readonly themeImages = signal<ThemeImage[]>([]);
  userId = '';
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly errorMessage = signal('');
  readonly successMessage = signal('');

  /** Identifiant de la sortie en cours de modification (vide pour une création). */
  readonly editId = signal('');

  /** Formulaire lié par ngModel : ses champs changent sur place, à chaque saisie. */
  sortie: Partial<Sortie> = {
    title: '',
    description: '',
    theme_id: '',
    date: '',
    location: '',
    price: 0,
    max_participants: undefined,
    is_premium: false,
    image_url: '',
    image_source: 'default',
    status: 'published',
  };

  readonly selectedImageUrl = signal('');
  customImageFile: File | null = null;
  readonly customImagePreview = signal('');

  // Autocomplete lieu
  readonly locationQuery = signal('');
  readonly locationSuggestions = signal<GeoFullPlace[]>([]);
  readonly locationSearching = signal(false);
  private locationSearch$ = new Subject<string>();
  private locationSub!: Subscription;

  readonly accessDenied = signal(false);
  /** Seuls les abonnés (et les admins) peuvent réserver une sortie aux abonnés. */
  readonly canCreatePremium = signal(false);

  /** Thème « Autre » : nom libre et photo obligatoire. */
  readonly otherTheme = OTHER_THEME_ID;
  /** Organisateur non abonné : 10 places au plus (null = pas de limite). */
  static readonly FREE_PLACES = 10;
  readonly placesCap = signal<number | null>(null);

  // Invitations (sortie réservée aux abonnés)
  private readonly allMembers = signal<Profile[]>([]);
  private membersLoaded = false;
  readonly inviteQuery = signal('');
  readonly invitees = signal<Profile[]>([]);
  /** Modification : membres déjà invités, inscrits ou en attente (à ne pas réinviter). */
  private readonly involvedIds = signal<Set<string>>(new Set());
  readonly alreadyInvited = signal<{ id: string; username: string }[]>([]);
  /** Places déjà prises (toi compris, et les invités qui n'ont pas répondu). */
  private takenPlaces = 1;

  async ngOnInit() {
    const {
      data: { user },
    } = await this.authService.getUser();
    if (!user) {
      this.router.navigate(['/login']);
      return;
    }
    this.userId = user.id;

    const { data: profile } = await this.profileService.getMyProfile(user.id);
    this.canCreatePremium.set(isPremiumMember(profile));
    if (!isPremiumMember(profile)) this.placesCap.set(CreateSortieComponent.FREE_PLACES);
    this.editId.set(this.route.snapshot.paramMap.get('id') ?? '');
    if (this.editId()) {
      const isAdmin = profile?.role === 'admin' || profile?.role === 'developer';
      if (!(await this.loadSortieToEdit(this.editId(), isAdmin))) return;
    } else if (profile) {
      const canCreate = await this.settingsService.canCreateSortie(profile);
      if (!canCreate) {
        this.accessDenied.set(true);
        return;
      }
    }

    const { data: themes } = await this.themeService.getAllThemes();
    if (themes) this.themes.set(themes);

    this.locationSub = this.locationSearch$
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        switchMap((q) => {
          this.locationSearching.set(true);
          return this.geo.searchPlaces(q);
        }),
      )
      .subscribe((places) => {
        this.locationSuggestions.set(places);
        this.locationSearching.set(false);
      });
  }

  ngOnDestroy() {
    this.locationSub?.unsubscribe();
  }

  /** Remplit le formulaire avec la sortie à modifier ; false si elle n'est pas modifiable. */
  private async loadSortieToEdit(id: string, isAdmin: boolean): Promise<boolean> {
    const sortie = await this.sortieService.getSortie(id);
    if (!sortie || (sortie.created_by !== this.userId && !isAdmin)) {
      this.router.navigate(['/mes-sorties']);
      return false;
    }
    this.sortie = {
      title: sortie.title,
      description: sortie.description ?? '',
      theme_id: sortie.theme_id,
      theme_custom: sortie.theme_custom ?? '',
      // Le serveur garde l'heure universelle : on la remet à l'heure du téléphone (Paris…).
      date: toLocalInput(sortie.date),
      location: sortie.location,
      price: sortie.price,
      max_participants: sortie.max_participants ?? undefined,
      is_premium: sortie.is_premium,
      image_url: sortie.image_url ?? '',
      image_source: sortie.image_source,
      lat: sortie.lat ?? null,
      lng: sortie.lng ?? null,
    };
    this.dateDay = this.sortie.date!.slice(0, 10);
    this.dateHour = this.sortie.date!.slice(11, 16);
    // Une sortie déjà Premium peut le rester, même si l'abonnement de l'organisateur a pris fin.
    if (sortie.is_premium) this.canCreatePremium.set(true);
    // Le statut comptait à la création : la sortie garde ses places (jamais moins de 10).
    if (this.placesCap() !== null) {
      this.placesCap.set(
        sortie.max_participants == null
          ? null
          : Math.max(CreateSortieComponent.FREE_PLACES, sortie.max_participants),
      );
    }
    this.takenPlaces = sortie.inscriptionsCount ?? 1;
    if (sortie.is_premium) await this.loadInvolved(id);
    this.locationQuery.set(sortie.location);
    const { data } = await this.themeService.getThemeImages(sortie.theme_id);
    this.themeImages.set(data ?? []);
    if (sortie.image_source === 'custom') this.customImagePreview.set(sortie.image_url ?? '');
    else this.selectedImageUrl.set(sortie.resolvedImageUrl ?? '');
    return true;
  }

  onLocationInput() {
    this.locationSearch$.next(this.locationQuery());
  }

  selectLocation(place: GeoFullPlace) {
    // On stocke le nom court (ex: "Le Marais", "Paris") + adresse si disponible
    const label = place.address ? `${place.shortName}, ${place.address}` : place.shortName;
    this.sortie.location = label;
    this.sortie.lat = place.lat;
    this.sortie.lng = place.lng;
    this.locationQuery.set(place.shortName);
    this.locationSuggestions.set([]);
  }

  clearLocation() {
    this.sortie.location = '';
    this.sortie.lat = null;
    this.sortie.lng = null;
    this.locationQuery.set('');
    this.locationSuggestions.set([]);
  }

  async onThemeSelected() {
    if (!this.sortie.theme_id) return;
    if (this.isOtherTheme()) {
      // Pas d'images toutes prêtes : la photo de l'organisateur est obligatoire.
      this.themeImages.set([]);
      this.selectedImageUrl.set('');
      if (this.sortie.image_source !== 'custom') this.sortie.image_url = '';
      return;
    }
    const { data } = await this.themeService.getThemeImages(this.sortie.theme_id);
    this.themeImages.set(data ?? []);
    this.selectedImageUrl.set('');
    // La première image du thème est choisie d'office ; l'organisateur peut en changer.
    if (this.themeImages().length && !this.customImageFile) {
      this.selectDefaultImage(this.themeImages()[0].image_url);
    }
  }

  selectDefaultImage(imageUrl: string) {
    this.selectedImageUrl.set(imageUrl);
    this.sortie.image_url = imageUrl;
    this.sortie.image_source = 'default';
    this.customImagePreview.set('');
  }

  /** Jour (2026-11-20) et heure (19:30) choisis dans les deux champs séparés. */
  dateDay = '';
  dateHour = '';
  /** On ne propose pas de date passée. */
  readonly today = new Date(Date.now() - new Date().getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 10);

  /** Recompose « 2026-11-20T19:30 » dès que le jour et l'heure sont choisis. */
  syncDate() {
    this.sortie.date = this.dateDay && this.dateHour ? `${this.dateDay}T${this.dateHour}` : '';
  }

  isOtherTheme(): boolean {
    return this.sortie.theme_id === OTHER_THEME_ID;
  }

  /** Nombre de places saisi (null = vide). */
  private places(): number | null {
    const value = this.sortie.max_participants as number | string | null | undefined;
    return value === null || value === undefined || value === '' ? null : Number(value);
  }

  /** Plus de places que permis sans abonnement. */
  overCap(): boolean {
    const cap = this.placesCap();
    const places = this.places();
    return cap !== null && places !== null && places > cap;
  }

  // ── Invitations ─────────────────────────────

  /** Membres déjà concernés par la sortie modifiée : on ne les propose pas à nouveau. */
  private async loadInvolved(sortieId: string) {
    const [inscrits, waiting, invited] = await Promise.all([
      this.sortieService.getMembresInscrits(sortieId),
      this.sortieService.getMembresWaiting(sortieId),
      this.sortieService.getMembresInvites(sortieId),
    ]);
    this.involvedIds.set(new Set([...inscrits, ...waiting, ...invited].map((m) => m.id)));
    this.alreadyInvited.set(invited);
  }

  /** La liste des membres n'est chargée qu'au moment de chercher quelqu'un à inviter. */
  async loadMembers() {
    if (this.membersLoaded) return;
    this.membersLoaded = true;
    const { data } = await this.profileService.getAllProfiles();
    this.allMembers.set(data ?? []);
  }

  hasPlacesLimit(): boolean {
    return this.places() !== null;
  }

  /** Places encore libres pour inviter (Infinity sans limite). */
  placesLeft(): number {
    const places = this.places();
    if (places === null) return Infinity;
    return Math.max(0, places - this.takenPlaces - this.invitees().length);
  }

  /** Membres qui correspondent à la recherche (8 au plus). */
  inviteResults(): Profile[] {
    const q = this.inviteQuery().toLowerCase().trim();
    if (!q) return [];
    const chosen = new Set(this.invitees().map((m) => m.id));
    return this.allMembers()
      .filter(
        (m) =>
          m.id !== this.userId &&
          !chosen.has(m.id) &&
          !this.involvedIds().has(m.id) &&
          m.username.toLowerCase().includes(q),
      )
      .slice(0, 8);
  }

  addInvitee(member: Profile) {
    if (this.placesLeft() <= 0) return;
    this.invitees.update((list) => [...list, member]);
    this.inviteQuery.set('');
  }

  removeInvitee(memberId: string) {
    this.invitees.update((list) => list.filter((m) => m.id !== memberId));
  }

  /** Ce qu'il manque pour publier, en clair ; vide quand tout est prêt. */
  missingFields(): string[] {
    const missing: string[] = [];
    if (!this.sortie.theme_id) missing.push('le thème');
    if (this.isOtherTheme() && (this.sortie.theme_custom ?? '').trim().length < 2)
      missing.push('le nom du thème');
    if (!this.sortie.title?.trim()) missing.push('le nom');
    if (!this.dateDay) missing.push('la date');
    if (!this.dateHour) missing.push("l'heure");
    if (!this.sortie.location && !this.locationQuery().trim()) missing.push('le lieu');
    if (this.isOtherTheme() && !this.customImagePreview()) missing.push('ta photo');
    else if (!this.selectedImageUrl() && !this.customImagePreview()) missing.push("l'image");
    if (this.placesCap() !== null && this.places() === null)
      missing.push(`le nombre de participants (${this.placesCap()} max)`);
    return missing;
  }

  async onSubmit() {
    this.errorMessage.set('');
    const missing = this.missingFields();
    if (missing.length) {
      this.errorMessage.set(`Il manque encore : ${missing.join(', ')}.`);
      return;
    }
    if (this.overCap()) {
      this.errorMessage.set(
        `${this.placesCap()} places au maximum : passe Premium pour plus de places.`,
      );
      return;
    }
    const places = this.places();
    const invites = this.sortie.is_premium ? this.invitees().map((m) => m.id) : [];
    if (places !== null && this.takenPlaces + invites.length > places) {
      this.errorMessage.set(
        `Pas assez de places pour tes invités : il en faut au moins ${this.takenPlaces + invites.length}.`,
      );
      return;
    }
    // Lieu tapé sans choisir de suggestion : on garde le texte saisi.
    if (!this.sortie.location) this.sortie.location = this.locationQuery().trim();
    this.saving.set(true);

    try {
      // Upload image personnalisée si besoin
      if (!this.canCreatePremium()) this.sortie.is_premium = false;
      if (this.customImageFile && this.sortie.image_source === 'custom') {
        const { data: imageUrl, error: uploadError } = await this.sortieService.uploadImage(
          this.userId,
          this.customImageFile,
        );

        if (uploadError) {
          this.errorMessage.set(`Erreur upload image : ${uploadError.message}`);
          this.saving.set(false);
          return;
        }
        this.sortie.image_url = imageUrl ?? undefined;
      }

      // Adresse tapée sans choisir de suggestion : on cherche sa position pour la carte.
      if (this.sortie.location && this.sortie.lat == null) {
        const [place] = await firstValueFrom(this.geo.searchPlaces(this.sortie.location));
        if (place && Number.isFinite(place.lat)) {
          this.sortie.lat = place.lat;
          this.sortie.lng = place.lng;
        }
      }

      if (this.editId()) {
        const { data: saved, error } = await this.sortieService.updateSortie(
          this.editId(),
          this.withUtcDate(),
          invites,
        );
        if (error || !saved) {
          this.errorMessage.set(error?.message ?? 'Erreur lors de la modification de la sortie.');
        } else {
          this.successMessage.set('Sortie modifiée !');
          setTimeout(() => this.router.navigate(['/mes-sorties']), 1500);
        }
      } else {
        this.sortie.created_by = this.userId;
        const { data: newSortie, error } = await this.sortieService.createSortie(
          this.withUtcDate(),
          invites,
        );
        if (error || !newSortie) {
          this.errorMessage.set(error?.message ?? 'Erreur lors de la création de la sortie.');
        } else {
          this.successMessage.set('Sortie créée avec succès !');
          setTimeout(() => this.router.navigate(['/dashboard']), 1500);
        }
      }
    } catch (e) {
      this.errorMessage.set('Une erreur est survenue.');
    }

    this.saving.set(false);
  }

  onImageReady(blob: Blob) {
    const mimeType = blob.type || 'image/jpeg';
    const ext = mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg';
    this.customImageFile = new File([blob], `sortie.${ext}`, { type: mimeType });
    this.sortie.image_source = 'custom';
    this.sortie.image_url = ''; // efface l'éventuelle image par défaut sélectionnée
    this.selectedImageUrl.set('');
    const reader = new FileReader();
    reader.onload = (e) => {
      this.customImagePreview.set(e.target?.result as string);
    };
    reader.readAsDataURL(blob);
  }

  /**
   * La sortie à envoyer, avec sa date en heure universelle : 20h45 à Paris en hiver part en
   * 19:45Z, et chaque téléphone l'affiche ensuite à 20h45 dans son propre fuseau.
   */
  private withUtcDate(): Partial<Sortie> {
    return { ...this.sortie, date: new Date(this.sortie.date!).toISOString() };
  }

  goToPremium() {
    this.router.navigate(['/premium']);
  }

  goToDashboard() {
    this.router.navigate(['/dashboard']);
  }
}

/** « 2026-11-20T19:45:00.000Z » → « 2026-11-20T20:45 » à l'heure locale (champs date et heure). */
function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}
