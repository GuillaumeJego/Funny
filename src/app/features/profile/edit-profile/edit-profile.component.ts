import {
  Component,
  OnInit,
  ChangeDetectionStrategy,
  inject,
  signal,
  computed,
} from '@angular/core';
import { CommonModule, Location, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { ProfileService } from '../../../core/services/profile.service';
import { BillingService } from '../../../core/services/billing.service';
import { Subscription } from '../../../core/models/subscription.model';
import { Profile, RELATIONSHIP_OPTIONS } from '../../../core/models/profile.model';
import { AvatarUploadComponent } from '../avatar-upload/avatar-upload.component';
import { CoverUploadComponent } from '../cover-upload/cover-upload.component';
import { MetanaCreditComponent } from '../../../core/components/metana-credit/metana-credit.component';
import { isPremiumMember } from '../../../core/utils/premium';

@Component({
  selector: 'app-edit-profile',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    DatePipe,
    AvatarUploadComponent,
    CoverUploadComponent,
    MetanaCreditComponent,
  ],
  templateUrl: './edit-profile.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './edit-profile.component.scss',
})
export class EditProfileComponent implements OnInit {
  private authService = inject(AuthService);
  private profileService = inject(ProfileService);
  private billing = inject(BillingService);
  private router = inject(Router);
  private location = inject(Location);

  readonly profile = signal<Partial<Profile>>({});
  readonly userId = signal('');
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly successMessage = signal('');
  readonly errorMessage = signal('');
  readonly isPremium = signal(false);
  readonly subscriptionEndDate = signal<Date | undefined>(undefined);
  /** Abonnement payé avec Stripe : donne accès à l'espace client (factures, résiliation). */
  readonly subscription = signal<Subscription | null>(null);
  readonly openingPortal = signal(false);
  readonly portalError = signal('');

  readonly deleteDialogOpen = signal(false);
  readonly deletePassword = signal('');
  readonly deleting = signal(false);
  readonly deleteError = signal('');

  genderOptions = ['Homme', 'Femme', 'secret'];
  habitOptions = ['Pas du tout', 'Un peu', 'Beaucoup', 'secret'];
  childrenOptions = ["J'en veux", "J'en ai", "Je n'en ai pas", 'secret'];
  relationshipOptions = RELATIONSHIP_OPTIONS;

  async ngOnInit() {
    this.loading.set(true);
    const {
      data: { user },
    } = await this.authService.getUser();

    if (!user) {
      this.router.navigate(['/login']);
      return;
    }

    this.userId.set(user.id);
    const { data, error } = await this.profileService.getMyProfile(user.id);
    if (data) {
      this.profile.set(data);
      if (data.subscription_end_date) {
        this.subscriptionEndDate.set(new Date(data.subscription_end_date));
      }
      this.isPremium.set(isPremiumMember(data));
    }
    this.subscription.set((await this.billing.getSubscription(user.id)).data);

    this.loading.set(false);
  }

  onAvatarUpdated(url: string) {
    this.profile.set({ ...this.profile(), avatar_url: url });
  }

  onCoverUpdated(url: string | null) {
    this.profile.set({ ...this.profile(), cover_url: url });
  }

  async onSave() {
    this.saving.set(true);
    this.successMessage.set('');
    this.errorMessage.set('');

    const { error } = await this.profileService.updateMyProfile(this.userId(), this.profile());

    if (error) {
      this.errorMessage.set('Erreur lors de la sauvegarde.');
      this.saving.set(false);
    } else {
      this.router.navigate(['/dashboard']);
    }
  }

  /** Abonnement Stripe en cours (même résilié, tant que la période payée n'est pas finie). */
  readonly hasPaidSubscription = computed(() => {
    return this.subscription()?.status === 'active' || this.subscription()?.status === 'past_due';
  });

  async openPortal() {
    this.portalError.set('');
    this.openingPortal.set(true);
    const error = await this.billing.manage();
    if (error) {
      this.portalError.set(error);
      this.openingPortal.set(false);
    }
  }

  goToPremium() {
    this.router.navigate(['/premium']);
  }

  cancel() {
    this.location.back();
  }

  openDeleteDialog() {
    this.deletePassword.set('');
    this.deleteError.set('');
    this.deleteDialogOpen.set(true);
  }

  closeDeleteDialog() {
    if (!this.deleting()) this.deleteDialogOpen.set(false);
  }

  async deleteAccount() {
    if (!this.deletePassword() || this.deleting()) return;
    this.deleting.set(true);
    this.deleteError.set('');
    const { error } = await this.authService.deleteAccount(this.deletePassword());
    this.deleting.set(false);
    if (error) {
      this.deletePassword.set('');
      this.deleteError.set(error.message);
      return;
    }
    this.router.navigate(['/login'], { queryParams: { compte: 'supprime' } });
  }
}
