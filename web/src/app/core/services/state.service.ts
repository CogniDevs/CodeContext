import { Injectable, inject, signal, computed } from '@angular/core';
import { WasmService, ScanOptionsWasm, TransformOptionsWasm } from './wasm.service';
import { FileSystemService, FileNode } from './file-system.service';

@Injectable({
  providedIn: 'root'
})
export class StateService {
  private readonly wasmService = inject(WasmService);
  private readonly fileSystemService = inject(FileSystemService);

  readonly scanOptions = signal<ScanOptionsWasm>({
    use_gitignore: true,
    ignore_binary: true,
    ignore_lockfiles: true,
    whitelist_extensions: [],
    manual_excludes: ['.git', 'node_modules', 'dist', 'target', '.angular'],
    gitignore_disabled_rules: [],
    binary_extensions: ['.png', '.jpg', '.jpeg', '.gif', '.ico', '.pdf', '.zip', '.exe', '.dll', '.so', '.dylib', '.wasm'],
    lockfiles_excludes: ['package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', 'Cargo.lock', 'go.sum']
  });

  readonly transformOptions = signal<TransformOptionsWasm>({
    strip_comments: false,
    compress_whitespace: false,
    sanitize_secrets: false,
    skeleton_mode: false,
    xml_format: true,
    always_send_full_tree: true,
    system_prompt: ''
  });

  readonly selectedPaths = signal<Set<string>>(new Set());
  readonly generatedPayload = signal<string>('');
  readonly isGenerating = signal<boolean>(false);

  readonly selectedFilesCount = computed(() => this.selectedPaths().size);

  readonly tokenCount = computed(() => {
    const payload = this.generatedPayload();
    if (!payload) {
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

  async generatePayload(): Promise<string> {
    const root = this.fileSystemService.rootNode();
    const projectName = this.fileSystemService.currentProjectName() || 'project';

    if (!root) {
      this.generatedPayload.set('');
      return '';
    }

    this.isGenerating.set(true);

    try {
      const selectedSet = this.selectedPaths();
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
}
