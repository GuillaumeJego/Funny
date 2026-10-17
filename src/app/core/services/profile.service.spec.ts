import { TestBed } from '@angular/core/testing';

import { ProfileService } from './profile.service';
import { provideBackendTesting } from '../backend/testing/provide-backend-testing';

describe('ProfileService', () => {
  let service: ProfileService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideBackendTesting()] });
    service = TestBed.inject(ProfileService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
