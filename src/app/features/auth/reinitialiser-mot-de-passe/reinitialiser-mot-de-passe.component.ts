import { Component, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { MetanaCreditComponent } from '../../../core/components/metana-credit/metana-credit.component';

/** Page ouverte depuis le lien « mot de passe oublié » (?userId=…&secret=…). */
@Component({
  selector: 'app-reinitialiser-mot-de-passe',
  standalone: true,
  imports: [FormsModule, RouterLink, MetanaCreditComponent],
  templateUrl: './reinitialiser-mot-de-passe.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: '../login/login.component.scss',
})
export class ReinitialiserMotDePasseComponent {
  password = '';
  confirmPassword = '';
  loading = false;
  errorMessage = '';
  private readonly userId: string | null;
  private readonly secret: string | null;

  constructor(
    private authService: AuthService,
    private router: Router,
    route: ActivatedRoute,
  ) {
    this.userId = route.snapshot.queryParamMap.get('userId');
    this.secret = route.snapshot.queryParamMap.get('secret');
  }

  get linkIsValid() {
    return !!this.userId && !!this.secret;
  }

  async onSubmit() {
    this.errorMessage = '';
    if (this.password !== this.confirmPassword) {
      this.errorMessage = 'Les mots de passe ne correspondent pas.';
      return;
    }
    this.loading = true;
    const { error } = await this.authService.resetPassword(
      this.userId!,
      this.secret!,
      this.password,
    );
    this.loading = false;
    if (error) {
      this.errorMessage = error.message;
      return;
    }
    this.router.navigate(['/login'], { queryParams: { 'mot-de-passe': 'modifie' } });
  }
}
