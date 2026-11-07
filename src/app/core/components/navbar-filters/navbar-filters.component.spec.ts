import { provideHttpClient, withXhr } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NavbarFiltersComponent, matchesPlace } from './navbar-filters.component';
import { provideBackendTesting } from '../../backend/testing/provide-backend-testing';

describe('NavbarFiltersComponent', () => {
  let component: NavbarFiltersComponent;
  let fixture: ComponentFixture<NavbarFiltersComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [
        provideBackendTesting(),
        provideHttpClient(withXhr()),
        provideHttpClientTesting(),
      ],
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

describe('matchesPlace', () => {
  // Saint-Malo, et Dinan à une vingtaine de km
  const f = { ou: 'Saint-Malo', autour: { km: 10, lat: 48.65, lng: -2.01 } };
  const dinan = { lat: 48.455, lng: -2.05, location: 'Rue du Quai, Dinan' };

  it('sans filtre de lieu, tout passe', () => {
    expect(matchesPlace(dinan, {})).toBe(true);
  });

  it('garde les sorties dans le rayon', () => {
    expect(matchesPlace(dinan, f)).toBe(false);
    expect(matchesPlace(dinan, { ...f, autour: { ...f.autour, km: 30 } })).toBe(true);
  });

  it('sans position, la sortie passe si son adresse cite la ville', () => {
    expect(matchesPlace({ location: 'Place Bouvet, Saint-Malo' }, f)).toBe(true);
    expect(matchesPlace({ location: 'Dinan' }, f)).toBe(false);
    expect(matchesPlace({ location: 'Saint-Malo' }, { autour: f.autour })).toBe(false);
  });
});
