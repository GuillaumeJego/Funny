import { TestBed } from '@angular/core/testing';
import { AppComponent } from './app.component';
import { provideBackendTesting } from './core/backend/testing/provide-backend-testing';

describe('AppComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [provideBackendTesting()],
      imports: [AppComponent],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });
});
