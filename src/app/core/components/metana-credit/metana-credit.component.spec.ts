import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MetanaCreditComponent } from './metana-credit.component';

describe('MetanaCreditComponent', () => {
  let component: MetanaCreditComponent;
  let fixture: ComponentFixture<MetanaCreditComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MetanaCreditComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MetanaCreditComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
