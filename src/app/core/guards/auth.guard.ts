import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  const { user } = (await auth.getUser()).data;
  if (!user) {
    return router.createUrlTree(['/login']); // ❌ Non connecté → redirigé
  }
  if (!user.emailVerified) {
    return router.createUrlTree(['/verifier-email']); // ✉️ Adresse pas encore confirmée
  }
  return true; // ✅ Connecté et adresse confirmée → accès autorisé
};
