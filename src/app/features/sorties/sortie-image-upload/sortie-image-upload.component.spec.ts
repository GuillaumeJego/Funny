import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SortieImageUploadComponent } from './sortie-image-upload.component';

describe('SortieImageUploadComponent', () => {
  let component: SortieImageUploadComponent;
  let fixture: ComponentFixture<SortieImageUploadComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SortieImageUploadComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SortieImageUploadComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
