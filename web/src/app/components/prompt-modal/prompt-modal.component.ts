import { Component, signal, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

interface RuleItem {
  id: string;
  title: string;
  description: string;
  rule_text: string;
  active: boolean;
}

const DEFAULT_RULES: Record<string, RuleItem[]> = {
  system_role: [
    {
      id: 'role_architect',
      title: 'Ведущий системный архитектор (Principal Architect)',
      description: 'Позиционирует ИИ как высококлассного системного архитектора с фокусом на чистый разделенный дизайн.',
      rule_text: 'You are a Principal Software Architect and Systems Synthesizer with expertise in modular design, clean code metrics, and structural decoupling.',
      active: true
    },
    {
      id: 'role_security',
      title: 'Специалист по информационной безопасности',
      description: 'Настраивает ИИ на глубокий поиск логических уязвимостей, утечек памяти и векторов атак.',
      rule_text: 'You are an Elite Security Researcher, Forensic Debugger, and QA Engineer specializing in threat modeling, boundary verification, and locating logical security exploits.',
      active: false
    }
  ],
  interaction_protocol: [
    {
      id: 'protocol_architect_mode',
      title: 'Сначала план (Architect Mode)',
      description: 'Категорически запрещает ИИ писать код на первом шаге. Обязывает составить правила самоконтроля, план и ждать одобрения.',
      rule_text: 'Do NOT generate any code blocks or file modifications in your first response. First, output a <self_rules> block defining your operational guidelines based on the tech stack, followed by an <analysis_and_plan> block tracing entry points and outlining a step-by-step roadmap. End with an explicit checkpoint waiting for the user to approve Phase 1 before coding.',
      active: true
    },
    {
      id: 'protocol_step_by_step',
      title: 'Пошаговая сверка изменений',
      description: 'Обязывает ИИ выводить код строго по одной логической части за раз и ждать подтверждения.',
      rule_text: 'Provide code modifications strictly one logical module or file at a time. After writing code for a step, halt immediately and ask the user to verify the changes and run tests before moving to the next phase in the plan.',
      active: true
    }
  ],
  quality_standards: [
    {
      id: 'quality_no_placeholders',
      title: 'Строгий запрет заглушек (No Placeholders)',
      description: 'Запрещает ИИ писать неполный код с комментариями вида "// ... остальной код без изменений".',
      rule_text: 'Do not write code blocks containing placeholder comments like \'// ... rest of code\' or \'// TODO: keep original logic\'. All generated code must be complete, syntactically valid, and ready to compile.',
      active: true
    }
  ],
  version_alignment: [
    {
      id: 'version_live_sync',
      title: 'Живая синхронизация версий (Live-Version Shield)',
      description: 'Обязывает ИИ прочитать версии из манифестов и использовать актуальный синтаксис.',
      rule_text: 'First, scan dependency manifests (e.g., requirements.txt, package.json, go.mod, Cargo.toml) in the repository to identify active library versions. Align modern API syntaxes with active versions.',
      active: true
    }
  ]
};

@Component({
  selector: 'app-prompt-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './prompt-modal.component.html',
  styleUrl: './prompt-modal.component.scss'
})
export class PromptModalComponent {
  readonly isOpen = signal<boolean>(false);
  readonly promptSaved = output<{ key: string; title: string; prompt: string }>();

  mode: 'edit' | 'create' = 'edit';
  promptKey = '';
  titleInput = '';
  promptTextInput = '';

  categoryList = [
    { key: 'system_role', title: 'Роль ИИ' },
    { key: 'interaction_protocol', title: 'Протокол диалога' },
    { key: 'quality_standards', title: 'Стандарты качества' },
    { key: 'version_alignment', title: 'Синхронизация версий' }
  ];
  activeCategory = 'system_role';
  rulesData: Record<string, RuleItem[]> = JSON.parse(JSON.stringify(DEFAULT_RULES));

  openEdit(key: string, title: string, promptText: string): void {
    this.mode = 'edit';
    this.promptKey = key;
    this.titleInput = title;
    this.promptTextInput = promptText;
    this.isOpen.set(true);
  }

  openCreate(): void {
    this.mode = 'create';
    this.promptKey = `custom_${Date.now()}`;
    this.titleInput = '';
    this.promptTextInput = '';
    this.rulesData = JSON.parse(JSON.stringify(DEFAULT_RULES));
    this.isOpen.set(true);
  }

  close(): void {
    this.isOpen.set(false);
  }

  getRulesForCategory(catKey: string): RuleItem[] {
    return this.rulesData[catKey] || [];
  }

  toggleRuleActive(rule: RuleItem): void {
    rule.active = !rule.active;
  }

  compilePrompt(): string {
    const lines: string[] = [];
    const mapping: Record<string, string> = {
      system_role: 'expert_role',
      interaction_protocol: 'interaction_protocol',
      quality_standards: 'code_generation_standards',
      version_alignment: 'technology_alignment'
    };

    for (const [catKey, xmlTag] of Object.entries(mapping)) {
      const activeRules = (this.rulesData[catKey] || []).filter(r => r.active);
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

  saveAndClose(): void {
    if (!this.titleInput.trim()) {
      alert('Укажите название скилла.');
      return;
    }

    const finalPrompt = this.mode === 'edit' ? this.promptTextInput : this.compilePrompt();

    this.promptSaved.emit({
      key: this.promptKey,
      title: this.titleInput.trim(),
      prompt: finalPrompt
    });

    this.close();
  }
}
