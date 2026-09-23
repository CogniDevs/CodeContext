import { computed, effect, inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import {
  DependenciesRequest,
  FileNode,
  PayloadRequest,
  ScanOptions,
  StandaloneTreeRequest,
  TransformOptions,
} from '@models/context.models';
import { ApiService } from '@services/api.service';
import { FileSystemService } from '@services/file-system.service';
import { PlatformService } from '@services/platform.service';
import { WasmService } from '@services/wasm.service';

const STORAGE_KEY_SCAN = 'codecontext_scan_options';
const STORAGE_KEY_TRANSFORM = 'codecontext_transform_options';

const FALLBACK_SCAN_OPTIONS: ScanOptions = {
  use_gitignore: true,
  ignore_binary: true,
  ignore_lockfiles: true,
  whitelist_extensions: [],
  manual_excludes: [
    '.git',
    'node_modules',
    'dist',
    'target',
    '.angular',
    'build',
    'out',
    '__pycache__',
    '.venv',
    'venv',
    '.idea',
    '.vscode',
    'icon_data.py',
  ],
  gitignore_disabled_rules: [],
  binary_extensions: [
    '.png',
    '.jpg',
    '.jpeg',
    '.gif',
    '.ico',
    '.pdf',
    '.zip',
    '.exe',
    '.dll',
    '.so',
    '.dylib',
    '.wasm',
    '.svg',
  ],
  lockfiles_excludes: [
    'package-lock.json',
    'yarn.lock',
    'pnpm-lock.yaml',
    'Cargo.lock',
    'go.sum',
  ],
};

const FALLBACK_TRANSFORM_OPTIONS: TransformOptions = {
  strip_comments: false,
  compress_whitespace: false,
  sanitize_secrets: false,
  skeleton_mode: false,
  xml_format: true,
  always_send_full_tree: false,
  system_prompt: '',
  comment_rules_json: null,
  max_token_budget: null,
  git_diff_mode: false,
  git_diff_context_lines: 3,
  git_diff_text: null,
};

@Injectable({
  providedIn: 'root',
})
export class StateService {
  private readonly platform = inject(PlatformService);
  private readonly api = inject(ApiService);
  private readonly wasm = inject(WasmService);
  private readonly fileSystem = inject(FileSystemService);

  readonly scanOptions = signal<ScanOptions>(this.loadScanOptions());
  readonly transformOptions = signal<TransformOptions>(
    this.loadTransformOptions(),
  );

  readonly rootPath = signal<string>('');
  readonly exportPath = signal<string>('');
  readonly selectedPaths = signal<Set<string>>(new Set<string>());
  readonly expandedPaths = signal<Set<string>>(new Set<string>(['']));
  readonly focusedPath = signal<string | null>(null);
  readonly generatedPayload = signal<string>('');
  readonly isGenerating = signal<boolean>(false);
  readonly gitModifiedFiles = signal<string[]>([]);
  readonly workLogs = signal<string[]>(['CodeContext инициализирован.']);

  private generateTimer: ReturnType<typeof setTimeout> | null = null;

  readonly selectedFilesCount = computed<number>(
    () => this.selectedPaths().size,
  );

  readonly tokenCount = computed<number>(() => {
    const payload = this.generatedPayload();
    if (!payload || payload.startsWith('[')) {
      return 0;
    }
    return this.wasm.countTokens(payload);
  });

  readonly totalSizeBytes = computed<number>(() => {
    const root = this.fileSystem.rootNode();
    return root ? this.calculateSelectedSize(root) : 0;
  });

  readonly totalSizeKb = computed<number>(() => {
    return Math.round((this.totalSizeBytes() / 1024) * 10) / 10;
  });

  constructor() {
    this.loadResources();

    effect(() => {
      localStorage.setItem(
        STORAGE_KEY_SCAN,
        JSON.stringify(this.scanOptions()),
      );
    });

    effect(() => {
      localStorage.setItem(
        STORAGE_KEY_TRANSFORM,
        JSON.stringify(this.transformOptions()),
      );
    });

    effect(() => {
      if (this.fileSystem.rootNode()) {
        this.resetExpandedToRoot();
      }
    });

    effect(() => {
      const hasRoot =
        this.fileSystem.rootNode() !== null || this.rootPath().length > 0;
      const hasSelection = this.selectedPaths().size > 0;
      this.transformOptions();

      if (hasRoot && (hasSelection || this.transformOptions().git_diff_mode)) {
        this.schedulePayloadGeneration();
      } else {
        if (this.generateTimer) {
          clearTimeout(this.generateTimer);
        }
        this.generatedPayload.set('');
      }
    });
  }

  appendLog(message: string): void {
    const timeStr = new Date().toLocaleTimeString();
    this.workLogs.update((prev) => [...prev, `[${timeStr}] ${message}`]);
  }

  clearLogs(): void {
    this.workLogs.set([]);
  }

  setExportPath(path: string): void {
    this.exportPath.set(path);
  }

  setRootNode(node: FileNode | null, rootPath?: string): void {
    if (!node || typeof node !== 'object' || !node.name) {
      this.fileSystem.setRootNode(null);
      this.rootPath.set('');
      return;
    }

    if (!Array.isArray(node.children)) {
      node.children = [];
    }

    this.fileSystem.setRootNode(node, rootPath);
    if (rootPath) {
      this.rootPath.set(rootPath);
      const defaultExport = `${rootPath.replace(/[\\/]$/, '')}/code_context.txt`;
      this.exportPath.set(defaultExport);
      this.appendLog(`Rust Scan: ${rootPath}`);
    } else {
      this.rootPath.set(node.full_path || node.name);
      this.appendLog(`Web Scan: ${node.name}`);
    }
  }

  setRootPath(path: string): void {
    this.rootPath.set(path);
  }

  resetExpandedToRoot(): void {
    this.expandedPaths.set(new Set<string>(['']));
  }

  isPathExpanded(relPath: string): boolean {
    return this.expandedPaths().has(relPath);
  }

  togglePathExpansion(relPath: string, expand?: boolean): void {
    this.expandedPaths.update((set) => {
      const next = new Set<string>(set);
      const shouldExpand = expand !== undefined ? expand : !next.has(relPath);
      if (shouldExpand) {
        next.add(relPath);
      } else {
        next.delete(relPath);
      }
      return next;
    });
  }

  expandAllFolders(): void {
    const root = this.fileSystem.rootNode();
    if (!root) {
      return;
    }
    const allDirs = new Set<string>();
    this.collectAllDirPaths(root, allDirs);
    this.expandedPaths.set(allDirs);
  }

  collapseAllFolders(): void {
    this.resetExpandedToRoot();
  }

  setFocusedPath(relPath: string | null): void {
    this.focusedPath.set(relPath);
  }

  togglePathSelection(relPath: string, isSelected: boolean): void {
    this.selectedPaths.update((set) => {
      const next = new Set<string>(set);
      if (isSelected) {
        next.add(relPath);
      } else {
        next.delete(relPath);
      }
      return next;
    });
  }

  selectAllFiles(check: boolean): void {
    const root = this.fileSystem.rootNode();
    if (!root) {
      return;
    }

    const newSet = new Set<string>();
    if (check) {
      this.collectAllFilePaths(root, newSet);
    }
    this.selectedPaths.set(newSet);
    this.appendLog(
      check ? 'Выделены все файлы проекта.' : 'Выделение файлов снято.',
    );
  }

  selectGitModifiedFilesOnly(): void {
    const modified = this.gitModifiedFiles();
    if (modified.length === 0) {
      this.appendLog('Git: нет измененных файлов для выделения.');
      return;
    }

    const root = this.fileSystem.rootNode();
    if (!root) {
      return;
    }

    const availablePaths = new Set<string>();
    this.collectAllFilePaths(root, availablePaths);

    const matchingSet = new Set<string>();
    for (const modPath of modified) {
      if (availablePaths.has(modPath)) {
        matchingSet.add(modPath);
      }
    }
    this.selectedPaths.set(matchingSet);
    this.appendLog(
      `Git Status: выделено ${matchingSet.size} измененных файлов.`,
    );
  }

  schedulePayloadGeneration(): void {
    if (this.generateTimer) {
      clearTimeout(this.generateTimer);
    }
    this.generateTimer = setTimeout(() => {
      this.generatePayload();
    }, 250);
  }

  async fetchGitStatus(): Promise<void> {
    if (!this.platform.isDesktop() || !this.rootPath()) {
      return;
    }

    try {
      const res = await firstValueFrom(this.api.getGitStatus(this.rootPath()));
      if (res.success) {
        this.gitModifiedFiles.set(res.modified_files);
        this.appendLog(`Git Status: ${res.message}`);
      } else {
        this.gitModifiedFiles.set([]);
      }
    } catch {
      this.gitModifiedFiles.set([]);
    }
  }

  async traceDependenciesForFocusedFile(): Promise<number> {
    const focusedRelPath = this.focusedPath();
    const root = this.fileSystem.rootNode();
    const rootName = this.fileSystem.currentProjectName() || 'project';

    if (!focusedRelPath || !root) {
      return 0;
    }

    const focusedNode = this.findNodeByRelPath(root, focusedRelPath);
    if (!focusedNode || focusedNode.is_dir) {
      return 0;
    }

    const content = await this.fileSystem.getFileContent(focusedNode);

    let deps: string[] = [];
    if (this.platform.isDesktop() && this.rootPath()) {
      const req: DependenciesRequest = {
        root_dir: this.rootPath(),
        target_rel_path: focusedRelPath,
        content,
      };
      const res = await firstValueFrom(this.api.traceDependencies(req));
      deps = res.dependencies;
    } else {
      await this.wasm.init();
      const allPaths = this.getAllFilePaths(root);
      deps = this.wasm.traceDependencies(
        rootName,
        focusedRelPath,
        content,
        allPaths,
      );
    }

    if (deps && deps.length > 0) {
      this.selectedPaths.update((set) => {
        const next = new Set<string>(set);
        for (const dep of deps) {
          next.add(dep);
        }
        return next;
      });
      this.appendLog(
        `Импорты: выделено ${deps.length} зависимостей для '${focusedRelPath}'.`,
      );
      return deps.length;
    }

    return 0;
  }

  async copyStandaloneTree(): Promise<string> {
    const root = this.fileSystem.rootNode();
    const rootName =
      this.fileSystem.currentProjectName() ||
      (this.rootPath()
        ? this.rootPath().split(/[\\/]/).pop() || 'project'
        : 'project');
    const selectedSet = this.selectedPaths();
    const xml = this.transformOptions().xml_format;

    if (this.platform.isDesktop() && this.rootPath()) {
      const req: StandaloneTreeRequest = {
        root_name: rootName,
        root_node: root
          ? (this.fileSystem.cleanNodeForWasm(root) as Record<string, unknown>)
          : null,
        selected_paths: Array.from(selectedSet),
        xml_format: xml,
      };
      const res = await firstValueFrom(this.api.generateStandaloneTree(req));
      if (res.tree_text) {
        await navigator.clipboard.writeText(res.tree_text);
        this.appendLog('Скопирована только ASCII-структура проекта.');
        return res.tree_text;
      }
    } else {
      await this.wasm.init();
      const cleanedRoot = root ? this.fileSystem.cleanNodeForWasm(root) : null;
      const treeText = this.wasm.generateStandaloneTree(
        rootName,
        cleanedRoot ? JSON.stringify(cleanedRoot) : '',
        Array.from(selectedSet),
        xml,
      );
      if (treeText) {
        await navigator.clipboard.writeText(treeText);
        this.appendLog('Скопирована только ASCII-структура проекта (WASM).');
        return treeText;
      }
    }
    return '';
  }

  async generatePayload(): Promise<string> {
    const root = this.fileSystem.rootNode();
    const projectName = this.fileSystem.currentProjectName() || 'project';

    if (!root && !this.rootPath()) {
      this.generatedPayload.set('');
      return '';
    }

    const selectedSet = this.selectedPaths();
    if (selectedSet.size === 0 && !this.transformOptions().git_diff_mode) {
      this.generatedPayload.set('');
      return '';
    }

    this.isGenerating.set(true);

    try {
      if (this.platform.isDesktop() && this.rootPath()) {
        const req: PayloadRequest = {
          root_dir: this.rootPath(),
          root_node: root
            ? (this.fileSystem.cleanNodeForWasm(root) as Record<
                string,
                unknown
              >)
            : null,
          selected_paths: Array.from(selectedSet),
          options: this.transformOptions(),
        };

        const res = await firstValueFrom(this.api.buildPayload(req));
        this.generatedPayload.set(res.payload);
        return res.payload;
      }

      await this.wasm.init();

      if (root) {
        const filesToRead: FileNode[] = [];
        this.collectSelectedFileNodes(root, selectedSet, filesToRead);

        const filesPayload: Array<[string, string]> = [];
        const chunkSize = 15;
        for (let i = 0; i < filesToRead.length; i += chunkSize) {
          const chunk = filesToRead.slice(i, i + chunkSize);
          const chunkResults = await Promise.all(
            chunk.map(async (node) => {
              try {
                const content = await this.fileSystem.getFileContent(node);
                return [node.rel_path, content] as [string, string];
              } catch {
                return [node.rel_path, '[Error reading file]'] as [
                  string,
                  string,
                ];
              }
            }),
          );
          filesPayload.push(...chunkResults);
        }

        const allAncestorPaths = new Set<string>();
        for (const relPath of selectedSet) {
          allAncestorPaths.add(relPath);
          const parts = relPath.split('/');
          for (let i = 1; i < parts.length; i++) {
            allAncestorPaths.add(parts.slice(0, i).join('/'));
          }
        }

        const cleanedRoot = this.fileSystem.cleanNodeForWasm(root);
        const payload = this.wasm.buildPayload(
          projectName,
          JSON.stringify(cleanedRoot),
          filesPayload,
          Array.from(allAncestorPaths),
          this.transformOptions(),
        );

        this.generatedPayload.set(payload);
        return payload;
      }

      this.generatedPayload.set('');
      return '';
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const errMsg = `[Error generating context: ${message}]`;
      this.generatedPayload.set(errMsg);
      return errMsg;
    } finally {
      this.isGenerating.set(false);
    }
  }

  private collectAllDirPaths(node: FileNode, acc: Set<string>): void {
    if (node.is_dir) {
      acc.add(node.rel_path);
      for (const child of node.children || []) {
        this.collectAllDirPaths(child, acc);
      }
    }
  }

  private getAllFilePaths(node: FileNode, acc: string[] = []): string[] {
    if (!node.is_dir) {
      acc.push(node.rel_path);
    }
    for (const child of node.children || []) {
      this.getAllFilePaths(child, acc);
    }
    return acc;
  }

  private findNodeByRelPath(node: FileNode, relPath: string): FileNode | null {
    if (node.rel_path === relPath) {
      return node;
    }
    for (const child of node.children || []) {
      const found = this.findNodeByRelPath(child, relPath);
      if (found) {
        return found;
      }
    }
    return null;
  }

  private calculateSelectedSize(node: FileNode): number {
    let size = 0;
    if (!node.is_dir && this.selectedPaths().has(node.rel_path)) {
      size += node.size;
    }
    for (const child of node.children || []) {
      size += this.calculateSelectedSize(child);
    }
    return size;
  }

  private collectAllFilePaths(node: FileNode, acc: Set<string>): void {
    if (!node.is_dir) {
      acc.add(node.rel_path);
    }
    for (const child of node.children || []) {
      this.collectAllFilePaths(child, acc);
    }
  }

  private collectSelectedFileNodes(
    node: FileNode,
    selectedSet: Set<string>,
    acc: FileNode[],
  ): void {
    if (!node.is_dir && selectedSet.has(node.rel_path)) {
      acc.push(node);
    }
    for (const child of node.children || []) {
      this.collectSelectedFileNodes(child, selectedSet, acc);
    }
  }

  private loadResources(): void {
    const hasSavedScan = !!localStorage.getItem(STORAGE_KEY_SCAN);
    const hasSavedTransform = !!localStorage.getItem(STORAGE_KEY_TRANSFORM);

    fetch('assets/resources/default_settings.json')
      .then((res) => (res.ok ? res.json() : null))
      .then((settings) => {
        if (!settings) return;

        if (!hasSavedScan) {
          this.scanOptions.update((opts) => ({
            ...opts,
            use_gitignore: settings.use_gitignore ?? opts.use_gitignore,
            ignore_binary: settings.ignore_binary ?? opts.ignore_binary,
            ignore_lockfiles:
              settings.ignore_lockfiles ?? opts.ignore_lockfiles,
            manual_excludes: Array.from(
              new Set([
                ...opts.manual_excludes,
                ...(settings.global_excludes || []),
                'icon_data.py',
              ]),
            ),
            binary_extensions: Array.from(
              new Set([
                ...opts.binary_extensions,
                ...(settings.binary_extensions || []),
              ]),
            ),
            lockfiles_excludes: Array.from(
              new Set([
                ...opts.lockfiles_excludes,
                ...(settings.lockfiles_excludes || []),
              ]),
            ),
          }));
        }

        if (!hasSavedTransform) {
          this.transformOptions.update((opts) => ({
            ...opts,
            xml_format: settings.xml_format ?? opts.xml_format,
            strip_comments: settings.strip_comments ?? opts.strip_comments,
            compress_whitespace:
              settings.compress_whitespace ?? opts.compress_whitespace,
            sanitize_secrets:
              settings.sanitize_secrets ?? opts.sanitize_secrets,
            always_send_full_tree: settings.always_send_full_tree ?? false,
          }));
        }
      })
      .catch(() => {});

    fetch('assets/resources/comment_rules.json')
      .then((res) => (res.ok ? res.text() : null))
      .then((rulesText) => {
        if (rulesText) {
          this.transformOptions.update((opts) => ({
            ...opts,
            comment_rules_json: rulesText,
          }));
        }
      })
      .catch(() => {});
  }

  private loadScanOptions(): ScanOptions {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_SCAN);
      if (saved) {
        const parsed = JSON.parse(saved) as Partial<ScanOptions>;
        return {
          ...FALLBACK_SCAN_OPTIONS,
          ...parsed,
          manual_excludes: Array.from(
            new Set([
              ...FALLBACK_SCAN_OPTIONS.manual_excludes,
              ...(parsed.manual_excludes || []),
              'icon_data.py',
            ]),
          ),
        };
      }
    } catch {}
    return FALLBACK_SCAN_OPTIONS;
  }

  private loadTransformOptions(): TransformOptions {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_TRANSFORM);
      if (saved) {
        const parsed = JSON.parse(saved) as Partial<TransformOptions>;
        return {
          ...FALLBACK_TRANSFORM_OPTIONS,
          ...parsed,
          always_send_full_tree: parsed.always_send_full_tree ?? false,
        };
      }
    } catch {}
    return FALLBACK_TRANSFORM_OPTIONS;
  }
}
