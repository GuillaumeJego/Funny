import { ChangeDetectionStrategy, Component, OnInit, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Theme, ThemeImage } from '../../../core/models/theme.model';
import { ThemeService } from '../../../core/services/theme.service';

interface ThemeRow extends Theme {
  images: ThemeImage[];
  open: boolean;
  editName: string;
  editIcon: string;
}

/** Section « Thèmes » de l'espace admin : thèmes des sorties et leurs images par défaut. */
@Component({
  selector: 'app-admin-themes',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './admin-themes.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './admin-themes.component.scss',
})
export class AdminThemesComponent implements OnInit {
  private themeService = inject(ThemeService);

  /** Identifiant de l'admin connecté : propriétaire des images envoyées. */
  readonly adminId = input.required<string>();

  readonly themes = signal<ThemeRow[]>([]);
  readonly loading = signal(true);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly newName = signal('');
  readonly newIcon = signal('');

  async ngOnInit() {
    await this.load();
  }

  async load() {
    this.loading.set(true);
    const { data, error } = await this.themeService.getAllThemes();
    if (error) this.error.set(error.message);
    const opened = new Set(
      this.themes()
        .filter((t) => t.open)
        .map((t) => t.id),
    );
    this.themes.set(
      await Promise.all(
        (data ?? []).map(async (t) => ({
          ...t,
          images: (await this.themeService.getThemeImages(t.id)).data ?? [],
          open: opened.has(t.id),
          editName: t.name,
          editIcon: t.icon,
        })),
      ),
    );
    this.loading.set(false);
  }

  /** Remplace un thème de la liste par une copie modifiée : l'affichage suit le signal. */
  private patch(id: string, change: Partial<ThemeRow>) {
    this.themes.update((list) => list.map((t) => (t.id === id ? { ...t, ...change } : t)));
  }

  /** Ouvre ou ferme le détail d'un thème. */
  toggle(theme: ThemeRow) {
    this.patch(theme.id, { open: !theme.open });
  }

  private async run(action: () => Promise<{ error: { message: string } | null }>) {
    this.busy.set(true);
    this.error.set('');
    const { error } = await action();
    this.busy.set(false);
    if (error) {
      this.error.set(error.message);
      return false;
    }
    return true;
  }

  async create() {
    if (!this.newName().trim()) return;
    const ok = await this.run(() =>
      this.themeService.createTheme(this.newName(), this.newIcon() || '🎯'),
    );
    if (ok) {
      this.newName.set('');
      this.newIcon.set('');
      await this.load();
    }
  }

  async save(theme: ThemeRow) {
    if (!theme.editName.trim()) return;
    const ok = await this.run(() =>
      this.themeService.updateTheme(theme.id, theme.editName, theme.editIcon || '🎯'),
    );
    if (ok) {
      this.patch(theme.id, {
        name: theme.editName.trim(),
        icon: theme.editIcon.trim() || '🎯',
      });
    }
  }

  async remove(theme: ThemeRow) {
    if (await this.run(() => this.themeService.deleteTheme(theme.id))) {
      this.themes.set(this.themes().filter((t) => t.id !== theme.id));
    }
  }

  async addImage(theme: ThemeRow, event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      this.error.set('Image trop lourde : 5 Mo au maximum.');
      return;
    }
    let added: ThemeImage | null = null;
    await this.run(async () => {
      const result = await this.themeService.addThemeImage(this.adminId(), theme.id, file);
      added = result.data;
      return result;
    });
    const image: ThemeImage | null = added;
    if (image) this.patch(theme.id, { images: [...theme.images, image] });
  }

  async removeImage(theme: ThemeRow, image: ThemeImage) {
    if (await this.run(() => this.themeService.removeThemeImage(image.id))) {
      this.patch(theme.id, { images: theme.images.filter((i) => i.id !== image.id) });
    }
  }
}
