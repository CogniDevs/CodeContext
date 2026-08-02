import { Injectable, inject, signal, computed, effect } from '@angular/core';
import { WasmService, ScanOptionsWasm, TransformOptionsWasm } from './wasm.service';
import { FileSystemService, FileNode } from './file-system.service';

const STORAGE_KEY_SCAN = 'codecontext_scan_options';
const STORAGE_KEY_TRANSFORM = 'codecontext_transform_options';

const DEFAULT_COMMENT_RULES_JSON = JSON.stringify({
  rules: {
    c_style: {
      extensions: [
        '.js', '.jsx', '.ts', '.tsx', '.c', '.cpp', '.h', '.hpp', '.go', '.rs',
        '.java', '.cs', '.php', '.css', '.scss', '.dart', '.kt', '.kts'
      ],
      pattern: '("(?:\\\\.|[^"\\\\])*")|(\'(?:\\\\.|[^\'\\\\])*\')|(`(?:\\\\.|[^`\\\\])*`)|(//.*?$)|(/\\*[\\s\\S]*?\\*/)'
    },
    python_style: {
      extensions: ['.py', '.ipynb'],
      hash_pattern: '("(?:\\\\.|[^"\\\\])*")|(\'(?:\\\\.|[^\'\\\\])*\')|(#.*?$)',
      docstring_pattern: '^\\s*("""[\\s\\S]*?"""|\'\'\'[\\s\\S]*?\'\'\')\\s*$'
    },
    xml_style: {
      extensions: ['.html', '.xml', '.svelte', '.vue', '.astro', '.svg'],
      pattern: '("(?:\\\\.|[^"\\\\])*")|(\'(?:\\\\.|[^\'\\\\])*\')|(<!--[\\s\\S]*?-->)'
    },
    hash_style: {
      extensions: ['.sh', '.bash', '.yaml', '.yml', '.toml', '.ini', 'makefile', 'dockerfile', '.rb'],
      pattern: '("(?:\\\\.|[^"\\\\])*")|(\'(?:\\\\.|[^\'\\\\])*\')|(#.*?$)'
    },
    sql_style: {
      extensions: ['.sql'],
      pattern: '("(?:\\\\.|[^"\\\\])*")|(\'(?:\\\\.|[^\'\\\\])*\')|(--.*?$)|(/\\*[\\s\\S]*?\\*/)'
    }
  }
});

const DEFAULT_SCAN_OPTIONS: ScanOptionsWasm = {
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
    '.vscode'
  ],
  gitignore_disabled_rules: [],
  binary_extensions: ['.png', '.jpg', '.jpeg', '.gif', '.ico', '.pdf', '.zip', '.exe', '.dll', '.so', '.dylib', '.wasm'],
  lockfiles_excludes: ['package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', 'Cargo.lock', 'go.sum']
};

const DEFAULT_TRANSFORM_OPTIONS: TransformOptionsWasm = {
  strip_comments: false,
  compress_whitespace: false,
  sanitize_secrets: false,
  skeleton_mode: false,
  xml_format: true,
  always_send_full_tree: true,
  system_prompt: '',
  comment_rules_json: DEFAULT_COMMENT_RULES_JSON
};

@Injectable({
  providedIn: 'root'
})
export class StateService {
  private readonly wasmService = inject(WasmService);
  private readonly fileSystemService = inject(FileSystemService);

  readonly scanOptions = signal<ScanOptionsWasm>(this.loadScanOptions());
  readonly transformOptions = signal<TransformOptionsWasm>(this.loadTransformOptions());

  readonly selectedPaths = signal<Set<string>>(new Set());
  readonly focusedPath = signal<string | null>(null);
  readonly generatedPayload = signal<string>('');
  readonly isGenerating = signal<boolean>(false);

  readonly selectedFilesCount = computed(() => this.selectedPaths().size);

  readonly tokenCount = computed(() => {
    const payload = this.generatedPayload();
    if (!payload || payload.startsWith('[')) {
      return 0;
    }
    return this.wasmService.countTokens(payload);
  });

  readonly totalSizeBytes = computed(() => {
    const root = this.fileSystemService.rootNode();
    if (!root) {
      return 0;
    }
    return this.calculateSelectedSize(root);
  });

  readonly totalSizeKb = computed(() => {
    return Math.round((this.totalSizeBytes() / 1024) * 10) / 10;
  });

  constructor() {
    effect(() => {
      localStorage.setItem(STORAGE_KEY_SCAN, JSON.stringify(this.scanOptions()));
    });

    effect(() => {
      localStorage.setItem(STORAGE_KEY_TRANSFORM, JSON.stringify(this.transformOptions()));
    });
  }

  setFocusedPath(relPath: string | null): void {
    this.focusedPath.set(relPath);
  }

