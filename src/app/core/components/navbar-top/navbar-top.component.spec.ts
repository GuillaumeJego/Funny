import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NavbarTopComponent } from './navbar-top.component';
import { provideBackendTesting } from '../../backend/testing/provide-backend-testing';

describe('NavbarTopComponent', () => {
  let component: NavbarTopComponent;
  let fixture: ComponentFixture<NavbarTopComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [provideBackendTesting()],
      imports: [NavbarTopComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(NavbarTopComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
