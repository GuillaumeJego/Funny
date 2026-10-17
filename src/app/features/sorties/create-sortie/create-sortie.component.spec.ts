import { provideHttpClient, withXhr } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CreateSortieComponent } from './create-sortie.component';
import { provideRouter } from '@angular/router';
import { provideBackendTesting } from '../../../core/backend/testing/provide-backend-testing';

describe('CreateSortieComponent', () => {
  let component: CreateSortieComponent;
  let fixture: ComponentFixture<CreateSortieComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [
        provideBackendTesting(),
        provideRouter([{ path: 'login', children: [] }]),
        provideHttpClient(withXhr()),
        provideHttpClientTesting(),
      ],
      imports: [CreateSortieComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(CreateSortieComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
