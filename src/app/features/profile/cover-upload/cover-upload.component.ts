import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { ImageCropperComponent, ImageCroppedEvent } from 'ngx-image-cropper';
import { ProfileService } from '../../../core/services/profile.service';

/**
 * Photo de couverture du profil (le bandeau en haut de la fiche) : choix d'une photo,
 * recadrage en bandeau, envoi, ou retour au bandeau bleu par défaut.
 */
@Component({
  selector: 'app-cover-upload',
  standalone: true,
  imports: [ImageCropperComponent],
  templateUrl: './cover-upload.component.html',
  styleUrl: './cover-upload.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CoverUploadComponent {
  private profileService = inject(ProfileService);

  readonly userId = input.required<string>();
  readonly currentCoverUrl = input<string | null | undefined>();
  /** Nouvelle adresse de la couverture, ou null quand elle est retirée. */
  readonly coverUpdated = output<string | null>();
  readonly fileInput = viewChild.required<ElementRef<HTMLInputElement>>('coverInput');

  readonly imageChangedEvent = signal<Event | null>(null);
  readonly croppedImageUrl = signal('');
  readonly showCropper = signal(false);
  readonly busy = signal(false);
  readonly errorMessage = signal('');

  onFileSelected(event: Event) {
    this.imageChangedEvent.set(event);
    this.croppedImageUrl.set('');
    this.errorMessage.set('');
    this.showCropper.set(true);
  }

  imageCropped(event: ImageCroppedEvent) {
    this.croppedImageUrl.set(event.base64 || '');
  }

  async onUpload() {
    const base64 = this.croppedImageUrl();
    if (!base64) return;
    this.busy.set(true);
    this.errorMessage.set('');
    const blob = await (await fetch(base64)).blob();
    const { data, error } = await this.profileService.uploadCover(this.userId(), blob);
    this.busy.set(false);
    if (error || !data) {
      this.errorMessage.set("La photo n'a pas pu être envoyée. Réessaie.");
      return;
    }
    this.coverUpdated.emit(data);
    this.cancel();
  }

  async onRemove() {
    this.busy.set(true);
    this.errorMessage.set('');
    const { error } = await this.profileService.removeCover(this.userId());
    this.busy.set(false);
    if (error) {
      this.errorMessage.set("La couverture n'a pas pu être retirée. Réessaie.");
      return;
    }
    this.coverUpdated.emit(null);
  }

  cancel() {
    this.showCropper.set(false);
    this.imageChangedEvent.set(null);
    this.croppedImageUrl.set('');
    this.fileInput().nativeElement.value = '';
  }
}
