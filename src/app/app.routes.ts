import { Routes } from '@angular/router';
import { LoginComponent } from './features/auth/login/login.component';
import { RegisterComponent } from './features/auth/register/register.component';
import { DashboardComponent } from './features/dashboard/dashboard.component';
import { EditProfileComponent } from './features/profile/edit-profile/edit-profile.component';
import { CreateSortieComponent } from './features/sorties/create-sortie/create-sortie.component';
import { PremiumComponent } from './features/premium/premium.component';
import { MesSortiesComponent } from './features/mes-sorties/mes-sorties.component';
import { MembresComponent } from './features/membres/membres.component';
import { NotificationsComponent } from './features/notifications/notifications.component';
import { authGuard } from './core/guards/auth.guard';
import { MembreProfileComponent } from './features/membre-profile/membre-profile.component';
import { AdminComponent } from './features/admin/admin.component';

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: 'login', component: LoginComponent },
  { path: 'register', component: RegisterComponent },
  { path: 'dashboard', component: DashboardComponent, canActivate: [authGuard] },
  { path: 'profile/edit', component: EditProfileComponent, canActivate: [authGuard] },
  { path: 'sorties/creer', component: CreateSortieComponent, canActivate: [authGuard] },
  { path: 'premium', component: PremiumComponent, canActivate: [authGuard] },
  { path: 'mes-sorties', component: MesSortiesComponent, canActivate: [authGuard] },
  { path: 'membres', component: MembresComponent, canActivate: [authGuard] },
  { path: 'notifications', component: NotificationsComponent, canActivate: [authGuard] },
  { path: 'membres/:id', component: MembreProfileComponent, canActivate: [authGuard] },
  { path: 'admin', component: AdminComponent, canActivate: [authGuard] },
];