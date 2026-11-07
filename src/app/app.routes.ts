import { Routes } from '@angular/router';
import { LoginComponent } from './features/auth/login/login.component';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: 'login', component: LoginComponent },
  {
    path: 'register',
    loadComponent: () =>
      import('./features/auth/register/register.component').then((m) => m.RegisterComponent),
  },
  // Liens reçus par e-mail : ouverts aussi sans session
  {
    path: 'verifier-email',
    loadComponent: () =>
      import('./features/auth/verifier-email/verifier-email.component').then(
        (m) => m.VerifierEmailComponent,
      ),
    title: 'Confirmation de l’adresse · Funny',
  },
  {
    path: 'mot-de-passe-oublie',
    loadComponent: () =>
      import('./features/auth/mot-de-passe-oublie/mot-de-passe-oublie.component').then(
        (m) => m.MotDePasseOublieComponent,
      ),
    title: 'Mot de passe oublié · Funny',
  },
  {
    path: 'reinitialiser-mot-de-passe',
    loadComponent: () =>
      import('./features/auth/reinitialiser-mot-de-passe/reinitialiser-mot-de-passe.component').then(
        (m) => m.ReinitialiserMotDePasseComponent,
      ),
    title: 'Nouveau mot de passe · Funny',
  },
  // Pages publiques, lisibles sans compte
  {
    path: 'mentions-legales',
    loadComponent: () =>
      import('./features/legal/mentions-legales.component').then((m) => m.MentionsLegalesComponent),
    title: 'Mentions légales · Funny',
  },
  {
    path: 'confidentialite',
    loadComponent: () =>
      import('./features/legal/confidentialite.component').then((m) => m.ConfidentialiteComponent),
    title: 'Confidentialité · Funny',
  },
  {
    path: 'conditions',
    loadComponent: () =>
      import('./features/legal/conditions.component').then((m) => m.ConditionsComponent),
    title: "Conditions d'utilisation · Funny",
  },
  {
    path: 'aide',
    loadComponent: () => import('./features/legal/aide.component').then((m) => m.AideComponent),
    title: 'Aide · Funny',
  },
  {
    path: 'dashboard',
    loadComponent: () =>
      import('./features/dashboard/dashboard.component').then((m) => m.DashboardComponent),
    canActivate: [authGuard],
  },
  {
    path: 'profile/edit',
    loadComponent: () =>
      import('./features/profile/edit-profile/edit-profile.component').then(
        (m) => m.EditProfileComponent,
      ),
    canActivate: [authGuard],
  },
  {
    path: 'sorties/creer',
    loadComponent: () =>
      import('./features/sorties/create-sortie/create-sortie.component').then(
        (m) => m.CreateSortieComponent,
      ),
    canActivate: [authGuard],
  },
  {
    // Même formulaire que la création, rempli avec la sortie à modifier.
    path: 'sorties/:id/modifier',
    loadComponent: () =>
      import('./features/sorties/create-sortie/create-sortie.component').then(
        (m) => m.CreateSortieComponent,
      ),
    canActivate: [authGuard],
  },
  {
    // Après une sortie : « avez-vous eu des affinités avec quelqu'un ? »
    path: 'sorties/:id/affinites',
    loadComponent: () =>
      import('./features/sorties/affinites/affinites.component').then((m) => m.AffinitesComponent),
    canActivate: [authGuard],
  },
  {
    path: 'premium',
    loadComponent: () =>
      import('./features/premium/premium.component').then((m) => m.PremiumComponent),
    canActivate: [authGuard],
  },
  {
    path: 'mes-sorties',
    loadComponent: () =>
      import('./features/mes-sorties/mes-sorties.component').then((m) => m.MesSortiesComponent),
    canActivate: [authGuard],
  },
  {
    path: 'membres',
    loadComponent: () =>
      import('./features/membres/membres.component').then((m) => m.MembresComponent),
    canActivate: [authGuard],
  },
  {
    path: 'notifications',
    loadComponent: () =>
      import('./features/notifications/notifications.component').then(
        (m) => m.NotificationsComponent,
      ),
    canActivate: [authGuard],
  },
  {
    path: 'membres/:id',
    loadComponent: () =>
      import('./features/membre-profile/membre-profile.component').then(
        (m) => m.MembreProfileComponent,
      ),
    canActivate: [authGuard],
  },
  {
    path: 'admin',
    loadComponent: () => import('./features/admin/admin.component').then((m) => m.AdminComponent),
    canActivate: [authGuard],
  },
  {
    path: 'messages',
    loadComponent: () =>
      import('./features/messages/messages.component').then((m) => m.MessagesComponent),
    canActivate: [authGuard],
  },
  {
    path: 'messages/:id',
    loadComponent: () => import('./features/chat/chat.component').then((m) => m.ChatComponent),
    canActivate: [authGuard],
  },
  {
    path: 'amis',
    loadComponent: () => import('./features/amis/amis.component').then((m) => m.AmisComponent),
    canActivate: [authGuard],
  },
];
