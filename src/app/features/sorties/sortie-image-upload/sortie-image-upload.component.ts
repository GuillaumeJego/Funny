import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ImageCropperComponent, ImageCroppedEvent } from 'ngx-image-cropper';

@Component({
  selector: 'app-sortie-image-upload',
  standalone: true,
  imports: [CommonModule, ImageCropperComponent],
  templateUrl: './sortie-image-upload.component.html',
  styleUrl: './sortie-image-upload.component.scss'
})
export class SortieImageUploadComponent {
  @Output() imageReady = new EventEmitter<Blob>();

  imageChangedEvent: Event | null = null;
  croppedImageBlob: Blob | null = null;
  croppedImageUrl: string = '';
  showCropper = false;

  onFileSelected(event: Event) {
    this.imageChangedEvent = event;
    this.showCropper = true;
  }

  async imageCropped(event: ImageCroppedEvent) {
    this.croppedImageUrl = event.objectUrl || '';
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
      this.showCropper = false;
    }
  }

  cancel() {
    this.showCropper = false;
    this.imageChangedEvent = null;
    this.croppedImageUrl = '';
  }
}