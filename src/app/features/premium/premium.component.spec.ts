import { provideRouter } from '@angular/router';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PremiumComponent } from './premium.component';
import { provideBackendTesting } from '../../core/backend/testing/provide-backend-testing';
import { BillingRepository } from '../../core/repositories/billing.repository';

describe('PremiumComponent', () => {
  let fixture: ComponentFixture<PremiumComponent>;
  let checkout: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    checkout = vi.fn(async () => ({ data: null, error: { message: 'Paiement indisponible.' } }));
    await TestBed.configureTestingModule({
      providers: [
        provideBackendTesting(),
        provideRouter([]),
        {
          provide: BillingRepository,
          useValue: {
            checkout,
            portal: async () => ({ data: null, error: null }),
            getSubscription: async () => ({ data: null, error: null }),
          },
        },
      ],
      imports: [PremiumComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(PremiumComponent);
    await fixture.componentInstance.ngOnInit();
    fixture.detectChanges();
  });

  const button = () => fixture.nativeElement.querySelector('.btn-subscribe') as HTMLButtonElement;

  it('keeps the subscribe button disabled until the withdrawal waiver is ticked', async () => {
    expect(button().disabled).toBe(true);
    await fixture.componentInstance.onSubscribe();
    expect(checkout).not.toHaveBeenCalled();
  });

  it('asks the server for the chosen plan with the waiver and shows its error', async () => {
    fixture.componentInstance.waiver = true;
    fixture.componentInstance.selectPlan(0);
    await fixture.componentInstance.onSubscribe();
    fixture.detectChanges();
    expect(checkout).toHaveBeenCalledWith('mensuel', true, window.location.origin);
    expect(fixture.nativeElement.querySelector('.error').textContent).toContain(
      'Paiement indisponible',
    );
  });
});
