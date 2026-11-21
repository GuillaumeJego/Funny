import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { safeRedirect } from '../utils/redirect';

export const authGuard: CanActivateFn = async (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  const { user } = (await auth.getUser()).data;
  if (!user) {
    // ❌ Non connecté → connexion, puis retour à la page demandée (ex. lien d'une sortie).
    const redirect = safeRedirect(state?.url);
    return router.createUrlTree(['/login'], redirect ? { queryParams: { redirect } } : {});
  }
  if (!user.emailVerified) {
    return router.createUrlTree(['/verifier-email']); // ✉️ Adresse pas encore confirmée
  }
  return true; // ✅ Connecté et adresse confirmée → accès autorisé
};
