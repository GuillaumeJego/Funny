import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';
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
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: '../login/login.component.scss',
})
export class ReinitialiserMotDePasseComponent {
  private authService = inject(AuthService);
  private router = inject(Router);

  password = '';
  confirmPassword = '';
  readonly loading = signal(false);
  readonly errorMessage = signal('');
  private readonly userId: string | null;
  private readonly secret: string | null;

  constructor() {
    const route = inject(ActivatedRoute);

    this.userId = route.snapshot.queryParamMap.get('userId');
    this.secret = route.snapshot.queryParamMap.get('secret');
  }

  get linkIsValid() {
    return !!this.userId && !!this.secret;
  }

  async onSubmit() {
    this.errorMessage.set('');
    if (this.password !== this.confirmPassword) {
      this.errorMessage.set('Les mots de passe ne correspondent pas.');
      return;
    }
    this.loading.set(true);
    const { error } = await this.authService.resetPassword(
      this.userId!,
      this.secret!,
      this.password,
    );
    this.loading.set(false);
    if (error) {
      this.errorMessage.set(error.message);
      return;
    }
    this.router.navigate(['/login'], { queryParams: { 'mot-de-passe': 'modifie' } });
  }
}
