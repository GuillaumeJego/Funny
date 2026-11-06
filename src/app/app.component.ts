import { Component, OnInit, ChangeDetectionStrategy, inject, signal } from '@angular/core';

import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { NavbarTopComponent } from './core/components/navbar-top/navbar-top.component';
import { NavbarMainComponent } from './core/components/navbar-main/navbar-main.component';
import { filter } from 'rxjs/operators';

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
      });
  }
}
