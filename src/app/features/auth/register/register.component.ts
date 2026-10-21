import { Component, ChangeDetectionStrategy } from '@angular/core';

import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { MetanaCreditComponent } from '../../../core/components/metana-credit/metana-credit.component';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [FormsModule, RouterLink, MetanaCreditComponent],
  templateUrl: './register.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './register.component.scss',
})
export class RegisterComponent {
  username = '';
  email = '';
  password = '';
  confirmPassword = '';
  adult = false;
  acceptTerms = false;
  errorMessage = '';
  loading = false;

  constructor(
    private authService: AuthService,
    private router: Router,
  ) {}

  async onRegister() {
    this.loading = true;
    this.errorMessage = '';

    if (!this.adult || !this.acceptTerms) {
      this.errorMessage = 'Cochez les deux cases pour continuer.';
      this.loading = false;
      return;
    }

    if (this.password !== this.confirmPassword) {
      this.errorMessage = 'Les mots de passe ne correspondent pas.';
      this.loading = false;
      return;
    }

    const { error } = await this.authService.register(
      this.email,
      this.password,
      this.username.trim(),
      { adult: this.adult, terms: this.acceptTerms },
    );

    this.loading = false;
    if (error) {
      this.errorMessage = error.message || 'Une erreur est survenue. Veuillez réessayer.';
      return;
    }
    // Le compte est créé : on envoie l'e-mail de confirmation. En cas d'échec,
    // la page suivante permet de le renvoyer.
    const sent = await this.authService.sendVerification();
    this.router.navigate(['/verifier-email'], {
      queryParams: sent.error ? {} : { envoye: '1' },
    });
  }
}
