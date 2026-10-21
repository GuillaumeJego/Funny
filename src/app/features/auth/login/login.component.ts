import { Component, ChangeDetectionStrategy } from '@angular/core';

import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { MetanaCreditComponent } from '../../../core/components/metana-credit/metana-credit.component';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, RouterLink, MetanaCreditComponent],
  templateUrl: './login.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './login.component.scss',
})
export class LoginComponent {
  email = '';
  password = '';
  errorMessage = '';
  loading = false;
  /** Affiché après la suppression du compte, un changement de mot de passe ou la confirmation de l'adresse. */
  successMessage = '';

  constructor(
    private authService: AuthService,
    private router: Router,
    route: ActivatedRoute,
  ) {
    const params = route.snapshot.queryParamMap;
    if (params.get('compte') === 'supprime') {
      this.successMessage = 'Votre compte et toutes vos données ont été supprimés.';
    } else if (params.get('mot-de-passe') === 'modifie') {
      this.successMessage = 'Votre mot de passe a été modifié. Vous pouvez vous connecter.';
    } else if (params.get('email') === 'confirme') {
      this.successMessage = 'Votre adresse est confirmée. Vous pouvez vous connecter.';
    }
  }

  async onLogin() {
    this.loading = true;
    this.errorMessage = '';

    const { error } = await this.authService.login(this.email, this.password);

    if (error) {
      // Le message distingue un compte suspendu ; sinon il ne dit pas si l'email existe.
      this.errorMessage = error.message || 'Email ou mot de passe incorrect.';
    } else {
      this.router.navigate(['/dashboard']);
    }

    this.loading = false;
  }
}
