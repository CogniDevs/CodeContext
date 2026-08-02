import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StateService } from '../../core/services/state.service';
import { ThemeService } from '../../core/services/theme.service';

@Component({
  selector: 'app-settings-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './settings-modal.component.html',
  styleUrl: './settings-modal.component.scss'
})
export class SettingsModalComponent implements OnInit {
  readonly stateService = inject(StateService);
  readonly themeService = inject(ThemeService);

  readonly isOpen = signal<boolean>(false);
  activeTab: 'general' | 'extensions' | 'excludes' | 'gitignore' = 'general';

  useGitignore = true;
  ignoreBinary = true;
  ignoreLockfiles = true;
  alwaysSendFullTree = true;

  presets: Record<string, string[]> = {
    'Все текстовые файлы (без ограничений)': []
  };
  presetKeys: string[] = ['Все текстовые файлы (без ограничений)'];

  allExtensions: string[] = [
    '.py', '.ipynb', '.csv', '.go', '.svelte', '.ts', '.tsx', '.js', '.jsx',
    '.vue', '.astro', '.css', '.html', '.json', '.md', '.toml', '.yaml', '.yml',
    '.ini', '.txt', '.rs', '.cpp', '.hpp', '.c', '.h', '.cmake', '.java', '.kt',
    '.kts', '.xml', '.gradle', '.properties', '.cs', '.csproj', '.sln', '.php',
    '.dart', '.rb', '.ru', '.sh', '.bash', '.tf', '.tfvars', '.sql', '.plist', '.m'
  ];
  activeExtensions = new Set<string>();
  newExtInput = '';

  allExcludes: string[] = [
    '.git', '.idea', '.vscode', 'node_modules', 'dist', 'target', '.angular',
    'build', 'out', '__pycache__', '.venv', 'venv', 'coverage', '.next', '.nuxt'
  ];
  activeExcludes = new Set<string>();
  newExcludeInput = '';

  gitignoreDisabledRules: string[] = [];

  async ngOnInit(): Promise<void> {
    await this.loadDefaultSettingsResource();
  }

  private async loadDefaultSettingsResource(): Promise<void> {
    try {
      const res = await fetch('assets/resources/default_settings.json');
      if (res.ok) {
        const data = await res.json();
        if (data.presets) {
          this.presets = data.presets;
          this.presetKeys = Object.keys(data.presets);
        }
        if (data.all_known_extensions && Array.isArray(data.all_known_extensions)) {
          this.allExtensions = Array.from(new Set([...this.allExtensions, ...data.all_known_extensions]));
        }
        if (data.global_excludes && Array.isArray(data.global_excludes)) {
          this.allExcludes = Array.from(new Set([...this.allExcludes, ...data.global_excludes]));
        }
      }
    } catch {

    }
  }

  open(): void {
    const opts = this.stateService.scanOptions();
    this.useGitignore = opts.use_gitignore;
    this.ignoreBinary = opts.ignore_binary;
    this.ignoreLockfiles = opts.ignore_lockfiles;
    this.alwaysSendFullTree = this.stateService.transformOptions().always_send_full_tree;

    this.activeExtensions = new Set(opts.whitelist_extensions);
    this.activeExcludes = new Set(opts.manual_excludes);
    this.gitignoreDisabledRules = [...opts.gitignore_disabled_rules];

    this.isOpen.set(true);
  }

  close(): void {
    this.isOpen.set(false);
  }

  onPresetSelect(event: Event): void {
    const presetName = (event.target as HTMLSelectElement).value;
    const exts = this.presets[presetName] || [];
    this.activeExtensions = new Set(exts);
  }

  isExtActive(ext: string): boolean {
    return this.activeExtensions.has(ext);
  }

  toggleExt(ext: string): void {
    if (this.activeExtensions.has(ext)) {
      this.activeExtensions.delete(ext);
    } else {
      this.activeExtensions.add(ext);
    }
  }

  addCustomExtension(): void {
    let clean = this.newExtInput.trim().toLowerCase();
    if (!clean) return;
    if (!clean.startsWith('.')) {
      clean = '.' + clean;
    }
    if (!this.allExtensions.includes(clean)) {
      this.allExtensions.push(clean);
    }
    this.activeExtensions.add(clean);
    this.newExtInput = '';
  }

  isExcludeActive(folder: string): boolean {
    return this.activeExcludes.has(folder);
  }

  toggleExclude(folder: string): void {
    if (this.activeExcludes.has(folder)) {
      this.activeExcludes.delete(folder);
    } else {
      this.activeExcludes.add(folder);
    }
  }

  addCustomExclude(): void {
    const clean = this.newExcludeInput.trim();
    if (!clean) return;
    if (!this.allExcludes.includes(clean)) {
      this.allExcludes.push(clean);
    }
    this.activeExcludes.add(clean);
    this.newExcludeInput = '';
  }

  removeGitignoreDisabledRule(rule: string): void {
    this.gitignoreDisabledRules = this.gitignoreDisabledRules.filter(r => r !== rule);
  }

  saveAndClose(): void {
    this.stateService.scanOptions.update(opts => ({
      ...opts,
      use_gitignore: this.useGitignore,
      ignore_binary: this.ignoreBinary,
      ignore_lockfiles: this.ignoreLockfiles,
      whitelist_extensions: Array.from(this.activeExtensions),
      manual_excludes: Array.from(this.activeExcludes),
      gitignore_disabled_rules: this.gitignoreDisabledRules
    }));

    this.stateService.transformOptions.update(opts => ({
      ...opts,
      always_send_full_tree: this.alwaysSendFullTree
    }));

    this.stateService.generatePayload();
    this.close();
  }
}
