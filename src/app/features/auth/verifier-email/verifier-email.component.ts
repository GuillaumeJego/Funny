import { Component, ChangeDetectionStrategy, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { MetanaCreditComponent } from '../../../core/components/metana-credit/metana-credit.component';

/**
 * Confirmation de l'adresse e-mail.
 * - Ouverte depuis le lien de l'e-mail (?userId=…&secret=…) : valide l'adresse, même sans session.
 * - Ouverte sans lien : rappelle au membre connecté de confirmer son adresse et permet de renvoyer l'e-mail.
 */
@Component({
  selector: 'app-verifier-email',
  standalone: true,
  imports: [RouterLink, MetanaCreditComponent],
  templateUrl: './verifier-email.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: '../login/login.component.scss',
})
export class VerifierEmailComponent implements OnInit {
  private authService = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  readonly state = signal<'loading' | 'pending' | 'confirmed' | 'error'>('loading');
  readonly email = signal('');
  /** Un e-mail vient de partir (à l'inscription ou avec le bouton « Renvoyer »). */
  readonly sent = signal(false);
  readonly sending = signal(false);
  readonly errorMessage = signal('');
  private readonly hasSession = signal(false);

  async ngOnInit() {
    const params = this.route.snapshot.queryParamMap;
    const userId = params.get('userId');
    const secret = params.get('secret');
    const { user } = (await this.authService.getUser()).data;
    this.hasSession.set(user !== null);

    if (userId && secret) {
      const { error } = await this.authService.confirmVerification(userId, secret);
      if (error) {
        this.errorMessage.set(error.message);
        this.state.set('error');
      } else {
        this.state.set('confirmed');
      }
      return;
    }

    if (!user) {
      this.router.navigate(['/login']);
      return;
    }
    if (user.emailVerified) {
      this.router.navigate(['/dashboard']);
      return;
    }
    this.email.set(user.email ?? '');
    this.sent.set(params.get('envoye') === '1');
    this.state.set('pending');
  }

  async resend() {
    this.sending.set(true);
    this.errorMessage.set('');
    const { error } = await this.authService.sendVerification();
    this.sending.set(false);
    if (error) {
      this.errorMessage.set(error.message);
    } else {
      this.sent.set(true);
    }
  }

  continue() {
    this.router.navigate(this.hasSession() ? ['/dashboard'] : ['/login'], {
      queryParams: this.hasSession() ? {} : { email: 'confirme' },
    });
  }

  async logout() {
    await this.authService.logout();
    this.router.navigate(['/login']);
  }
}
