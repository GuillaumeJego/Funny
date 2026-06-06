import { TestBed } from '@angular/core/testing';

import { SortieService } from './sortie.service';

describe('SortieService', () => {
  let service: SortieService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(SortieService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
