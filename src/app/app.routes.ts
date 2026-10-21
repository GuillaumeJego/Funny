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
import { MessagesComponent } from './features/messages/messages.component';
import { ChatComponent } from './features/chat/chat.component';
import { AmisComponent } from './features/amis/amis.component';
import { MentionsLegalesComponent } from './features/legal/mentions-legales.component';
import { ConfidentialiteComponent } from './features/legal/confidentialite.component';
import { ConditionsComponent } from './features/legal/conditions.component';
import { AideComponent } from './features/legal/aide.component';
import { VerifierEmailComponent } from './features/auth/verifier-email/verifier-email.component';
import { MotDePasseOublieComponent } from './features/auth/mot-de-passe-oublie/mot-de-passe-oublie.component';
import { ReinitialiserMotDePasseComponent } from './features/auth/reinitialiser-mot-de-passe/reinitialiser-mot-de-passe.component';

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: 'login', component: LoginComponent },
  { path: 'register', component: RegisterComponent },
  // Liens reçus par e-mail : ouverts aussi sans session
  {
    path: 'verifier-email',
    component: VerifierEmailComponent,
    title: 'Confirmation de l’adresse · Funny',
  },
  {
    path: 'mot-de-passe-oublie',
    component: MotDePasseOublieComponent,
    title: 'Mot de passe oublié · Funny',
  },
  {
    path: 'reinitialiser-mot-de-passe',
    component: ReinitialiserMotDePasseComponent,
    title: 'Nouveau mot de passe · Funny',
  },
  // Pages publiques, lisibles sans compte
  {
    path: 'mentions-legales',
    component: MentionsLegalesComponent,
    title: 'Mentions légales · Funny',
  },
  {
    path: 'confidentialite',
    component: ConfidentialiteComponent,
    title: 'Confidentialité · Funny',
  },
  { path: 'conditions', component: ConditionsComponent, title: "Conditions d'utilisation · Funny" },
  { path: 'aide', component: AideComponent, title: 'Aide · Funny' },
  { path: 'dashboard', component: DashboardComponent, canActivate: [authGuard] },
  { path: 'profile/edit', component: EditProfileComponent, canActivate: [authGuard] },
  { path: 'sorties/creer', component: CreateSortieComponent, canActivate: [authGuard] },
  { path: 'premium', component: PremiumComponent, canActivate: [authGuard] },
  { path: 'mes-sorties', component: MesSortiesComponent, canActivate: [authGuard] },
  { path: 'membres', component: MembresComponent, canActivate: [authGuard] },
  { path: 'notifications', component: NotificationsComponent, canActivate: [authGuard] },
  { path: 'membres/:id', component: MembreProfileComponent, canActivate: [authGuard] },
  { path: 'admin', component: AdminComponent, canActivate: [authGuard] },
  { path: 'messages', component: MessagesComponent, canActivate: [authGuard] },
  { path: 'messages/:id', component: ChatComponent, canActivate: [authGuard] },
  { path: 'amis', component: AmisComponent, canActivate: [authGuard] },
];
