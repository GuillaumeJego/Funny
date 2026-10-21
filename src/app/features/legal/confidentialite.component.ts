import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LegalLayoutComponent } from './legal-layout.component';
import { LEGAL } from './legal-info';

@Component({
  selector: 'app-confidentialite',
  standalone: true,
  imports: [LegalLayoutComponent, RouterLink],
  templateUrl: './confidentialite.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class ConfidentialiteComponent {
  legal = LEGAL;
}
