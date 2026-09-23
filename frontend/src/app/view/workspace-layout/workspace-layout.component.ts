import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnInit,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, EMPTY, tap } from 'rxjs';

import { PromptPreset, WatcherEvent } from '@models/context.models';
import { ApiService } from '@services/api.service';
import { FileSystemService } from '@services/file-system.service';
import { PlatformService } from '@services/platform.service';
import { StateService } from '@services/state.service';
import { PromptModalComponent } from '@shared/components/prompt-modal/prompt-modal.component';
import { SettingsModalComponent } from '@shared/components/settings-modal/settings-modal.component';
import { ControlPanelComponent } from '@view/control-panel/control-panel.component';
import { FooterComponent } from '@view/footer/footer.component';
import { HeaderComponent } from '@view/header/header.component';
import { PathsPanelComponent } from '@view/paths-panel/paths-panel.component';
import { TreePanelComponent } from '@view/tree-panel/tree-panel.component';

@Component({
  selector: 'app-workspace-layout',
  templateUrl: './workspace-layout.component.html',
  styleUrl: './workspace-layout.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    HeaderComponent,
    PathsPanelComponent,
    TreePanelComponent,
    ControlPanelComponent,
    FooterComponent,
    PromptModalComponent,
    SettingsModalComponent,
  ],
})
export class WorkspaceLayoutComponent implements OnInit {
  protected readonly fileSystemService = inject(FileSystemService);
  protected readonly stateService = inject(StateService);
  protected readonly platformService = inject(PlatformService);
  private readonly apiService = inject(ApiService);

  protected readonly promptModal =
    viewChild.required<PromptModalComponent>('promptModal');
  protected readonly settingsModal =
    viewChild.required<SettingsModalComponent>('settingsModal');
  protected readonly controlPanel =
    viewChild<ControlPanelComponent>('controlPanel');

  readonly isDragOver = signal<boolean>(false);

  constructor() {
    if (this.platformService.isDesktop()) {
      this.apiService
        .watchFileEvents()
        .pipe(
          tap((event: WatcherEvent) => {
            if (this.stateService.transformOptions().auto_watch ?? true) {
              const relPath = event.path
                ? event.path.replace(/\\/g, '/').split('/').pop()
                : '';
              this.stateService.appendLog(
                relPath
                  ? `Авто-слежение: зафиксировано изменение '${relPath}'`
                  : 'Авто-слежение: зафиксированы изменения в проекте',
              );
              this.stateService.schedulePayloadGeneration();
            }
          }),
          catchError(() => EMPTY),
          takeUntilDestroyed(),
        )
        .subscribe();
    }
  }

  ngOnInit(): void {}

  protected onOpenSettings(): void {
    this.settingsModal().open();
  }

  protected onAddPrompt(): void {
    this.promptModal().openCreate();
  }

  protected onEditPrompt(preset: PromptPreset): void {
    this.promptModal().openEdit(preset);
  }

  protected onPromptSaved(preset: PromptPreset): void {
    const panel = this.controlPanel();
    if (panel) {
      panel.upsertPrompt(preset);
    }
  }

  protected onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver.set(true);
  }

  protected onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver.set(false);
  }

  protected async onDrop(event: DragEvent): Promise<void> {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver.set(false);

    const transfer = event.dataTransfer;
    if (!transfer) {
      return;
    }

    if (transfer.items && transfer.items.length > 0) {
      const res = await this.fileSystemService.readFromDataTransfer(
        transfer.items,
        this.stateService.scanOptions(),
      );
      if (res.rootNode) {
        this.stateService.setRootNode(res.rootNode);
        this.stateService.setProjectGitignoreRules(res.gitignoreRules);
        await this.stateService.generatePayload();
      }
    } else if (transfer.files && transfer.files.length > 0) {
      const res = await this.fileSystemService.readFromFiles(
        transfer.files,
        this.stateService.scanOptions(),
      );
      if (res.rootNode) {
        this.stateService.setRootNode(res.rootNode);
        this.stateService.setProjectGitignoreRules(res.gitignoreRules);
        await this.stateService.generatePayload();
      }
    }
  }
}
