import { Component, inject, signal, output, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StateService } from '../../core/services/state.service';

export interface PromptPreset {
  key: string;
  title: string;
  prompt: string;
}

const FALLBACK_PRESETS: PromptPreset[] = [
  { key: 'just_code', title: 'Только контекст (Без инструкций)', prompt: '' }
];

@Component({
  selector: 'app-control-panel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './control-panel.component.html',
  styleUrl: './control-panel.component.scss'
})
export class ControlPanelComponent implements OnInit {
  readonly stateService = inject(StateService);

  readonly addPromptRequested = output<void>();
  readonly editPromptRequested = output<PromptPreset>();

  readonly promptPresets = signal<PromptPreset[]>(FALLBACK_PRESETS);
  selectedPromptKey = 'just_code';

  async ngOnInit(): Promise<void> {
    await this.loadDefaultPrompts();
  }

  private async loadDefaultPrompts(): Promise<void> {
    try {
      const res = await fetch('assets/resources/default_prompts.json');
      if (res.ok) {
        const data: Record<string, { title: string; prompt: string }> = await res.json();
        const loadedPresets: PromptPreset[] = Object.entries(data).map(([key, item]) => ({
          key,
          title: item.title,
          prompt: item.prompt
        }));
        if (loadedPresets.length > 0) {
          this.promptPresets.set(loadedPresets);
        }
      }
    } catch {

    }
  }

  updateOption(key: keyof ReturnType<typeof this.stateService.transformOptions>, value: boolean): void {
    this.stateService.transformOptions.update(opts => ({ ...opts, [key]: value }));
    this.stateService.generatePayload();
  }

  onPromptChange(key: string): void {
    this.selectedPromptKey = key;
    const preset = this.promptPresets().find(p => p.key === key);
    const systemPrompt = preset ? preset.prompt : '';

    this.stateService.transformOptions.update(opts => ({ ...opts, system_prompt: systemPrompt }));
    this.stateService.generatePayload();
  }

  onAddPrompt(): void {
    this.addPromptRequested.emit();
  }

  onEditPrompt(): void {
    const currentPreset = this.promptPresets().find(p => p.key === this.selectedPromptKey);
    if (currentPreset) {
      this.editPromptRequested.emit(currentPreset);
    }
  }

  upsertPrompt(preset: PromptPreset): void {
    this.promptPresets.update(list => {
      const idx = list.findIndex(p => p.key === preset.key);
      if (idx >= 0) {
        const next = [...list];
        next[idx] = preset;
        return next;
      }
      return [...list, preset];
    });

    this.selectedPromptKey = preset.key;
    this.onPromptChange(preset.key);
  }
}
