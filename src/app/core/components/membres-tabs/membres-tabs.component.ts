import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

/** Onglets « Tous les membres / Mes amis », en haut des pages Membres et Amis. */
@Component({
  selector: 'app-membres-tabs',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nav class="membres-tabs" aria-label="Membres">
      <a
        routerLink="/membres"
        [class.active]="active() === 'membres'"
        [attr.aria-current]="active() === 'membres' ? 'page' : null"
        >Tous les membres</a
      >
      <a
        routerLink="/amis"
        [class.active]="active() === 'amis'"
        [attr.aria-current]="active() === 'amis' ? 'page' : null"
        >Mes amis</a
      >
    </nav>
  `,
  styles: `
    @use 'tokens' as *;

    .membres-tabs {
      display: flex;
      gap: 0.3rem;
      padding: 0.3rem;
      margin-bottom: 1rem;
      background: $bg-white;
      border: 1px solid $border-color;
      border-radius: 14px;

      a {
        flex: 1;
        padding: 0.6rem 0.5rem;
        border-radius: 10px;
        text-align: center;
        font-size: 0.9rem;
        font-weight: 650;
        color: $text-light;
        text-decoration: none;
        transition:
          background 0.2s,
          color 0.2s;

        &:hover {
          color: $text-dark;
        }

        &.active {
          background: $primary;
          color: #fff;
        }
      }
    }
  `,
})
export class MembresTabsComponent {
  readonly active = input.required<'membres' | 'amis'>();
}
