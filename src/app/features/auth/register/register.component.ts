import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';

import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { MetanaCreditComponent } from '../../../core/components/metana-credit/metana-credit.component';

/** Même règle que le serveur (fonction « account ») : vérifiée avant de créer le compte. */
const USERNAME = /^[\p{L}\p{N}._-]{3,40}$/u;

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [FormsModule, RouterLink, MetanaCreditComponent],
  templateUrl: './register.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './register.component.scss',
})
export class RegisterComponent {
  private authService = inject(AuthService);
  private router = inject(Router);

  username = '';
  email = '';
  password = '';
  confirmPassword = '';
  adult = false;
  acceptTerms = false;
  readonly errorMessage = signal('');
  readonly loading = signal(false);

  async onRegister() {
    this.loading.set(true);
    this.errorMessage.set('');

    if (!this.adult || !this.acceptTerms) {
      this.errorMessage.set('Cochez les deux cases pour continuer.');
      this.loading.set(false);
      return;
    }

    if (!USERNAME.test(this.username.trim())) {
      this.errorMessage.set(
        'Pseudo invalide : 3 à 40 lettres, chiffres, points, tirets ou soulignés, sans espace.',
      );
      this.loading.set(false);
      return;
    }

    if (this.password !== this.confirmPassword) {
      this.errorMessage.set('Les mots de passe ne correspondent pas.');
      this.loading.set(false);
      return;
    }

    const { error } = await this.authService.register(
      this.email,
      this.password,
      this.username.trim(),
      { adult: this.adult, terms: this.acceptTerms },
    );

    this.loading.set(false);
    if (error) {
      this.errorMessage.set(error.message || 'Une erreur est survenue. Veuillez réessayer.');
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
