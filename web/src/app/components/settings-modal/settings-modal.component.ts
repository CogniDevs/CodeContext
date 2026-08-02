import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StateService } from '../../core/services/state.service';
import { ThemeService } from '../../core/services/theme.service';

const PRESETS: Record<string, string[]> = {
  'Все текстовые файлы (без ограничений)': [],
  'Python (Data Science, PyTorch, Jupyter)': ['.py', '.ipynb', '.csv', '.json', '.yaml', '.yml', '.md', '.txt'],
  'Python (FastAPI / Django / Flask)': ['.py', '.json', '.yaml', '.yml', '.ini', '.toml', '.md', '.txt'],
  'React / Next.js / Tailwind (TS / JS)': ['.ts', '.tsx', '.js', '.jsx', '.css', '.html', '.json', '.md', '.yaml', '.yml'],
  'Vue.js / Nuxt.js / Svelte': ['.vue', '.svelte', '.ts', '.js', '.css', '.html', '.json', '.md', '.yaml', '.yml'],
  'Go / Wails / REST APIs': ['.go', '.svelte', '.ts', '.js', '.css', '.html', '.json', '.md', '.toml', '.yaml', '.yml'],
  'Rust (Systems / WebAssembly)': ['.rs', '.toml', '.md', '.json', '.yaml', '.yml'],
  'C / C++ (Embedded & Systems)': ['.cpp', '.hpp', '.c', '.h', '.md', '.cmake', 'Makefile', 'CMakeLists.txt'],
  'Java / Spring Boot': ['.java', '.xml', '.properties', '.md', '.json', '.yaml', '.yml'],
  'Kotlin / Android (Gradle)': ['.kt', '.kts', '.xml', '.properties', '.gradle', '.md', '.json'],
  'C# / .NET / Web APIs': ['.cs', '.json', '.xml', '.config', '.md', '.yaml', '.yml', '.csproj', '.sln']
};

@Component({
  selector: 'app-settings-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './settings-modal.component.html',
  styleUrl: './settings-modal.component.scss'
})
export class SettingsModalComponent {
  readonly stateService = inject(StateService);
  readonly themeService = inject(ThemeService);

  readonly isOpen = signal<boolean>(false);
  activeTab: 'general' | 'extensions' | 'excludes' | 'gitignore' = 'general';

  useGitignore = true;
  ignoreBinary = true;
  ignoreLockfiles = true;
  alwaysSendFullTree = true;

  presetKeys = Object.keys(PRESETS);
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
    const exts = PRESETS[presetName] || [];
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
