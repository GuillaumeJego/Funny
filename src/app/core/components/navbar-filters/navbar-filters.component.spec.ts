import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NavbarFiltersComponent } from './navbar-filters.component';

describe('NavbarFiltersComponent', () => {
  let component: NavbarFiltersComponent;
  let fixture: ComponentFixture<NavbarFiltersComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
      imports: [NavbarFiltersComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(NavbarFiltersComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
