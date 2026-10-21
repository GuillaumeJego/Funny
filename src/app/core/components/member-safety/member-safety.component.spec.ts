import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MemberSafetyComponent } from './member-safety.component';
import { ModerationRepository } from '../../repositories/moderation.repository';
import { provideBackendTesting } from '../../backend/testing/provide-backend-testing';

describe('MemberSafetyComponent', () => {
  let component: MemberSafetyComponent;
  let fixture: ComponentFixture<MemberSafetyComponent>;
  let calls: string[];

  beforeEach(async () => {
    calls = [];
    await TestBed.configureTestingModule({
      providers: [
        provideBackendTesting(),
        {
          provide: ModerationRepository,
          useValue: {
            report: async (id: string, reason: string) => {
              calls.push(`report ${id} ${reason}`);
              return { data: null, error: null };
            },
            block: async (id: string) => {
              calls.push(`block ${id}`);
              return { data: null, error: null };
            },
            unblock: async () => ({ data: null, error: null }),
            getBlockedIds: async () => [],
          },
        },
      ],
      imports: [MemberSafetyComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(MemberSafetyComponent);
    component = fixture.componentInstance;
    component.memberId = 'bob';
    component.username = 'Bob';
    fixture.detectChanges();
  });

  it('sends a report with the chosen reason', async () => {
    component.open('report');
    component.reason = 'harcelement';
    await component.sendReport();
    expect(calls).toEqual(['report bob harcelement']);
    expect(component.dialog).toBe('reported');
  });

  it('blocks the member and tells the parent', async () => {
    const emitted: boolean[] = [];
    component.blockedChange.subscribe((v) => emitted.push(v));
    component.open('block');
    await component.confirmBlock();
    expect(calls).toEqual(['block bob']);
    expect(emitted).toEqual([true]);
    expect(component.dialog).toBeNull();
  });
});
