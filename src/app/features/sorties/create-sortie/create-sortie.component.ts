import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
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
export class CreateSortieComponent implements OnInit {
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

  constructor(
    private authService: AuthService,
    private sortieService: SortieService,
    private themeService: ThemeService,
    private supabase: SupabaseService,
    private router: Router
  ) {}

  async ngOnInit() {
    const { data: { user } } = await this.authService.getUser();
    if (!user) { this.router.navigate(['/login']); return; }
    this.userId = user.id;

    const { data: themes } = await this.themeService.getAllThemes();
    if (themes) this.themes = themes;
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
        const filePath = `sorties/${this.userId}/${Date.now()}.jpg`;
        const { error: uploadError } = await this.supabase.client.storage
          .from('sorties-images')
          .upload(filePath, this.customImageFile, { upsert: true });

        if (!uploadError) {
          const { data: urlData } = this.supabase.client.storage
            .from('sorties-images')
            .getPublicUrl(filePath);
          this.sortie.image_url = urlData.publicUrl;
        }
      }

      this.sortie.created_by = this.userId;
      const { error } = await this.sortieService.createSortie(this.sortie);

      if (error) {
        this.errorMessage = 'Erreur lors de la création de la sortie.';
      } else {
        this.successMessage = 'Sortie créée avec succès !';
        setTimeout(() => this.router.navigate(['/dashboard']), 1500);
      }
    } catch (e) {
      this.errorMessage = 'Une erreur est survenue.';
    }

    this.saving = false;
  }

  onImageReady(blob: Blob) {
    this.customImageFile = new File([blob], 'sortie.jpg', { type: 'image/jpeg' });
    this.sortie.image_source = 'custom';
    const reader = new FileReader();
    reader.onload = (e) => this.customImagePreview = e.target?.result as string;
    reader.readAsDataURL(blob);
  }

  goToDashboard() {
    this.router.navigate(['/dashboard']);
  }
}