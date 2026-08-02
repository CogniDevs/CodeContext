import { Component, inject, output } from '@angular/core';
import { ThemeService } from '../../core/services/theme.service';
import { FileSystemService } from '../../core/services/file-system.service';
import { StateService } from '../../core/services/state.service';

@Component({
  selector: 'app-header',
  standalone: true,
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss'
})
export class HeaderComponent {
  readonly themeService = inject(ThemeService);
  readonly fileSystemService = inject(FileSystemService);
  readonly stateService = inject(StateService);

  readonly openSettingsRequested = output<void>();

  async onOpenDirectory(): Promise<void> {
    try {
      await this.fileSystemService.openDirectoryPicker(this.stateService.scanOptions());
      await this.stateService.generatePayload();
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        alert(err?.message || 'Failed to open directory');
      }
    }
  }

  onFileInputChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.fileSystemService.readFromFiles(input.files, this.stateService.scanOptions()).then(() => {
        this.stateService.generatePayload();
      });
    }
  }

  onOpenSettings(): void {
    this.openSettingsRequested.emit();
  }

  toggleTheme(): void {
    this.themeService.toggleTheme();
  }
}
