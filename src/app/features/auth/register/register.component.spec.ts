import { provideRouter } from '@angular/router';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RegisterComponent } from './register.component';
import { provideBackendTesting } from '../../../core/backend/testing/provide-backend-testing';
import { AuthService } from '../../../core/services/auth.service';

describe('RegisterComponent', () => {
  let component: RegisterComponent;
  let fixture: ComponentFixture<RegisterComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [provideBackendTesting(), provideRouter([])],
      imports: [RegisterComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(RegisterComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('keeps the button disabled until both boxes are checked', () => {
    const button: HTMLButtonElement = fixture.nativeElement.querySelector('button');
    expect(button.disabled).toBe(true);
    component.adult = true;
    fixture.detectChanges();
    expect(button.disabled).toBe(true);
    component.acceptTerms = true;
    fixture.detectChanges();
    expect(button.disabled).toBe(false);
  });

  it('refuses a username with a space before creating the account', async () => {
    const register = vi.spyOn(TestBed.inject(AuthService), 'register');
    Object.assign(component, {
      username: 'compte test',
      email: 'test@exemple.fr',
      password: 'MotDePasse-2026!',
      confirmPassword: 'MotDePasse-2026!',
      adult: true,
      acceptTerms: true,
    });
    await component.onRegister();
    expect(register).not.toHaveBeenCalled();
    expect(component.errorMessage).toContain('Pseudo invalide');
  });
});
