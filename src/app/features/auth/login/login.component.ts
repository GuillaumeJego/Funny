import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';

import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { MetanaCreditComponent } from '../../../core/components/metana-credit/metana-credit.component';
import { safeRedirect } from '../../../core/utils/redirect';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, RouterLink, MetanaCreditComponent],
  templateUrl: './login.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './login.component.scss',
})
export class LoginComponent {
  private authService = inject(AuthService);
  private router = inject(Router);

  email = '';
  password = '';
  readonly errorMessage = signal('');
  readonly loading = signal(false);
  /** Affiché après la suppression du compte, un changement de mot de passe ou la confirmation de l'adresse. */
  readonly successMessage = signal('');
  /** Page demandée avant la connexion (ex. le lien d'une sortie) : on y revient ensuite. */
  private readonly redirect: string | null;

  constructor() {
    const route = inject(ActivatedRoute);

    const params = route.snapshot.queryParamMap;
    this.redirect = safeRedirect(params.get('redirect'));
    if (params.get('compte') === 'supprime') {
      this.successMessage.set('Votre compte et toutes vos données ont été supprimés.');
    } else if (params.get('mot-de-passe') === 'modifie') {
      this.successMessage.set('Votre mot de passe a été modifié. Vous pouvez vous connecter.');
    } else if (params.get('email') === 'confirme') {
      this.successMessage.set('Votre adresse est confirmée. Vous pouvez vous connecter.');
    }
  }

  async onLogin() {
    this.loading.set(true);
    this.errorMessage.set('');

    const { error } = await this.authService.login(this.email, this.password);

    if (error) {
      // Le message distingue un compte suspendu ; sinon il ne dit pas si l'email existe.
      this.errorMessage.set(error.message || 'Email ou mot de passe incorrect.');
    } else {
      this.router.navigateByUrl(this.redirect ?? '/dashboard');
    }

    this.loading.set(false);
  }
}
