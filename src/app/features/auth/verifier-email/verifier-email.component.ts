import { Component, ChangeDetectionStrategy, OnInit } from '@angular/core';
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
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: '../login/login.component.scss',
})
export class VerifierEmailComponent implements OnInit {
  state: 'loading' | 'pending' | 'confirmed' | 'error' = 'loading';
  email = '';
  /** Un e-mail vient de partir (à l'inscription ou avec le bouton « Renvoyer »). */
  sent = false;
  sending = false;
  errorMessage = '';
  private hasSession = false;

  constructor(
    private authService: AuthService,
    private router: Router,
    private route: ActivatedRoute,
  ) {}

  async ngOnInit() {
    const params = this.route.snapshot.queryParamMap;
    const userId = params.get('userId');
    const secret = params.get('secret');
    const { user } = (await this.authService.getUser()).data;
    this.hasSession = user !== null;

    if (userId && secret) {
      const { error } = await this.authService.confirmVerification(userId, secret);
      if (error) {
        this.errorMessage = error.message;
        this.state = 'error';
      } else {
        this.state = 'confirmed';
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
    this.email = user.email ?? '';
    this.sent = params.get('envoye') === '1';
    this.state = 'pending';
  }

  async resend() {
    this.sending = true;
    this.errorMessage = '';
    const { error } = await this.authService.sendVerification();
    this.sending = false;
    if (error) {
      this.errorMessage = error.message;
    } else {
      this.sent = true;
    }
  }

  continue() {
    this.router.navigate(this.hasSession ? ['/dashboard'] : ['/login'], {
      queryParams: this.hasSession ? {} : { email: 'confirme' },
    });
  }

  async logout() {
    await this.authService.logout();
    this.router.navigate(['/login']);
  }
}
