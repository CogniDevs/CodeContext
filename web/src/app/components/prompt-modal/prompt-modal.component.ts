import { Component, signal, output, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

interface RuleItem {
  id: string;
  title: string;
  description: string;
  rule_text: string;
  active: boolean;
}

@Component({
  selector: 'app-prompt-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './prompt-modal.component.html',
  styleUrl: './prompt-modal.component.scss'
})
export class PromptModalComponent implements OnInit {
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
  rulesData: Record<string, RuleItem[]> = {};
  defaultRulesResource: Record<string, RuleItem[]> = {};

  async ngOnInit(): Promise<void> {
    await this.loadDefaultRules();
  }

  private async loadDefaultRules(): Promise<void> {
    try {
      const res = await fetch('assets/resources/default_rules.json');
      if (res.ok) {
        const data = await res.json();
        this.defaultRulesResource = data;
        this.rulesData = JSON.parse(JSON.stringify(data));
      }
    } catch {

    }
  }

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
    if (Object.keys(this.defaultRulesResource).length > 0) {
      this.rulesData = JSON.parse(JSON.stringify(this.defaultRulesResource));
    }
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
