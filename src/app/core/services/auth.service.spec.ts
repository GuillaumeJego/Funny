import { TestBed } from '@angular/core/testing';

import { AuthService } from './auth.service';
import { provideBackendTesting } from '../backend/testing/provide-backend-testing';

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideBackendTesting()] });
    service = TestBed.inject(AuthService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
