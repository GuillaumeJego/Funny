import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule, Location, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { ProfileService } from '../../../core/services/profile.service';
import { BillingService } from '../../../core/services/billing.service';
import { Subscription } from '../../../core/models/subscription.model';
import { Profile } from '../../../core/models/profile.model';
import { AvatarUploadComponent } from '../avatar-upload/avatar-upload.component';
import { MetanaCreditComponent } from '../../../core/components/metana-credit/metana-credit.component';

@Component({
  selector: 'app-edit-profile',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe, AvatarUploadComponent, MetanaCreditComponent],
  templateUrl: './edit-profile.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './edit-profile.component.scss',
})
export class EditProfileComponent implements OnInit {
  profile: Partial<Profile> = {};
  userId = '';
  loading = false;
  saving = false;
  successMessage = '';
  errorMessage = '';
  isPremium = false;
  subscriptionEndDate?: Date;
  /** Abonnement payé avec Stripe : donne accès à l'espace client (factures, résiliation). */
  subscription: Subscription | null = null;
  openingPortal = false;
  portalError = '';

  deleteDialogOpen = false;
  deletePassword = '';
  deleting = false;
  deleteError = '';

  genderOptions = ['Homme', 'Femme', 'secret'];
  habitOptions = ['Pas du tout', 'Un peu', 'Beaucoup', 'secret'];
  childrenOptions = ["J'en veux", "J'en ai", "Je n'en ai pas", 'secret'];
  relationshipOptions = ['En couple', 'Célibataire', 'secret'];

  constructor(
    private authService: AuthService,
    private profileService: ProfileService,
    private billing: BillingService,
    private router: Router,
    private location: Location,
  ) {}

  async ngOnInit() {
    this.loading = true;
    const {
      data: { user },
    } = await this.authService.getUser();

    if (!user) {
      this.router.navigate(['/login']);
      return;
    }

    this.userId = user.id;
    const { data, error } = await this.profileService.getMyProfile(user.id);
    if (data) {
      this.profile = data;
      if (data.subscription_end_date) {
        this.subscriptionEndDate = new Date(data.subscription_end_date);
      }
      this.isPremium =
        ['user_premium', 'admin', 'developer'].includes(data.role || '') ||
        (!!this.subscriptionEndDate && this.subscriptionEndDate > new Date());
    }
    this.subscription = (await this.billing.getSubscription(user.id)).data;

    this.loading = false;
  }

  onAvatarUpdated(url: string) {
    this.profile.avatar_url = url;
  }

  async onSave() {
    this.saving = true;
    this.successMessage = '';
    this.errorMessage = '';

    const { error } = await this.profileService.updateMyProfile(this.userId, this.profile);

    if (error) {
      this.errorMessage = 'Erreur lors de la sauvegarde.';
      this.saving = false;
    } else {
      this.router.navigate(['/dashboard']);
    }
  }

  /** Abonnement Stripe en cours (même résilié, tant que la période payée n'est pas finie). */
  get hasPaidSubscription() {
    return this.subscription?.status === 'active' || this.subscription?.status === 'past_due';
  }

  async openPortal() {
    this.portalError = '';
    this.openingPortal = true;
    const error = await this.billing.manage();
    if (error) {
      this.portalError = error;
      this.openingPortal = false;
    }
  }

  goToPremium() {
    this.router.navigate(['/premium']);
  }

  cancel() {
    this.location.back();
  }

  openDeleteDialog() {
    this.deletePassword = '';
    this.deleteError = '';
    this.deleteDialogOpen = true;
  }

  closeDeleteDialog() {
    if (!this.deleting) this.deleteDialogOpen = false;
  }

  async deleteAccount() {
    if (!this.deletePassword || this.deleting) return;
    this.deleting = true;
    this.deleteError = '';
    const { error } = await this.authService.deleteAccount(this.deletePassword);
    this.deleting = false;
    if (error) {
      this.deletePassword = '';
      this.deleteError = error.message;
      return;
    }
    this.router.navigate(['/login'], { queryParams: { compte: 'supprime' } });
  }
}
