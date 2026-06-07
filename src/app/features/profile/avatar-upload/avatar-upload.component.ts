import { Component, EventEmitter, Input, Output, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ImageCropperComponent, ImageCroppedEvent } from 'ngx-image-cropper';
import { SupabaseService } from '../../../core/services/supabase.service';

@Component({
  selector: 'app-avatar-upload',
  standalone: true,
  imports: [CommonModule, ImageCropperComponent],
  templateUrl: './avatar-upload.component.html',
  styleUrl: './avatar-upload.component.scss'
})
export class AvatarUploadComponent {
  @Input() userId!: string;
  @Input() currentAvatarUrl?: string;
  @Output() avatarUpdated = new EventEmitter<string>();
  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

  imageChangedEvent: Event | null = null;
  croppedBase64: string = '';
  croppedImageUrl: string = '';
  showCropper = false;
  uploading = false;
  errorMessage = '';

  filters = [
    { name: 'Normal', value: 'none' },
    { name: 'Noir & Blanc', value: 'grayscale(100%)' },
    { name: 'Sépia', value: 'sepia(100%)' },
    { name: 'Lumineux', value: 'brightness(1.3)' },
    { name: 'Contraste', value: 'contrast(1.5)' },
  ];
  selectedFilter = 'none';

  constructor(private supabase: SupabaseService) {}

  onFileSelected(event: Event) {
    this.imageChangedEvent = event;
    this.showCropper = true;
    this.errorMessage = '';
    this.croppedBase64 = '';
    this.croppedImageUrl = '';
  }

  imageCropped(event: ImageCroppedEvent) {
    this.croppedBase64 = event.base64 || '';
    this.croppedImageUrl = event.base64 || '';
  }

  selectFilter(filter: string) {
    this.selectedFilter = filter;
  }

  async onUpload() {
    if (!this.croppedBase64 || !this.userId) {
      this.errorMessage = 'Aucune image sélectionnée.';
      return;
    }

    this.uploading = true;
    this.errorMessage = '';

    try {
      const blob = await this.applyFilterAndGetBlob(this.croppedBase64);
      const filePath = `${this.userId}/avatar.jpg`;

      await this.supabase.client.storage.from('avatars').remove([filePath]);

      const { error: uploadError } = await this.supabase.client.storage
        .from('avatars')
        .upload(filePath, blob, { contentType: 'image/jpeg', upsert: true });

      if (uploadError) throw uploadError;

      const { data } = this.supabase.client.storage.from('avatars').getPublicUrl(filePath);
      const urlWithCache = `${data.publicUrl}?t=${Date.now()}`;

      await this.supabase.client
        .from('profiles')
        .update({ avatar_url: urlWithCache })
        .eq('id', this.userId);

      this.avatarUpdated.emit(urlWithCache);
      this.showCropper = false;
      this.croppedBase64 = '';
      this.croppedImageUrl = '';
      // Reset le file input pour permettre de re-sélectionner une photo
      if (this.fileInput) this.fileInput.nativeElement.value = '';

    } catch (err) {
      console.error('Upload error:', err);
      this.errorMessage = "Erreur lors de l'upload.";
    }

    this.uploading = false;
  }

  private async applyFilterAndGetBlob(base64: string): Promise<Blob> {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d')!;
        if (this.selectedFilter !== 'none') ctx.filter = this.selectedFilter;
        ctx.drawImage(img, 0, 0);
        canvas.toBlob((b) => resolve(b!), 'image/jpeg', 0.85);
      };
      img.src = base64;
    });
  }

  cancel() {
    this.showCropper = false;
    this.imageChangedEvent = null;
    this.croppedBase64 = '';
    this.croppedImageUrl = '';
    this.selectedFilter = 'none';
    if (this.fileInput) this.fileInput.nativeElement.value = '';
  }
}
