import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-metana-credit',
  imports: [RouterLink],
  templateUrl: './metana-credit.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './metana-credit.component.scss',
})
export class MetanaCreditComponent {}
