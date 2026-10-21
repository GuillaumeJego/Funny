import { provideRouter } from '@angular/router';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MetanaCreditComponent } from './metana-credit.component';

describe('MetanaCreditComponent', () => {
  let component: MetanaCreditComponent;
  let fixture: ComponentFixture<MetanaCreditComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [provideRouter([])],
      imports: [MetanaCreditComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(MetanaCreditComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('links to the legal pages', () => {
    const links = [...fixture.nativeElement.querySelectorAll('.legal-links a')].map((a) =>
      a.getAttribute('href'),
    );
    expect(links).toEqual(['/mentions-legales', '/confidentialite', '/conditions', '/aide']);
  });
});
