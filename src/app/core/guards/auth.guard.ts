import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { SupabaseService } from '../services/supabase.service';

export const authGuard: CanActivateFn = async (route, state) => {
  const supabase = inject(SupabaseService);
  const router = inject(Router);

  const { data: { session } } = await supabase.client.auth.getSession();

  if (session) {
    return true; // ✅ Connecté → accès autorisé
  } else {
    router.navigate(['/login']); // ❌ Non connecté → redirigé
    return false;
  }
};