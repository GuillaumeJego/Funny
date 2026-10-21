import { provideRouter } from '@angular/router';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MotDePasseOublieComponent } from './mot-de-passe-oublie.component';
import { provideBackendTesting } from '../../../core/backend/testing/provide-backend-testing';

describe('MotDePasseOublieComponent', () => {
  let component: MotDePasseOublieComponent;
  let fixture: ComponentFixture<MotDePasseOublieComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [provideBackendTesting(), provideRouter([])],
      imports: [MotDePasseOublieComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(MotDePasseOublieComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('asks for an email before sending', async () => {
    await component.onSubmit();
    expect(component.errorMessage).toContain('adresse');
    expect(component.sent).toBe(false);
  });

  it('shows the same neutral message once the link is requested', async () => {
    component.email = 'quelquun@exemple.fr';
    await component.onSubmit();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.success').textContent).toContain(
      'Si un compte existe',
    );
  });
});
