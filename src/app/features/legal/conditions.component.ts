import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LegalLayoutComponent } from './legal-layout.component';
import { LEGAL } from './legal-info';

@Component({
  selector: 'app-conditions',
  standalone: true,
  imports: [LegalLayoutComponent, RouterLink],
  templateUrl: './conditions.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class ConditionsComponent {
  legal = LEGAL;
}
