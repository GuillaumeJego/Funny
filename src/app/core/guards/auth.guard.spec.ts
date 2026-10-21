import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  CanActivateFn,
  Router,
  RouterStateSnapshot,
} from '@angular/router';

import { authGuard } from './auth.guard';
import { provideBackendTesting } from '../backend/testing/provide-backend-testing';
import { AuthRepository } from '../repositories/auth.repository';
import { AuthUser } from '../repositories/repository.types';

describe('authGuard', () => {
  const executeGuard: CanActivateFn = (...guardParameters) =>
    TestBed.runInInjectionContext(() => authGuard(...guardParameters));
  const run = () =>
    executeGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot) as Promise<unknown>;

  function connectedAs(user: AuthUser | null) {
    const auth = { getUser: async () => ({ data: { user } }) } as Partial<AuthRepository>;
    TestBed.configureTestingModule({
      providers: [provideBackendTesting(), { provide: AuthRepository, useValue: auth }],
    });
  }
  const urlOf = (result: unknown) => TestBed.inject(Router).serializeUrl(result as never);

  it('renvoie vers la connexion sans session', async () => {
    connectedAs(null);
    expect(urlOf(await run())).toBe('/login');
  });

  it("renvoie vers la confirmation tant que l'adresse n'est pas confirmée", async () => {
    connectedAs({ id: 'u1', email: 'a@b.fr', emailVerified: false });
    expect(urlOf(await run())).toBe('/verifier-email');
  });

  it("laisse passer un membre dont l'adresse est confirmée", async () => {
    connectedAs({ id: 'u1', email: 'a@b.fr', emailVerified: true });
    expect(await run()).toBe(true);
  });
});
