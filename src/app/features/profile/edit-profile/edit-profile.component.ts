import { Component, OnInit } from '@angular/core';
import { CommonModule, Location, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { ProfileService } from '../../../core/services/profile.service';
import { Profile } from '../../../core/models/profile.model';
import { AvatarUploadComponent } from '../avatar-upload/avatar-upload.component';
import { MetanaCreditComponent } from '../../../core/components/metana-credit/metana-credit.component';

@Component({
  selector: 'app-edit-profile',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe, AvatarUploadComponent, MetanaCreditComponent],
  templateUrl: './edit-profile.component.html',
  styleUrl: './edit-profile.component.scss'
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

  genderOptions = ['Homme', 'Femme', 'secret'];
  habitOptions = ['Pas du tout', 'Un peu', 'Beaucoup', 'secret'];
  childrenOptions = ["J'en veux", "J'en ai", "Je n'en ai pas", 'secret'];
  relationshipOptions = ['En couple', 'Célibataire', 'secret'];

  constructor(
    private authService: AuthService,
    private profileService: ProfileService,
    private router: Router,
    private location: Location
  ) {}

  async ngOnInit() {
    this.loading = true;
    const { data: { user } } = await this.authService.getUser();

    if (!user) {
      this.router.navigate(['/login']);
      return;
    }

    this.userId = user.id;
    const { data, error } = await this.profileService.getMyProfile(user.id);
    if (data) {
      this.profile = data;
      this.isPremium = ['user_premium', 'admin', 'developer'].includes(data.role || '');
      if (data.subscription_end_date) {
        this.subscriptionEndDate = new Date(data.subscription_end_date);
      }
    }

    this.loading = false;
  }

  onAvatarUpdated(url: string) {
    this.profile.avatar_url = url;
  }

  async onSave() {
    this.saving = true;
    this.successMessage = '';
    this.errorMessage = '';

    const { error } = await this.profileService.updateProfile(this.userId, this.profile);

    if (error) {
      this.errorMessage = 'Erreur lors de la sauvegarde.';
      this.saving = false;
    } else {
      this.router.navigate(['/dashboard']);
    }
  }

  goToPremium() {
    this.router.navigate(['/premium']);
  }

  cancel() {
    this.location.back();
  }
}