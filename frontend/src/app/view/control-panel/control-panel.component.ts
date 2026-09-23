import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  effect,
  inject,
  OnInit,
  output,
  signal,
  viewChild,
} from '@angular/core';

import { PromptPreset, TransformOptions } from '@models/context.models';
import { ApiService } from '@services/api.service';
import { PlatformService } from '@services/platform.service';
import { StateService } from '@services/state.service';

const FALLBACK_PRESETS: PromptPreset[] = [
  { key: 'just_code', title: 'Только контекст (Без инструкций)', prompt: '' },
];

interface BudgetOption {
  label: string;
  value: number | null;
}

const BUDGET_OPTIONS: BudgetOption[] = [
  { label: 'Без ограничений', value: null },
  { label: '32,000 токенов', value: 32000 },
  { label: '64,000 токенов', value: 64000 },
  { label: '128,000 токенов', value: 128000 },
  { label: '200,000 токенов', value: 200000 },
];

type BooleanTransformOption =
  | 'xml_format'
  | 'strip_comments'
  | 'compress_whitespace'
  | 'sanitize_secrets'
  | 'skeleton_mode'
  | 'auto_watch'
  | 'git_diff_mode';

@Component({
  selector: 'app-control-panel',
  templateUrl: './control-panel.component.html',
  styleUrl: './control-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
})
export class ControlPanelComponent implements OnInit {
  protected readonly state = inject(StateService);
  protected readonly platform = inject(PlatformService);
  private readonly api = inject(ApiService);

  protected readonly logContainer =
    viewChild<ElementRef<HTMLTextAreaElement>>('logContainer');

  readonly addPromptRequested = output<void>();
  readonly editPromptRequested = output<PromptPreset>();

  readonly budgetOptions = BUDGET_OPTIONS;
  readonly promptPresets = signal<PromptPreset[]>(FALLBACK_PRESETS);
  readonly selectedPromptKey = signal<string>('just_code');

  readonly isGitDiffAvailable = computed<boolean>(() => {
    return this.platform.isDesktop();
  });

  readonly isDiffModeActive = computed<boolean>(() => {
    return this.state.transformOptions().git_diff_mode;
  });

  readonly logsText = computed<string>(() => {
    return this.state.workLogs().join('\n');
  });

  constructor() {
    effect(() => {
      this.state.workLogs();
      const elem = this.logContainer()?.nativeElement;
      if (elem) {
        setTimeout(() => {
          elem.scrollTop = elem.scrollHeight;
        }, 0);
      }
    });
  }

  ngOnInit(): void {
    this.loadPrompts();
  }

  protected onPromptChange(event: Event): void {
    const target = event.target as HTMLSelectElement | null;
    if (!target) {
      return;
    }
    const key = target.value;
    this.selectedPromptKey.set(key);
    const preset = this.promptPresets().find((p) => p.key === key);
    const systemPrompt = preset ? preset.prompt : '';

    this.state.transformOptions.update((opts) => ({
      ...opts,
      system_prompt: systemPrompt,
    }));
    this.state.schedulePayloadGeneration();
  }

  protected onBudgetChange(event: Event): void {
    const target = event.target as HTMLSelectElement | null;
    if (!target) {
      return;
    }
    const rawValue = target.value;
    const budget = rawValue === 'null' ? null : parseInt(rawValue, 10);

    this.state.transformOptions.update((opts) => ({
      ...opts,
      max_token_budget: budget,
    }));
    this.state.schedulePayloadGeneration();
  }

  protected updateBooleanOption(
    key: BooleanTransformOption,
    event: Event,
  ): void {
    const input = event.target as HTMLInputElement | null;
    if (!input) {
      return;
    }
    const value = input.checked;
    this.state.transformOptions.update((opts) => ({
      ...opts,
      [key]: value,
    }));
    this.state.schedulePayloadGeneration();
  }

  protected updateDiffLines(event: Event): void {
    const input = event.target as HTMLInputElement | null;
    if (!input) {
      return;
    }
    const val = parseInt(input.value, 10);
    const lines = isNaN(val) ? 3 : Math.max(0, Math.min(20, val));
    this.state.transformOptions.update((opts) => ({
      ...opts,
      git_diff_context_lines: lines,
    }));
    this.state.schedulePayloadGeneration();
  }

  protected onAddPrompt(): void {
    this.addPromptRequested.emit();
  }

  protected onEditPrompt(): void {
    const currentKey = this.selectedPromptKey();
    const current = this.promptPresets().find((p) => p.key === currentKey);
    if (current) {
      this.editPromptRequested.emit(current);
    }
  }

  protected onClearLogs(): void {
    this.state.clearLogs();
  }

  upsertPrompt(preset: PromptPreset): void {
    this.promptPresets.update((list) => {
      const idx = list.findIndex((p) => p.key === preset.key);
      if (idx >= 0) {
        const next = [...list];
        next[idx] = preset;
        return next;
      }
      return [...list, preset];
    });

    this.selectedPromptKey.set(preset.key);
    this.state.transformOptions.update((opts) => ({
      ...opts,
      system_prompt: preset.prompt,
    }));
    this.state.schedulePayloadGeneration();
  }

  private async loadPrompts(): Promise<void> {
    if (this.platform.isDesktop()) {
      this.api.getPrompts().subscribe({
        next: (data) => {
          const loaded: PromptPreset[] = Object.entries(data).map(
            ([key, item]) => ({
              key,
              title: item.title,
              prompt: item.prompt,
              custom: item.custom,
            }),
          );
          if (loaded.length > 0) {
            this.promptPresets.set(loaded);
          }
        },
        error: () => {
          this.loadFallbackPrompts();
        },
      });
    } else {
      this.loadFallbackPrompts();
    }
  }

  private async loadFallbackPrompts(): Promise<void> {
    try {
      const res = await fetch('assets/resources/default_prompts.json');
      if (res.ok) {
        const data: Record<
          string,
          { title: string; prompt: string; custom?: boolean }
        > = await res.json();
        const loaded: PromptPreset[] = Object.entries(data).map(
          ([key, item]) => ({
            key,
            title: item.title,
            prompt: item.prompt,
            custom: item.custom,
          }),
        );
        if (loaded.length > 0) {
          this.promptPresets.set(loaded);
        }
      }
    } catch {}
  }
}
