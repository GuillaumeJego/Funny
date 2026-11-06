import { ChangeDetectionStrategy, Component, Input, OnInit } from '@angular/core';
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
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './admin-themes.component.scss',
})
export class AdminThemesComponent implements OnInit {
  /** Identifiant de l'admin connecté : propriétaire des images envoyées. */
  @Input({ required: true }) adminId = '';

  themes: ThemeRow[] = [];
  loading = true;
  busy = false;
  error = '';
  newName = '';
  newIcon = '';

  constructor(private themeService: ThemeService) {}

  async ngOnInit() {
    await this.load();
  }

  async load() {
    this.loading = true;
    const { data, error } = await this.themeService.getAllThemes();
    if (error) this.error = error.message;
    const opened = new Set(this.themes.filter((t) => t.open).map((t) => t.id));
    this.themes = await Promise.all(
      (data ?? []).map(async (t) => ({
        ...t,
        images: (await this.themeService.getThemeImages(t.id)).data ?? [],
        open: opened.has(t.id),
        editName: t.name,
        editIcon: t.icon,
      })),
    );
    this.loading = false;
  }

  private async run(action: () => Promise<{ error: { message: string } | null }>) {
    this.busy = true;
    this.error = '';
    const { error } = await action();
    this.busy = false;
    if (error) {
      this.error = error.message;
      return false;
    }
    return true;
  }

  async create() {
    if (!this.newName.trim()) return;
    const ok = await this.run(() =>
      this.themeService.createTheme(this.newName, this.newIcon || '🎯'),
    );
    if (ok) {
      this.newName = '';
      this.newIcon = '';
      await this.load();
    }
  }

  async save(theme: ThemeRow) {
    if (!theme.editName.trim()) return;
    const ok = await this.run(() =>
      this.themeService.updateTheme(theme.id, theme.editName, theme.editIcon || '🎯'),
    );
    if (ok) {
      theme.name = theme.editName.trim();
      theme.icon = theme.editIcon.trim() || '🎯';
    }
  }

  async remove(theme: ThemeRow) {
    if (await this.run(() => this.themeService.deleteTheme(theme.id))) {
      this.themes = this.themes.filter((t) => t.id !== theme.id);
    }
  }

  async addImage(theme: ThemeRow, event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      this.error = 'Image trop lourde : 5 Mo au maximum.';
      return;
    }
    let added: ThemeImage | null = null;
    await this.run(async () => {
      const result = await this.themeService.addThemeImage(this.adminId, theme.id, file);
      added = result.data;
      return result;
    });
    if (added) theme.images = [...theme.images, added];
  }

  async removeImage(theme: ThemeRow, image: ThemeImage) {
    if (await this.run(() => this.themeService.removeThemeImage(image.id))) {
      theme.images = theme.images.filter((i) => i.id !== image.id);
    }
  }
}
