import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { NavbarTopComponent } from './core/components/navbar-top/navbar-top.component';
import { NavbarMainComponent } from './core/components/navbar-main/navbar-main.component';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, NavbarTopComponent, NavbarMainComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent implements OnInit {
  showNavbar = false;
  currentRoute = '';

  // Pages sans navbar (login et register)
  private noNavbarRoutes = ['/login', '/register'];

  constructor(private router: Router) {}

  ngOnInit() {
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: any) => {
      this.currentRoute = event.url;
      this.showNavbar = !this.noNavbarRoutes.includes(event.url);
    });
  }
}