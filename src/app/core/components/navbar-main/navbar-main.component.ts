import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { DrawerService } from '../../services/drawer.service';

@Component({
  selector: 'app-navbar-main',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './navbar-main.component.html',
  styleUrl: './navbar-main.component.scss'
})
export class NavbarMainComponent {

  navItems = [
    { icon: '🏠', label: 'Dashboard', route: '/dashboard' },
    { icon: '👥', label: 'Membres', route: '/membres' },
    { icon: '➕', label: 'Créer', route: '/sorties/creer' },
    { icon: '⭐', label: 'Mes sorties', route: '/mes-sorties' },
    { icon: '🔔', label: 'Notifications', route: '/notifications' },
  ];

  constructor(public router: Router, private drawerService: DrawerService) {}

  navigate(route: string) {
    this.drawerService.closeAll();
    this.router.navigate([route]);
  }

  isActive(route: string): boolean {
    return this.router.url === route;
  }
}