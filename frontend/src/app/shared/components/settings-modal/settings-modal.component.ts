import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';

import { Theme } from '@models/context.models';
import { ApiService } from '@services/api.service';
import { PlatformService } from '@services/platform.service';
import { StateService } from '@services/state.service';
import { ThemeService } from '@services/theme.service';

type SettingsTab = 'general' | 'extensions' | 'excludes' | 'gitignore';

interface SettingsPresetMap {
  [key: string]: string[];
}

@Component({
  selector: 'app-settings-modal',
  templateUrl: './settings-modal.component.html',
  styleUrl: './settings-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [ReactiveFormsModule],
})
export class SettingsModalComponent implements OnInit {
  protected readonly state = inject(StateService);
  protected readonly themeService = inject(ThemeService);
  private readonly platform = inject(PlatformService);
  private readonly api = inject(ApiService);

  protected readonly form = new FormGroup({
    useGitignore: new FormControl<boolean>(true, { nonNullable: true }),
    ignoreBinary: new FormControl<boolean>(true, { nonNullable: true }),
    ignoreLockfiles: new FormControl<boolean>(true, { nonNullable: true }),
    alwaysSendFullTree: new FormControl<boolean>(true, { nonNullable: true }),
    theme: new FormControl<Theme>('dark', { nonNullable: true }),
    newExt: new FormControl<string>('', { nonNullable: true }),
    newExclude: new FormControl<string>('', { nonNullable: true }),
  });

  readonly isOpen = signal<boolean>(false);
  readonly activeTab = signal<SettingsTab>('general');

  readonly presets = signal<SettingsPresetMap>({});
  readonly allExtensions = signal<string[]>([]);
  readonly activeExtensions = signal<Set<string>>(new Set<string>());
  readonly allExcludes = signal<string[]>([]);
  readonly activeExcludes = signal<Set<string>>(new Set<string>());
  readonly gitignoreDisabledRules = signal<string[]>([]);

  readonly presetKeys = computed<string[]>(() => Object.keys(this.presets()));

  ngOnInit(): void {
    this.loadDefaultSettings();
  }

  open(): void {
    const scan = this.state.scanOptions();
    const transform = this.state.transformOptions();

    this.form.patchValue({
      useGitignore: scan.use_gitignore,
      ignoreBinary: scan.ignore_binary,
      ignoreLockfiles: scan.ignore_lockfiles,
      alwaysSendFullTree: transform.always_send_full_tree,
      theme: this.themeService.currentTheme(),
      newExt: '',
      newExclude: '',
    });

    this.activeExtensions.set(new Set<string>(scan.whitelist_extensions));
    this.activeExcludes.set(new Set<string>(scan.manual_excludes));
    this.gitignoreDisabledRules.set([...scan.gitignore_disabled_rules]);
    this.activeTab.set('general');
    this.isOpen.set(true);
  }

  close(): void {
    this.isOpen.set(false);
  }

  protected setTab(tab: SettingsTab): void {
    this.activeTab.set(tab);
  }

  protected onPresetChange(event: Event): void {
    const target = event.target as HTMLSelectElement | null;
    if (!target) {
      return;
    }
    const presetName = target.value;
    const exts = this.presets()[presetName] ?? [];
    this.activeExtensions.set(new Set<string>(exts));
  }

  protected isExtActive(ext: string): boolean {
    return this.activeExtensions().has(ext);
  }

  protected toggleExt(ext: string): void {
    this.activeExtensions.update((set) => {
      const next = new Set<string>(set);
      if (next.has(ext)) {
        next.delete(ext);
      } else {
        next.add(ext);
      }
      return next;
    });
  }

  protected addCustomExtension(): void {
    const raw = this.form.controls.newExt.value.trim().toLowerCase();
    if (!raw) {
      return;
    }
    const clean = raw.startsWith('.') ? raw : `.${raw}`;

    this.allExtensions.update((list) =>
      list.includes(clean) ? list : [...list, clean],
    );
    this.activeExtensions.update((set) => new Set<string>(set).add(clean));
    this.form.controls.newExt.setValue('');
  }

  protected isExcludeActive(folder: string): boolean {
    return this.activeExcludes().has(folder);
  }

  protected toggleExclude(folder: string): void {
    this.activeExcludes.update((set) => {
      const next = new Set<string>(set);
      if (next.has(folder)) {
        next.delete(folder);
      } else {
        next.add(folder);
      }
      return next;
    });
  }

  protected addCustomExclude(): void {
    const clean = this.form.controls.newExclude.value.trim();
    if (!clean) {
      return;
    }

    this.allExcludes.update((list) =>
      list.includes(clean) ? list : [...list, clean],
    );
    this.activeExcludes.update((set) => new Set<string>(set).add(clean));
    this.form.controls.newExclude.setValue('');
  }

  protected removeGitignoreDisabledRule(rule: string): void {
    this.gitignoreDisabledRules.update((list) =>
      list.filter((r) => r !== rule),
    );
  }

  protected saveAndClose(): void {
    const raw = this.form.getRawValue();

    this.themeService.setTheme(raw.theme);

    this.state.scanOptions.update((opts) => ({
      ...opts,
      use_gitignore: raw.useGitignore,
      ignore_binary: raw.ignoreBinary,
      ignore_lockfiles: raw.ignoreLockfiles,
      whitelist_extensions: Array.from(this.activeExtensions()),
      manual_excludes: Array.from(this.activeExcludes()),
      gitignore_disabled_rules: this.gitignoreDisabledRules(),
    }));

    this.state.transformOptions.update((opts) => ({
      ...opts,
      always_send_full_tree: raw.alwaysSendFullTree,
    }));

    if (this.platform.isDesktop()) {
      const updatedSettings: Record<string, unknown> = {
        use_gitignore: raw.useGitignore,
        ignore_binary: raw.ignoreBinary,
        ignore_lockfiles: raw.ignoreLockfiles,
        always_send_full_tree: raw.alwaysSendFullTree,
        theme: raw.theme,
        whitelist_extensions: Array.from(this.activeExtensions()),
        manual_excludes: Array.from(this.activeExcludes()),
        gitignore_disabled_rules: this.gitignoreDisabledRules(),
      };
      this.api.saveSettings(updatedSettings).subscribe();
    }

    this.state.generatePayload();
    this.close();
  }

  private async loadDefaultSettings(): Promise<void> {
    try {
      const res = await fetch('assets/resources/default_settings.json');
      if (res.ok) {
        const data: {
          presets?: SettingsPresetMap;
          all_known_extensions?: string[];
          global_excludes?: string[];
        } = await res.json();

        if (data.presets) {
          this.presets.set(data.presets);
        }

        const currentActiveExts = this.state.scanOptions().whitelist_extensions;
        const loadedExts = data.all_known_extensions ?? [];
        this.allExtensions.set(
          Array.from(new Set<string>([...loadedExts, ...currentActiveExts])),
        );

        const currentActiveExcludes = this.state.scanOptions().manual_excludes;
        const loadedExcludes = data.global_excludes ?? [];
        this.allExcludes.set(
          Array.from(
            new Set<string>([...loadedExcludes, ...currentActiveExcludes]),
          ),
        );
      }
    } catch {}
  }
}
