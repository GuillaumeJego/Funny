import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DisplayMode, DisplayModeService } from '../../services/display-mode.service';

/** Choix du mode d'affichage : Lumineux ou Sombre. */
@Component({
  selector: 'app-display-mode-picker',
  standalone: true,
  template: `
    <div class="dm-picker" role="radiogroup" aria-label="Mode d'affichage">
      @for (opt of options; track opt.mode) {
        <button
          type="button"
          role="radio"
          class="dm-option"
          [class.active]="displayMode.mode() === opt.mode"
          [attr.aria-checked]="displayMode.mode() === opt.mode"
          (click)="choose(opt.mode)"
        >
          <span aria-hidden="true">{{ opt.icon }}</span> {{ opt.label }}
        </button>
      }
    </div>
  `,
  styles: `
    @use 'tokens' as *;
    .dm-picker {
      display: inline-flex;
      gap: 0.25rem;
      padding: 0.25rem;
      border-radius: 999px;
      background: $bg-elevated;
      border: 1px solid $border-color;
    }
    .dm-option {
      padding: 0.45rem 0.85rem;
      border: none;
      border-radius: 999px;
      background: transparent;
      color: $text-medium;
      font-size: 0.85rem;
      font-weight: 650;
      cursor: pointer;
      white-space: nowrap;
      transition:
        background 0.15s,
        color 0.15s;

      &.active {
        background: $primary;
        color: #fff;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DisplayModePickerComponent {
  readonly displayMode = inject(DisplayModeService);

  readonly options: { mode: DisplayMode; label: string; icon: string }[] = [
    { mode: 'light', label: 'Lumineux', icon: '☀️' },
    { mode: 'dark', label: 'Sombre', icon: '🌙' },
  ];

  choose(mode: DisplayMode) {
    this.displayMode.set(mode);
  }
}
