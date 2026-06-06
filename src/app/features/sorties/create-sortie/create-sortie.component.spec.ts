import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CreateSortieComponent } from './create-sortie.component';

describe('CreateSortieComponent', () => {
  let component: CreateSortieComponent;
  let fixture: ComponentFixture<CreateSortieComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CreateSortieComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CreateSortieComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
