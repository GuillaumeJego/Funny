import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { MetanaCreditComponent } from '../../../core/components/metana-credit/metana-credit.component';

@Component({
  selector: 'app-mot-de-passe-oublie',
  standalone: true,
  imports: [FormsModule, RouterLink, MetanaCreditComponent],
  templateUrl: './mot-de-passe-oublie.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: '../login/login.component.scss',
})
export class MotDePasseOublieComponent {
  private authService = inject(AuthService);

  readonly email = signal('');
  readonly sent = signal(false);
  readonly loading = signal(false);
  readonly errorMessage = signal('');

  async onSubmit() {
    this.errorMessage.set('');
    if (!this.email().trim()) {
      this.errorMessage.set('Indiquez votre adresse e-mail.');
      return;
    }
    this.loading.set(true);
    const { error } = await this.authService.sendPasswordRecovery(this.email().trim());
    this.loading.set(false);
    if (error) {
      this.errorMessage.set(error.message);
    } else {
      this.sent.set(true);
    }
  }
}
