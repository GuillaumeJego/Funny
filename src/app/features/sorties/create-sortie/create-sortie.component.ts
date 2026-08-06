import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';
import { GeoService, GeoFullPlace } from '../../../core/services/geo.service';
import { AuthService } from '../../../core/services/auth.service';
import { SortieService } from '../../../core/services/sortie.service';
import { ThemeService } from '../../../core/services/theme.service';
import { SupabaseService } from '../../../core/services/supabase.service';
import { Theme, ThemeImage } from '../../../core/models/theme.model';
import { Sortie } from '../../../core/models/sortie.model';
import { SortieImageUploadComponent } from '../sortie-image-upload/sortie-image-upload.component';

@Component({
  selector: 'app-create-sortie',
  standalone: true,
  imports: [CommonModule, FormsModule,SortieImageUploadComponent],
  templateUrl: './create-sortie.component.html',
  styleUrl: './create-sortie.component.scss'
})
export class CreateSortieComponent implements OnInit, OnDestroy {
  themes: Theme[] = [];
  themeImages: ThemeImage[] = [];
  userId = '';
  loading = false;
  saving = false;
  errorMessage = '';
  successMessage = '';

  currentStep = 1;
  totalSteps = 4;

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
    status: 'published'
  };

  selectedImageUrl = '';
  customImageFile: File | null = null;
  customImagePreview = '';

  // Autocomplete lieu
  locationQuery = '';
  locationSuggestions: GeoFullPlace[] = [];
  locationSearching = false;
  private locationSearch$ = new Subject<string>();
  private locationSub!: Subscription;

  constructor(
    private authService: AuthService,
    private sortieService: SortieService,
    private themeService: ThemeService,
    private supabase: SupabaseService,
    private router: Router,
    private geo: GeoService
  ) {}

  async ngOnInit() {
    const { data: { user } } = await this.authService.getUser();
    if (!user) { this.router.navigate(['/login']); return; }
    this.userId = user.id;

    const { data: themes } = await this.themeService.getAllThemes();
    if (themes) this.themes = themes;

    this.locationSub = this.locationSearch$.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      switchMap(q => {
        this.locationSearching = true;
        return this.geo.searchPlaces(q);
      })
    ).subscribe(places => {
      this.locationSuggestions = places;
      this.locationSearching = false;
    });
  }

  ngOnDestroy() { this.locationSub?.unsubscribe(); }

  onLocationInput() { this.locationSearch$.next(this.locationQuery); }

  selectLocation(place: GeoFullPlace) {
    // On stocke le nom court (ex: "Le Marais", "Paris") + adresse si disponible
    const label = place.address ? `${place.shortName}, ${place.address}` : place.shortName;
    this.sortie.location = label;
    this.locationQuery = place.shortName;
    this.locationSuggestions = [];
  }

  clearLocation() {
    this.sortie.location = '';
    this.locationQuery = '';
    this.locationSuggestions = [];
  }

  async onThemeSelected() {
    if (!this.sortie.theme_id) return;
    const { data } = await this.themeService.getThemeImages(this.sortie.theme_id);
    if (data) this.themeImages = data;
    this.selectedImageUrl = '';
  }

  selectDefaultImage(imageUrl: string) {
    this.selectedImageUrl = imageUrl;
    this.sortie.image_url = imageUrl;
    this.sortie.image_source = 'default';
    this.customImagePreview = '';
  }

  nextStep() {
    if (this.currentStep < this.totalSteps) this.currentStep++;
  }

  prevStep() {
    if (this.currentStep > 1) this.currentStep--;
  }

  async onSubmit() {
    this.saving = true;
    this.errorMessage = '';

    try {
      // Upload image personnalisée si besoin
      if (this.customImageFile && this.sortie.image_source === 'custom') {
        const filePath = `${this.userId}/${Date.now()}.jpg`;
        const { error: uploadError } = await this.supabase.client.storage
          .from('sorties-images')
          .upload(filePath, this.customImageFile, { upsert: true });

        if (uploadError) {
          this.errorMessage = `Erreur upload image : ${uploadError.message}`;
          this.saving = false;
          return;
        }
        const { data: urlData } = this.supabase.client.storage
          .from('sorties-images')
          .getPublicUrl(filePath);
        this.sortie.image_url = urlData.publicUrl;
      }

      this.sortie.created_by = this.userId;
      const { data: newSortie, error } = await this.sortieService.createSortie(this.sortie);

      if (error || !newSortie) {
        this.errorMessage = 'Erreur lors de la création de la sortie.';
      } else {
        // Auto-inscrire l'organisateur
        await this.supabase.client
          .from('inscriptions')
          .insert({ sortie_id: newSortie.id, user_id: this.userId, status: 'confirmed' });

        this.successMessage = 'Sortie créée avec succès !';
        setTimeout(() => this.router.navigate(['/dashboard']), 1500);
      }
    } catch (e) {
      this.errorMessage = 'Une erreur est survenue.';
    }

    this.saving = false;
  }

  onImageReady(blob: Blob) {
    console.log('Blob reçu - type:', blob.type, '| taille:', blob.size, 'bytes');
    const mimeType = blob.type || 'image/jpeg';
    const ext = mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg';
    this.customImageFile = new File([blob], `sortie.${ext}`, { type: mimeType });
    this.sortie.image_source = 'custom';
    this.sortie.image_url = '';   // efface l'éventuelle image par défaut sélectionnée
    this.selectedImageUrl = '';
    const reader = new FileReader();
    reader.onload = (e) => this.customImagePreview = e.target?.result as string;
    reader.readAsDataURL(blob);
  }

  goToDashboard() {
    this.router.navigate(['/dashboard']);
  }
}