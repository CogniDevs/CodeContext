import { Component, inject, signal, ViewChild, OnInit } from '@angular/core';
import { HeaderComponent } from './components/header/header.component';
import { TreePanelComponent } from './components/tree-panel/tree-panel.component';
import { ControlPanelComponent, PromptPreset } from './components/control-panel/control-panel.component';
import { FooterComponent } from './components/footer/footer.component';
import { SettingsModalComponent } from './components/settings-modal/settings-modal.component';
import { PromptModalComponent } from './components/prompt-modal/prompt-modal.component';
import { WasmService } from './core/services/wasm.service';
import { FileSystemService } from './core/services/file-system.service';
import { StateService } from './core/services/state.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    HeaderComponent,
    TreePanelComponent,
    ControlPanelComponent,
    FooterComponent,
    SettingsModalComponent,
    PromptModalComponent
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent implements OnInit {
  readonly title = 'CodeContext';

  private readonly wasmService = inject(WasmService);
  private readonly fileSystemService = inject(FileSystemService);
  private readonly stateService = inject(StateService);

  readonly isDragOver = signal<boolean>(false);

  @ViewChild('settingsModal') settingsModal!: SettingsModalComponent;
  @ViewChild('promptModal') promptModal!: PromptModalComponent;
  @ViewChild('controlPanel') controlPanel!: ControlPanelComponent;

  async ngOnInit(): Promise<void> {
    await this.wasmService.init();
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver.set(true);
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver.set(false);
  }

  async onDrop(event: DragEvent): Promise<void> {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver.set(false);

    if (event.dataTransfer && event.dataTransfer.items) {
      await this.fileSystemService.readFromDataTransfer(
        event.dataTransfer.items,
        this.stateService.scanOptions()
      );
      this.stateService.selectAllFiles(true);
      await this.stateService.generatePayload();
    }
  }

  openSettingsModal(): void {
    this.settingsModal.open();
  }

  openAddPromptModal(): void {
    this.promptModal.openCreate();
  }

  openEditPromptModal(preset: PromptPreset): void {
    this.promptModal.openEdit(preset.key, preset.title, preset.prompt);
  }

  onPromptSaved(promptData: { key: string; title: string; prompt: string }): void {
    this.controlPanel.upsertPrompt({
      key: promptData.key,
      title: promptData.title,
      prompt: promptData.prompt
    });
  }
}
