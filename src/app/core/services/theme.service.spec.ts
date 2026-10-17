import { TestBed } from '@angular/core/testing';

import { ThemeService } from './theme.service';
import { provideBackendTesting } from '../backend/testing/provide-backend-testing';

describe('ThemeService', () => {
  let service: ThemeService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideBackendTesting()] });
    service = TestBed.inject(ThemeService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
