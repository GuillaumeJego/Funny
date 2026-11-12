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
import { Theme, ThemeImage } from '../../../core/models/theme.model';
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
      // Le champ « date et heure » attend 2026-11-20T19:30 : la date telle qu'elle a été saisie.
      date: sortie.date.slice(0, 16),
      location: sortie.location,
      price: sortie.price,
      max_participants: sortie.max_participants ?? undefined,
      is_premium: sortie.is_premium,
      image_url: sortie.image_url ?? '',
      image_source: sortie.image_source,
      lat: sortie.lat ?? null,
      lng: sortie.lng ?? null,
    };
    this.dateDay = sortie.date.slice(0, 10);
    this.dateHour = sortie.date.slice(11, 16);
    // Une sortie déjà Premium peut le rester, même si l'abonnement de l'organisateur a pris fin.
    if (sortie.is_premium) this.canCreatePremium.set(true);
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

  /** Ce qu'il manque pour publier, en clair ; vide quand tout est prêt. */
  missingFields(): string[] {
    const missing: string[] = [];
    if (!this.sortie.theme_id) missing.push('le thème');
    if (!this.sortie.title?.trim()) missing.push('le nom');
    if (!this.dateDay) missing.push('la date');
    if (!this.dateHour) missing.push("l'heure");
    if (!this.sortie.location && !this.locationQuery().trim()) missing.push('le lieu');
    if (!this.selectedImageUrl() && !this.customImagePreview()) missing.push("l'image");
    return missing;
  }

  async onSubmit() {
    this.errorMessage.set('');
    const missing = this.missingFields();
    if (missing.length) {
      this.errorMessage.set(`Il manque encore : ${missing.join(', ')}.`);
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
          this.sortie,
        );
        if (error || !saved) {
          this.errorMessage.set(error?.message ?? 'Erreur lors de la modification de la sortie.');
        } else {
          this.successMessage.set('Sortie modifiée !');
          setTimeout(() => this.router.navigate(['/mes-sorties']), 1500);
        }
      } else {
        this.sortie.created_by = this.userId;
        const { data: newSortie, error } = await this.sortieService.createSortie(this.sortie);
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

  goToDashboard() {
    this.router.navigate(['/dashboard']);
  }
}
