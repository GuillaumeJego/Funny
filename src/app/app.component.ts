import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';

import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { NavbarTopComponent } from './core/components/navbar-top/navbar-top.component';
import { NavbarMainComponent } from './core/components/navbar-main/navbar-main.component';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, NavbarTopComponent, NavbarMainComponent],
  templateUrl: './app.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './app.component.scss',
})
export class AppComponent implements OnInit {
  showNavbar = false;
  currentRoute = '';

  // Pages sans navbar : connexion, inscription, et pages légales (lisibles sans compte)
  private noNavbarRoutes = [
    '/login',
    '/register',
    '/mentions-legales',
    '/confidentialite',
    '/conditions',
    '/aide',
  ];

  constructor(private router: Router) {}

  ngOnInit() {
    this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe((event: any) => {
        this.currentRoute = event.url;
        this.showNavbar = !this.noNavbarRoutes.includes(event.url.split(/[?#]/)[0]);
      });
  }
}
