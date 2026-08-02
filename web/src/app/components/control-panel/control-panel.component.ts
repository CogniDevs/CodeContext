import { Component, inject, signal, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StateService } from '../../core/services/state.service';

export interface PromptPreset {
  key: string;
  title: string;
  prompt: string;
}

const DEFAULT_PRESETS: PromptPreset[] = [
  { key: 'just_code', title: 'Только контекст (Без инструкций)', prompt: '' },
  {
    key: 'refactor',
    title: 'Интерактивный рефакторинг и архитектурный аудит',
    prompt: 'You are a Principal Software Architect and clean code expert. First, scan manifests to identify active library versions.\n\nINTERACTION PROTOCOL:\n1. Do NOT generate refactored code blocks in your first response.\n2. Output a <self_rules> block followed by an <analysis_and_plan> roadmap.\n3. Wait for user approval before coding. Output in Russian.'
  },
  {
    key: 'bug_hunt',
    title: 'Интерактивный поиск багов и утечек',
    prompt: 'You are an Elite Security Researcher and Senior QA Engineer. First, scan manifests to identify active library versions.\n\nINTERACTION PROTOCOL:\n1. Do NOT write bugfixes in your first response.\n2. Output a <self_rules> block and <threat_modeling> plan.\n3. Wait for approval, then provide repairs one file at a time. Output in Russian.'
  },
  {
    key: 'explain_code',
    title: 'Интерактивный анализ и документирование',
    prompt: 'You are a Lead Systems Technical Writer. Map data flows and architectural boundaries. Stop and ask the user which modules to document first. Output in Russian.'
  },
  {
    key: 'unit_tests',
    title: 'Интерактивный генератор Unit-тестов',
    prompt: 'You are a Test Automation Architect. Isolate test scenarios and wait for user verification before writing complete mock scripts. Output in Russian.'
  }
];

@Component({
  selector: 'app-control-panel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './control-panel.component.html',
  styleUrl: './control-panel.component.scss'
})
export class ControlPanelComponent {
  readonly stateService = inject(StateService);

  readonly addPromptRequested = output<void>();
  readonly editPromptRequested = output<PromptPreset>();

  readonly promptPresets = signal<PromptPreset[]>(DEFAULT_PRESETS);
  selectedPromptKey = 'just_code';

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
