import {
  Component,
  HostListener,
  OnInit,
  ChangeDetectionStrategy,
  inject,
  signal,
} from '@angular/core';

import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { NavbarTopComponent } from './core/components/navbar-top/navbar-top.component';
import { NavbarMainComponent } from './core/components/navbar-main/navbar-main.component';
import { filter } from 'rxjs/operators';
import { AuthService } from './core/services/auth.service';

/** Une nouvelle connexion est notée après 30 minutes sans revenir sur le site. */
const VISIT_GAP_MS = 30 * 60 * 1000;

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, NavbarTopComponent, NavbarMainComponent],
  templateUrl: './app.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './app.component.scss',
})
export class AppComponent implements OnInit {
  private router = inject(Router);
  private auth = inject(AuthService);
  private lastVisit = 0;
  private recording = false;

  readonly showNavbar = signal(false);
  readonly currentRoute = signal('');

  // Pages sans navbar : connexion, inscription, liens reçus par e-mail, et pages légales (lisibles sans compte)
  private noNavbarRoutes = [
    '/login',
    '/register',
    '/verifier-email',
    '/mot-de-passe-oublie',
    '/reinitialiser-mot-de-passe',
    '/mentions-legales',
    '/confidentialite',
    '/conditions',
    '/aide',
  ];

  ngOnInit() {
    this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe((event: any) => {
        this.currentRoute.set(event.url);
        this.showNavbar.set(!this.noNavbarRoutes.includes(event.url.split(/[?#]/)[0]));
        if (this.showNavbar()) this.recordVisit();
      });
  }

  /** Retour sur l'onglet (téléphone, autre fenêtre) : peut compter comme une nouvelle connexion. */
  @HostListener('document:visibilitychange')
  onVisibilityChange() {
    if (document.visibilityState === 'visible' && this.showNavbar()) this.recordVisit();
  }

  /** Statistiques de l'admin : le serveur ignore aussi les connexions trop rapprochées. */
  private async recordVisit() {
    const now = Date.now();
    if (this.recording || now - this.lastVisit < VISIT_GAP_MS) return;
    this.recording = true;
    // Pas encore connecté (page protégée avant redirection) : on réessaiera à la page suivante.
    if (await this.auth.recordVisit().catch(() => false)) this.lastVisit = now;
    this.recording = false;
  }
}
