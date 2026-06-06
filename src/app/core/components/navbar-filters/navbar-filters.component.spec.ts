import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NavbarFiltersComponent } from './navbar-filters.component';

describe('NavbarFiltersComponent', () => {
  let component: NavbarFiltersComponent;
  let fixture: ComponentFixture<NavbarFiltersComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NavbarFiltersComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(NavbarFiltersComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
