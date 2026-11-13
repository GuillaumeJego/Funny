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
import { ActivityService } from './core/services/activity.service';
import { PresencesPromptComponent } from './features/sorties/presences/presences-prompt.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, NavbarTopComponent, NavbarMainComponent, PresencesPromptComponent],
  templateUrl: './app.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './app.component.scss',
})
export class AppComponent implements OnInit {
  private router = inject(Router);
  private activity = inject(ActivityService);

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
        if (this.showNavbar()) this.activity.pageShown(event.url);
      });
  }

  /** Retour sur l'onglet ou départ : statistiques de l'admin (connexions, pages vues). */
  @HostListener('document:visibilitychange')
  onVisibilityChange() {
    if (this.showNavbar()) this.activity.visibilityChanged(document.visibilityState === 'visible');
  }
}
