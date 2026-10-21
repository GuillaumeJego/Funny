import { provideRouter } from '@angular/router';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ReinitialiserMotDePasseComponent } from './reinitialiser-mot-de-passe.component';
import { provideBackendTesting } from '../../../core/backend/testing/provide-backend-testing';

describe('ReinitialiserMotDePasseComponent', () => {
  let fixture: ComponentFixture<ReinitialiserMotDePasseComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [provideBackendTesting(), provideRouter([])],
      imports: [ReinitialiserMotDePasseComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ReinitialiserMotDePasseComponent);
    fixture.detectChanges();
  });

  it('explains that a link without its parameters is incomplete', () => {
    expect(fixture.nativeElement.querySelector('.error').textContent).toContain('incomplet');
  });
});
