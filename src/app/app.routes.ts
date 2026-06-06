import { Routes } from '@angular/router';
import { LoginComponent } from './features/auth/login/login.component';
import { RegisterComponent } from './features/auth/register/register.component';
import { DashboardComponent } from './features/dashboard/dashboard.component';
import { EditProfileComponent } from './features/profile/edit-profile/edit-profile.component';
import { CreateSortieComponent } from './features/sorties/create-sortie/create-sortie.component';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: 'login', component: LoginComponent },
  { path: 'register', component: RegisterComponent },
  { path: 'dashboard', component: DashboardComponent, canActivate: [authGuard] },
  { path: 'profile/edit', component: EditProfileComponent, canActivate: [authGuard] },
  { path: 'sorties/creer', component: CreateSortieComponent, canActivate: [authGuard] },
];