import { TestBed } from '@angular/core/testing';
import { CanActivateFn } from '@angular/router';

import { authGuard } from './auth.guard';
import { provideBackendTesting } from '../backend/testing/provide-backend-testing';

describe('authGuard', () => {
  const executeGuard: CanActivateFn = (...guardParameters) =>
    TestBed.runInInjectionContext(() => authGuard(...guardParameters));

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideBackendTesting()] });
  });

  it('should be created', () => {
    expect(executeGuard).toBeTruthy();
  });
});
