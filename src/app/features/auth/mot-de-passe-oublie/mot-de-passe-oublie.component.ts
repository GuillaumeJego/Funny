import { Component, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { MetanaCreditComponent } from '../../../core/components/metana-credit/metana-credit.component';

@Component({
  selector: 'app-mot-de-passe-oublie',
  standalone: true,
  imports: [FormsModule, RouterLink, MetanaCreditComponent],
  templateUrl: './mot-de-passe-oublie.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: '../login/login.component.scss',
})
export class MotDePasseOublieComponent {
  email = '';
  sent = false;
  loading = false;
  errorMessage = '';

  constructor(private authService: AuthService) {}

  async onSubmit() {
    this.errorMessage = '';
    if (!this.email.trim()) {
      this.errorMessage = 'Indiquez votre adresse e-mail.';
      return;
    }
    this.loading = true;
    const { error } = await this.authService.sendPasswordRecovery(this.email.trim());
    this.loading = false;
    if (error) {
      this.errorMessage = error.message;
    } else {
      this.sent = true;
    }
  }
}