  togglePathSelection(relPath: string, isSelected: boolean): void {
    this.selectedPaths.update((set) => {
      const next = new Set(set);
      if (isSelected) {
        next.add(relPath);
      } else {
        next.delete(relPath);
      }
      return next;
    });
  }

  selectAllFiles(check: boolean): void {
    const root = this.fileSystemService.rootNode();
    if (!root) {
      return;
    }

    const newSet = new Set<string>();
    if (check) {
      this.collectAllFilePaths(root, newSet);
    }
    this.selectedPaths.set(newSet);
  }

  async traceDependenciesForFocusedFile(): Promise<number> {
    const focusedRelPath = this.focusedPath();
    const root = this.fileSystemService.rootNode();
    const rootName = this.fileSystemService.currentProjectName() || 'project';

    if (!focusedRelPath || !root) {
      return 0;
    }

    const focusedNode = this.findNodeByRelPath(root, focusedRelPath);
    if (!focusedNode || focusedNode.is_dir) {
      return 0;
    }

    const content = await this.fileSystemService.getFileContent(focusedNode);
    const deps = this.wasmService.traceDependencies(rootName, focusedRelPath, content);

    if (deps && deps.length > 0) {
      this.selectedPaths.update((set) => {
        const next = new Set(set);
        for (const dep of deps) {
          next.add(dep);
        }
        return next;
      });
      await this.generatePayload();
      return deps.length;
    }

    return 0;
  }

  async generatePayload(): Promise<string> {
    const root = this.fileSystemService.rootNode();
    const projectName = this.fileSystemService.currentProjectName() || 'project';

    if (!root) {
      this.generatedPayload.set('');
      return '';
    }

    const selectedSet = this.selectedPaths();
    if (selectedSet.size === 0) {
      this.generatedPayload.set('');
      return '';
    }

    if (selectedSet.size > 2000 || this.totalSizeBytes() > 30 * 1024 * 1024) {
      const msg = `[Выбрано слишком много элементов (${selectedSet.size} файлов / ${this.totalSizeKb()} KB). Для защиты от зависания браузера автоматический сбор контекста приостановлен. Снимите выделение с папок с бинарными/большими файлами или выберите нужные исходные файлы вручную.]`;
      this.generatedPayload.set(msg);
      return msg;
    }

    this.isGenerating.set(true);

    try {
      const filesToRead: FileNode[] = [];
      this.collectSelectedFileNodes(root, selectedSet, filesToRead);

      const filesPayload: Array<[string, string]> = [];
      for (const node of filesToRead) {
        try {
          const content = await this.fileSystemService.getFileContent(node);
          filesPayload.push([node.rel_path, content]);
        } catch {
          filesPayload.push([node.rel_path, '[Error reading file]']);
        }
      }

      const allAncestorPaths = new Set<string>();
      for (const relPath of selectedSet) {
        allAncestorPaths.add(relPath);
        const parts = relPath.split('/');
        for (let i = 1; i < parts.length; i++) {
          allAncestorPaths.add(parts.slice(0, i).join('/'));
        }
      }

      const payload = this.wasmService.buildPayload(
        projectName,
        JSON.stringify(root),
        filesPayload,
        Array.from(allAncestorPaths),
        this.transformOptions()
      );

      this.generatedPayload.set(payload);
      return payload;
    } finally {
      this.isGenerating.set(false);
    }
  }

  private findNodeByRelPath(node: FileNode, relPath: string): FileNode | null {
    if (node.rel_path === relPath) {
      return node;
    }
    for (const child of node.children) {
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
    for (const child of node.children) {
      size += this.calculateSelectedSize(child);
    }
    return size;
  }

  private collectAllFilePaths(node: FileNode, acc: Set<string>): void {
    if (!node.is_dir) {
      acc.add(node.rel_path);
    }
    for (const child of node.children) {
      this.collectAllFilePaths(child, acc);
    }
  }

  private collectSelectedFileNodes(node: FileNode, selectedSet: Set<string>, acc: FileNode[]): void {
    if (!node.is_dir && selectedSet.has(node.rel_path)) {
      acc.push(node);
    }
    for (const child of node.children) {
      this.collectSelectedFileNodes(child, selectedSet, acc);
    }
  }

  private loadScanOptions(): ScanOptionsWasm {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_SCAN);
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          ...DEFAULT_SCAN_OPTIONS,
          ...parsed,
          manual_excludes: Array.from(new Set([...DEFAULT_SCAN_OPTIONS.manual_excludes, ...(parsed.manual_excludes || [])]))
        };
      }
    } catch {

    }
    return DEFAULT_SCAN_OPTIONS;
  }

  private loadTransformOptions(): TransformOptionsWasm {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_TRANSFORM);
      if (saved) {
        return { ...DEFAULT_TRANSFORM_OPTIONS, ...JSON.parse(saved) };
      }
    } catch {

    }
    return DEFAULT_TRANSFORM_OPTIONS;
  }
}
