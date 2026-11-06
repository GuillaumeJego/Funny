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
import { Router } from '@angular/router';
import { Subject, Subscription } from 'rxjs';
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

  readonly currentStep = signal(1);
  totalSteps = 4;

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
    if (profile) {
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

  onLocationInput() {
    this.locationSearch$.next(this.locationQuery());
  }

  selectLocation(place: GeoFullPlace) {
    // On stocke le nom court (ex: "Le Marais", "Paris") + adresse si disponible
    const label = place.address ? `${place.shortName}, ${place.address}` : place.shortName;
    this.sortie.location = label;
    this.locationQuery.set(place.shortName);
    this.locationSuggestions.set([]);
  }

  clearLocation() {
    this.sortie.location = '';
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

  nextStep() {
    if (this.currentStep() < this.totalSteps) this.currentStep.set(this.currentStep() + 1);
  }

  prevStep() {
    if (this.currentStep() > 1) this.currentStep.set(this.currentStep() - 1);
  }

  async onSubmit() {
    this.saving.set(true);
    this.errorMessage.set('');

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

      this.sortie.created_by = this.userId;
      const { data: newSortie, error } = await this.sortieService.createSortie(this.sortie);

      if (error || !newSortie) {
        this.errorMessage.set(error?.message ?? 'Erreur lors de la création de la sortie.');
      } else {
        this.successMessage.set('Sortie créée avec succès !');
        setTimeout(() => this.router.navigate(['/dashboard']), 1500);
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
