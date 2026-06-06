import { Component, EventEmitter, Input, Output } from '@angular/core';
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

  imageChangedEvent: Event | null = null;
  croppedImageBlob: Blob | null = null;
  croppedImageUrl: string = '';
  showCropper = false;
  uploading = false;
  errorMessage = '';

  // Filtres disponibles
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
  }

  imageCropped(event: ImageCroppedEvent) {
    this.croppedImageBlob = event.blob || null;
    this.croppedImageUrl = event.objectUrl || '';
  }

  selectFilter(filter: string) {
    this.selectedFilter = filter;
  }

  async onUpload() {
    if (!this.croppedImageBlob || !this.userId) return;

    this.uploading = true;
    this.errorMessage = '';

    try {
      // Applique le filtre sur le canvas avant upload
      const filteredBlob = await this.applyFilter(this.croppedImageBlob);

      const filePath = `${this.userId}/avatar.jpg`;

      // Supprime l'ancien avatar s'il existe
      await this.supabase.client.storage
        .from('avatars')
        .remove([filePath]);

      // Upload le nouveau
      const { error: uploadError } = await this.supabase.client.storage
        .from('avatars')
        .upload(filePath, filteredBlob, { contentType: 'image/jpeg', upsert: true });

      if (uploadError) throw uploadError;

      // Récupère l'URL publique
      const { data } = this.supabase.client.storage
        .from('avatars')
        .getPublicUrl(filePath);

      // Met à jour le profil
      await this.supabase.client
        .from('profiles')
        .update({ avatar_url: data.publicUrl })
        .eq('id', this.userId);

      this.avatarUpdated.emit(data.publicUrl);
      this.showCropper = false;

    } catch (error) {
      this.errorMessage = "Erreur lors de l'upload.";
    }

    this.uploading = false;
  }

  private async applyFilter(blob: Blob): Promise<Blob> {
    if (this.selectedFilter === 'none') return blob;

    return new Promise((resolve) => {
      const img = new Image();
      const url = URL.createObjectURL(blob);
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d')!;
        ctx.filter = this.selectedFilter;
        ctx.drawImage(img, 0, 0);
        URL.revokeObjectURL(url);
        canvas.toBlob((b) => resolve(b!), 'image/jpeg', 0.85);
      };
      img.src = url;
    });
  }

  cancel() {
    this.showCropper = false;
    this.imageChangedEvent = null;
    this.croppedImageUrl = '';
    this.selectedFilter = 'none';
  }
}