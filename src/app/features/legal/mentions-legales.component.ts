import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LegalLayoutComponent } from './legal-layout.component';
import { LEGAL } from './legal-info';

@Component({
  selector: 'app-mentions-legales',
  standalone: true,
  imports: [LegalLayoutComponent, RouterLink],
  templateUrl: './mentions-legales.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class MentionsLegalesComponent {
  legal = LEGAL;
}
