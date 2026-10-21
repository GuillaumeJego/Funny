import { Component, ChangeDetectionStrategy } from '@angular/core';
import { LegalLayoutComponent } from './legal-layout.component';
import { LEGAL } from './legal-info';

@Component({
  selector: 'app-aide',
  standalone: true,
  imports: [LegalLayoutComponent],
  templateUrl: './aide.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class AideComponent {
  legal = LEGAL;
}
