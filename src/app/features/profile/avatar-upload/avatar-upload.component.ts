import {
  Component,
  ElementRef,
  ChangeDetectionStrategy,
  inject,
  input,
  output,
  viewChild,
  signal,
} from '@angular/core';

import { ImageCropperComponent, ImageCroppedEvent } from 'ngx-image-cropper';
import { ProfileService } from '../../../core/services/profile.service';
import { ClickableDirective } from '../../../core/directives/clickable.directive';

@Component({
  selector: 'app-avatar-upload',
  standalone: true,
  imports: [ClickableDirective, ImageCropperComponent],
  templateUrl: './avatar-upload.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './avatar-upload.component.scss',
})
export class AvatarUploadComponent {
  private profileService = inject(ProfileService);

  readonly userId = input.required<string>();
  readonly currentAvatarUrl = input<string>();
  readonly avatarUpdated = output<string>();
  readonly fileInput = viewChild.required<ElementRef<HTMLInputElement>>('fileInput');

  readonly imageChangedEvent = signal<Event | null>(null);
  croppedBase64: string = '';
  readonly croppedImageUrl = signal<string>('');
  readonly showCropper = signal(false);
  readonly uploading = signal(false);
  readonly errorMessage = signal('');

  filters = [
    { name: 'Normal', value: 'none' },
    { name: 'Noir & Blanc', value: 'grayscale(100%)' },
    { name: 'Sépia', value: 'sepia(100%)' },
    { name: 'Lumineux', value: 'brightness(1.3)' },
    { name: 'Contraste', value: 'contrast(1.5)' },
  ];
  readonly selectedFilter = signal('none');

  onFileSelected(event: Event) {
    this.imageChangedEvent.set(event);
    this.showCropper.set(true);
    this.errorMessage.set('');
    this.croppedBase64 = '';
    this.croppedImageUrl.set('');
  }

  imageCropped(event: ImageCroppedEvent) {
    this.croppedBase64 = event.base64 || '';
    this.croppedImageUrl.set(event.base64 || '');
  }

  selectFilter(filter: string) {
    this.selectedFilter.set(filter);
  }

  async onUpload() {
    const userId = this.userId();
    if (!this.croppedBase64 || !userId) {
      this.errorMessage.set('Aucune image sélectionnée.');
      return;
    }

    this.uploading.set(true);
    this.errorMessage.set('');

    try {
      const blob = await this.applyFilterAndGetBlob(this.croppedBase64);
      const { data: urlWithCache, error: uploadError } = await this.profileService.uploadAvatar(
        userId,
        blob,
      );

      if (uploadError || !urlWithCache) throw uploadError;

      this.avatarUpdated.emit(urlWithCache);
      this.showCropper.set(false);
      this.croppedBase64 = '';
      this.croppedImageUrl.set('');
      // Reset le file input pour permettre de re-sélectionner une photo
      const fileInput = this.fileInput();
      if (fileInput) fileInput.nativeElement.value = '';
    } catch (err) {
      console.error('Upload error:', err);
      this.errorMessage.set("Erreur lors de l'upload.");
    }

    this.uploading.set(false);
  }

  private async applyFilterAndGetBlob(base64: string): Promise<Blob> {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d')!;
        if (this.selectedFilter() !== 'none') ctx.filter = this.selectedFilter();
        ctx.drawImage(img, 0, 0);
        canvas.toBlob((b) => resolve(b!), 'image/jpeg', 0.85);
      };
      img.src = base64;
    });
  }

  cancel() {
    this.showCropper.set(false);
    this.imageChangedEvent.set(null);
    this.croppedBase64 = '';
    this.croppedImageUrl.set('');
    this.selectedFilter.set('none');
    const fileInput = this.fileInput();
    if (fileInput) fileInput.nativeElement.value = '';
  }
}
