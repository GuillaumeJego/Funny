import { TestBed } from '@angular/core/testing';

import { SortieService } from './sortie.service';
import { provideBackendTesting } from '../backend/testing/provide-backend-testing';

describe('SortieService', () => {
  let service: SortieService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideBackendTesting()] });
    service = TestBed.inject(SortieService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
