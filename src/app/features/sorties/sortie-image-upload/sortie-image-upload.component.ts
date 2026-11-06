import { Component, ChangeDetectionStrategy, output, signal } from '@angular/core';

import { ImageCropperComponent, ImageCroppedEvent } from 'ngx-image-cropper';

@Component({
  selector: 'app-sortie-image-upload',
  standalone: true,
  imports: [ImageCropperComponent],
  templateUrl: './sortie-image-upload.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './sortie-image-upload.component.scss',
})
export class SortieImageUploadComponent {
  readonly imageReady = output<Blob>();

  readonly imageChangedEvent = signal<Event | null>(null);
  croppedImageBlob: Blob | null = null;
  readonly croppedImageUrl = signal<string>('');
  readonly showCropper = signal(false);

  onFileSelected(event: Event) {
    this.imageChangedEvent.set(event);
    this.showCropper.set(true);
  }

  async imageCropped(event: ImageCroppedEvent) {
    this.croppedImageUrl.set(event.objectUrl || '');
    if (event.blob) {
      this.croppedImageBlob = event.blob;
    } else if (event.objectUrl) {
      const res = await fetch(event.objectUrl);
      this.croppedImageBlob = await res.blob();
    }
  }

  validate() {
    if (this.croppedImageBlob) {
      this.imageReady.emit(this.croppedImageBlob);
      this.showCropper.set(false);
    }
  }

  cancel() {
    this.showCropper.set(false);
    this.imageChangedEvent.set(null);
    this.croppedImageUrl.set('');
  }
}
