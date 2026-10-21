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
  /** Affiché après la suppression du compte. */
  accountDeleted = false;

  constructor(
    private authService: AuthService,
    private router: Router,
    route: ActivatedRoute,
  ) {
    this.accountDeleted = route.snapshot.queryParamMap.get('compte') === 'supprime';
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
