import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  output,
  signal,
} from '@angular/core';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';

import { PromptPreset, RuleItem } from '@models/context.models';
import { ApiService } from '@services/api.service';
import { PlatformService } from '@services/platform.service';

interface CategoryTab {
  key: string;
  title: string;
}

const CATEGORY_TABS: CategoryTab[] = [
  { key: 'system_role', title: 'Роль ИИ' },
  { key: 'interaction_protocol', title: 'Протокол диалога' },
  { key: 'quality_standards', title: 'Стандарты качества' },
  { key: 'version_alignment', title: 'Синхронизация версий' },
];

const XML_TAG_MAP: Record<string, string> = {
  system_role: 'expert_role',
  interaction_protocol: 'interaction_protocol',
  quality_standards: 'code_generation_standards',
  version_alignment: 'technology_alignment',
};

@Component({
  selector: 'app-prompt-modal',
  templateUrl: './prompt-modal.component.html',
  styleUrl: './prompt-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [ReactiveFormsModule],
})
export class PromptModalComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly platform = inject(PlatformService);

  readonly promptSaved = output<PromptPreset>();

  protected readonly categories = CATEGORY_TABS;

  protected readonly form = new FormGroup({
    title: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    promptText: new FormControl<string>('', { nonNullable: true }),
  });

  readonly isOpen = signal<boolean>(false);
  readonly mode = signal<'edit' | 'create'>('edit');
  readonly activeCategory = signal<string>('system_role');
  readonly rulesData = signal<Record<string, RuleItem[]>>({});

  private readonly currentPromptKey = signal<string>('');
  private defaultRulesSnapshot: Record<string, RuleItem[]> = {};

  readonly currentCategoryRules = computed<RuleItem[]>(() => {
    return this.rulesData()[this.activeCategory()] ?? [];
  });

  readonly isSaveDisabled = computed<boolean>(() => {
    return this.form.controls.title.value.trim().length === 0;
  });

  ngOnInit(): void {
    this.loadInitialRules();
  }

  openEdit(preset: PromptPreset): void {
    this.mode.set('edit');
    this.currentPromptKey.set(preset.key);
    this.form.patchValue({
      title: preset.title,
      promptText: preset.prompt,
    });
    this.isOpen.set(true);
  }

  openCreate(): void {
    this.mode.set('create');
    this.currentPromptKey.set(`custom_${Date.now()}`);
    this.form.reset({ title: '', promptText: '' });
    if (Object.keys(this.defaultRulesSnapshot).length > 0) {
      this.rulesData.set(JSON.parse(JSON.stringify(this.defaultRulesSnapshot)));
    }
    this.isOpen.set(true);
  }

  close(): void {
    this.isOpen.set(false);
  }

  protected setCategory(key: string): void {
    this.activeCategory.set(key);
  }

  protected toggleRule(ruleId: string): void {
    const cat = this.activeCategory();
    this.rulesData.update((prev) => {
      const catRules = prev[cat] ?? [];
      const updated = catRules.map((r) =>
        r.id === ruleId ? { ...r, active: !r.active } : r,
      );
      return { ...prev, [cat]: updated };
    });
  }

  protected onSave(): void {
    if (this.isSaveDisabled()) {
      return;
    }

    const raw = this.form.getRawValue();
    const promptContent =
      this.mode() === 'edit' ? raw.promptText : this.compileLocalPrompt();

    const preset: PromptPreset = {
      key: this.currentPromptKey(),
      title: raw.title.trim(),
      prompt: promptContent,
      custom: true,
    };

    if (this.platform.isDesktop()) {
      this.api.updatePrompt(preset).subscribe({
        next: () => {
          this.promptSaved.emit(preset);
          this.close();
        },
        error: () => {
          this.promptSaved.emit(preset);
          this.close();
        },
      });
    } else {
      this.promptSaved.emit(preset);
      this.close();
    }
  }

  private async loadInitialRules(): Promise<void> {
    try {
      const res = await fetch('assets/resources/default_rules.json');
      if (res.ok) {
        const data: Record<string, RuleItem[]> = await res.json();
        this.defaultRulesSnapshot = data;
        this.rulesData.set(JSON.parse(JSON.stringify(data)));
      }
    } catch {}
  }

  private compileLocalPrompt(): string {
    const lines: string[] = [];
    const data = this.rulesData();

    for (const [catKey, xmlTag] of Object.entries(XML_TAG_MAP)) {
      const activeRules = (data[catKey] ?? []).filter((r) => r.active);
      if (activeRules.length > 0) {
        lines.push(`<${xmlTag}>`);
        for (const r of activeRules) {
          lines.push(`  - ${r.rule_text}`);
        }
        lines.push(`</${xmlTag}>\n`);
      }
    }

    return lines.join('\n').trim();
  }
}
