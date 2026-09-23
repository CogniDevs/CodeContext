import { inject, Injectable, signal } from '@angular/core';

import { FileNode, ScanOptions } from '@models/context.models';
import { WasmService } from '@services/wasm.service';

interface WebkitFileSystemEntry {
  isFile: boolean;
  isDirectory: boolean;
  name: string;
  fullPath: string;
}

interface WebkitFileEntry extends WebkitFileSystemEntry {
  file: (
    successCallback: (file: File) => void,
    errorCallback?: (error: unknown) => void,
  ) => void;
}

interface WebkitDirectoryReader {
  readEntries: (
    successCallback: (entries: WebkitFileSystemEntry[]) => void,
    errorCallback?: (error: unknown) => void,
  ) => void;
}

interface WebkitDirectoryEntry extends WebkitFileSystemEntry {
  createReader: () => WebkitDirectoryReader;
}

const DEFAULT_HARD_EXCLUDES: string[] = [
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
];

const DEFAULT_BINARY_EXTENSIONS: string[] = [
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.ico',
  '.pdf',
  '.exe',
  '.dll',
  '.bin',
  '.zip',
  '.tar',
  '.gz',
  '.tgz',
  '.rar',
  '.7z',
  '.mp3',
  '.mp4',
  '.wav',
  '.avi',
  '.mov',
  '.woff',
  '.woff2',
  '.ttf',
  '.eot',
  '.otf',
  '.db',
  '.sqlite',
  '.sqlite3',
  '.dmg',
  '.iso',
  '.msi',
  '.pkg',
  '.sys',
  '.cab',
  '.psd',
  '.class',
  '.pyc',
  '.pyo',
  '.pyd',
  '.o',
  '.obj',
  '.so',
  '.dylib',
  '.suo',
  '.svg',
  '.rlib',
  '.rmeta',
  '.pdb',
  '.whl',
  '.wasm',
  '.d',
  '.a',
  '.lib',
];

const MAX_WEB_FILE_SIZE_BYTES = 1024 * 1024 * 1.5;
const MAX_SINGLE_LINE_LENGTH = 4000;

export interface DirectoryScanResult {
  rootNode: FileNode | null;
  gitignoreRules: string[];
}

@Injectable({
  providedIn: 'root',
})
export class FileSystemService {
  private readonly wasmService = inject(WasmService);

  readonly currentProjectName = signal<string>('');
  readonly isScanning = signal<boolean>(false);
  readonly rootNode = signal<FileNode | null>(null);

  private readonly fileContentCache = new Map<string, string>();

  cleanNodeForWasm(node: FileNode): Record<string, unknown> {
    return {
      name: node.name,
      full_path: node.full_path,
      rel_path: node.rel_path,
      is_dir: node.is_dir,
      size: node.size,
      children: node.children
        ? node.children.map((child) => this.cleanNodeForWasm(child))
        : [],
    };
  }

  setRootNode(node: FileNode | null, projectName?: string): void {
    this.rootNode.set(node);
    if (projectName) {
      this.currentProjectName.set(projectName);
    } else if (node) {
      this.currentProjectName.set(node.name);
    } else {
      this.currentProjectName.set('');
    }
  }

  clearCache(): void {
    this.fileContentCache.clear();
  }

  async openDirectoryPicker(
    options: ScanOptions,
  ): Promise<DirectoryScanResult> {
    if ('showDirectoryPicker' in window) {
      try {
        const pickerFn = (
          window as unknown as {
            showDirectoryPicker: () => Promise<FileSystemDirectoryHandle>;
          }
        ).showDirectoryPicker;
        const handle = await pickerFn();

        this.isScanning.set(true);
        await this.wasmService.init();
        this.currentProjectName.set(handle.name);

        const { effectiveOptions, gitignoreRules } =
          await this.prepareScanOptions(handle, options);
        const root = await this.scanDirectoryHandle(
          handle,
          handle.name,
          '',
          effectiveOptions,
        );

        this.clearCache();
        this.rootNode.set(root);
        return { rootNode: root, gitignoreRules };
      } catch (err: unknown) {
        const isAbort = err instanceof Error && err.name === 'AbortError';
        if (isAbort) {
          return { rootNode: null, gitignoreRules: [] };
        }
        return await this.openInputDirectoryFallback(options);
      } finally {
        this.isScanning.set(false);
      }
    }

    return await this.openInputDirectoryFallback(options);
  }

  private openInputDirectoryFallback(
    options: ScanOptions,
  ): Promise<DirectoryScanResult> {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.setAttribute('webkitdirectory', '');
      input.setAttribute('directory', '');
      input.style.display = 'none';
      document.body.appendChild(input);

      input.onchange = async () => {
        try {
          if (input.files && input.files.length > 0) {
            const res = await this.readFromFiles(input.files, options);
            resolve(res);
          } else {
            resolve({ rootNode: null, gitignoreRules: [] });
          }
        } finally {
          document.body.removeChild(input);
        }
      };

      input.oncancel = () => {
        document.body.removeChild(input);
        resolve({ rootNode: null, gitignoreRules: [] });
      };

      input.click();
    });
  }

  async readFromFiles(
    files: FileList | File[],
    options: ScanOptions,
  ): Promise<DirectoryScanResult> {
    this.isScanning.set(true);
    try {
      await this.wasmService.init();

      const fileArray = Array.from(files);
      if (fileArray.length === 0) {
        return { rootNode: null, gitignoreRules: [] };
      }

      const firstPath = fileArray[0].webkitRelativePath || fileArray[0].name;
      const rootName = firstPath.split('/')[0] || 'project';
      this.currentProjectName.set(rootName);

      const gitignoreFile = fileArray.find(
        (f) =>
          f.name === '.gitignore' ||
          (f.webkitRelativePath &&
            f.webkitRelativePath.split('/').pop() === '.gitignore'),
      );

      let effectiveOptions = this.ensureDefaultExcludes(options);
      let gitignoreRules: string[] = [];
      if (gitignoreFile && options.use_gitignore) {
        const text = await gitignoreFile.text();
        gitignoreRules = this.parseGitignoreText(text);
        const mergedExcludes = new Set([...effectiveOptions.manual_excludes]);
        for (const r of gitignoreRules) {
          if (!options.gitignore_disabled_rules.includes(r)) {
            mergedExcludes.add(r);
          }
        }
        effectiveOptions = {
          ...effectiveOptions,
          manual_excludes: Array.from(mergedExcludes),
        };
      }

      const root: FileNode = {
        name: rootName,
        full_path: rootName,
        rel_path: '',
        is_dir: true,
        size: 0,
        children: [],
      };

      for (const file of fileArray) {
        const relPath = file.webkitRelativePath
          ? file.webkitRelativePath.substring(rootName.length + 1)
          : file.name;

        if (!relPath) {
          continue;
        }

        if (this.checkIsIgnored(relPath, false, effectiveOptions)) {
          continue;
        }

        this.addFileToTree(root, relPath.split('/'), file);
      }

      this.clearCache();
      this.rootNode.set(root);
      return { rootNode: root, gitignoreRules };
    } finally {
      this.isScanning.set(false);
    }
  }

  async readFromDataTransfer(
    items: DataTransferItemList,
    options: ScanOptions,
  ): Promise<DirectoryScanResult> {
    this.isScanning.set(true);
    try {
      await this.wasmService.init();

      let rootHandle: FileSystemDirectoryHandle | null = null;
      let rootEntry: WebkitDirectoryEntry | null = null;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.kind === 'file') {
          if ('getAsFileSystemHandle' in item) {
            const handleFn = (
              item as unknown as {
                getAsFileSystemHandle: () => Promise<FileSystemHandle | null>;
              }
            ).getAsFileSystemHandle;
            const handle = await handleFn();
            if (handle && handle.kind === 'directory') {
              rootHandle = handle as FileSystemDirectoryHandle;
              break;
            }
          }
          if ('webkitGetAsEntry' in item) {
            const entryFn = (
              item as unknown as {
                webkitGetAsEntry: () => WebkitFileSystemEntry | null;
              }
            ).webkitGetAsEntry;
            const entry = entryFn();
            if (entry && entry.isDirectory) {
              rootEntry = entry as WebkitDirectoryEntry;
              break;
            }
          }
        }
      }

      if (rootHandle) {
        this.currentProjectName.set(rootHandle.name);
        const { effectiveOptions, gitignoreRules } =
          await this.prepareScanOptions(rootHandle, options);
        const root = await this.scanDirectoryHandle(
          rootHandle,
          rootHandle.name,
          '',
          effectiveOptions,
        );
        this.clearCache();
        this.rootNode.set(root);
        return { rootNode: root, gitignoreRules };
      }

      if (rootEntry) {
        this.currentProjectName.set(rootEntry.name);
        const effectiveOptions = this.ensureDefaultExcludes(options);
        const root = await this.scanWebkitEntry(
          rootEntry,
          rootEntry.name,
          '',
          effectiveOptions,
        );
        this.clearCache();
        this.rootNode.set(root);
        return { rootNode: root, gitignoreRules: [] };
      }

      const fileList: File[] = [];
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.kind === 'file') {
          const file = item.getAsFile();
          if (file) {
            fileList.push(file);
          }
        }
      }

      if (fileList.length > 0) {
        return await this.readFromFiles(fileList, options);
      }

      return { rootNode: null, gitignoreRules: [] };
    } finally {
      this.isScanning.set(false);
    }
  }

  async getFileContent(node: FileNode): Promise<string> {
    if (node.is_dir) {
      return '';
    }

    const cached = this.fileContentCache.get(node.rel_path);
    if (cached !== undefined) {
      return cached;
    }

    if (
      node.name.toLowerCase() === 'icon_data.py' ||
      node.name.toLowerCase().endsWith('_data.py')
    ) {
      return `[Auto-generated base64 asset file '${node.name}' omitted]`;
    }

    const dotIdx = node.name.lastIndexOf('.');
    if (dotIdx !== -1) {
      const ext = node.name.substring(dotIdx).toLowerCase();
      if (DEFAULT_BINARY_EXTENSIONS.includes(ext)) {
        return `[Binary file '${node.name}' omitted]`;
      }
    }

    if (node.size > MAX_WEB_FILE_SIZE_BYTES) {
      return `[File '${node.name}' omitted: exceeds max size limit of 1.5MB]`;
    }

    let content = '';
    if (node.fileHandle) {
      const file = await node.fileHandle.getFile();
      content = await file.text();
    } else if (node.rawFile) {
      content = await node.rawFile.text();
    }

    if (content) {
      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].length > MAX_SINGLE_LINE_LENGTH) {
          content = `[File '${node.name}' omitted: contains excessively long single-line data]`;
          break;
        }
      }
      this.fileContentCache.set(node.rel_path, content);
    }

    return content;
  }

  private ensureDefaultExcludes(options: ScanOptions): ScanOptions {
    const excludes = new Set([
      ...DEFAULT_HARD_EXCLUDES,
      ...(options.manual_excludes || []),
    ]);
    return {
      ...options,
      manual_excludes: Array.from(excludes),
    };
  }

  private async prepareScanOptions(
    rootHandle: FileSystemDirectoryHandle,
    options: ScanOptions,
  ): Promise<{ effectiveOptions: ScanOptions; gitignoreRules: string[] }> {
    const baseOptions = this.ensureDefaultExcludes(options);
    if (!baseOptions.use_gitignore) {
      return { effectiveOptions: baseOptions, gitignoreRules: [] };
    }

    const gitignoreRules = await this.parseGitignoreFromHandle(rootHandle);
    if (gitignoreRules.length === 0) {
      return { effectiveOptions: baseOptions, gitignoreRules: [] };
    }

    const mergedExcludes = new Set([...baseOptions.manual_excludes]);
    for (const rule of gitignoreRules) {
      if (!baseOptions.gitignore_disabled_rules.includes(rule)) {
        mergedExcludes.add(rule);
      }
    }

    return {
      effectiveOptions: {
        ...baseOptions,
        manual_excludes: Array.from(mergedExcludes),
      },
      gitignoreRules,
    };
  }

  private parseGitignoreText(text: string): string[] {
    const rules: string[] = [];
    for (let line of text.split('\n')) {
      line = line.trim();
      if (!line || line.startsWith('#')) {
        continue;
      }
      if (line.includes(' #')) {
        line = line.split(' #')[0].trim();
      }
      if (line) {
        rules.push(line);
      }
    }
    return rules;
  }

  private async parseGitignoreFromHandle(
    dirHandle: FileSystemDirectoryHandle,
  ): Promise<string[]> {
    try {
      const fileHandle = await dirHandle.getFileHandle('.gitignore');
      const file = await fileHandle.getFile();
      const text = await file.text();
      return this.parseGitignoreText(text);
    } catch {
      return [];
    }
  }

  private checkIsIgnored(
    relPath: string,
    isDir: boolean,
    options: ScanOptions,
  ): boolean {
    const cleanPath = relPath.replace(/\\/g, '/');
    const parts = cleanPath.split('/');
    const name = parts[parts.length - 1] ?? '';

    if (
      DEFAULT_HARD_EXCLUDES.includes(name) ||
      DEFAULT_HARD_EXCLUDES.includes(cleanPath)
    ) {
      return true;
    }

    for (const exclude of options.manual_excludes) {
      const cleanExclude = exclude.trim().replace(/\/$/, '');
      if (
        cleanExclude &&
        (parts.includes(cleanExclude) ||
          cleanPath === cleanExclude ||
          cleanPath.startsWith(`${cleanExclude}/`))
      ) {
        return true;
      }
    }

    if (!isDir) {
      const dotIdx = name.lastIndexOf('.');
      if (dotIdx !== -1) {
        const ext = name.substring(dotIdx).toLowerCase();

        if (options.ignore_binary) {
          if (
            DEFAULT_BINARY_EXTENSIONS.includes(ext) ||
            (options.binary_extensions &&
              options.binary_extensions.includes(ext))
          ) {
            return true;
          }
        }

        if (options.ignore_lockfiles) {
          if (
            options.lockfiles_excludes &&
            options.lockfiles_excludes.includes(name)
          ) {
            return true;
          }
        }

        if (
          options.whitelist_extensions &&
          options.whitelist_extensions.length > 0
        ) {
          if (!options.whitelist_extensions.includes(ext)) {
            return true;
          }
        }
      }
    }

    return this.wasmService.isIgnored(relPath, isDir, options);
  }

  private async scanDirectoryHandle(
    dirHandle: FileSystemDirectoryHandle,
    name: string,
    relPath: string,
    options: ScanOptions,
  ): Promise<FileNode> {
    const currentNode: FileNode = {
      name,
      full_path: relPath ? `${relPath}/${name}` : name,
      rel_path: relPath,
      is_dir: true,
      size: 0,
      children: [],
    };

    const entries: Array<[string, FileSystemHandle]> = [];
    try {
      const asyncEntries = (
        dirHandle as unknown as {
          entries: () => AsyncIterable<[string, FileSystemHandle]>;
        }
      ).entries();
      for await (const entry of asyncEntries) {
        entries.push(entry);
      }
    } catch {
      return currentNode;
    }

    entries.sort(([nameA, handleA], [nameB, handleB]) => {
      const isDirA = handleA.kind === 'directory';
      const isDirB = handleB.kind === 'directory';
      if (isDirA !== isDirB) {
        return isDirB ? 1 : -1;
      }
      return nameA.localeCompare(nameB);
    });

    const dirEntries: Array<[string, FileSystemDirectoryHandle]> = [];
    const fileEntries: Array<[string, FileSystemFileHandle]> = [];

    for (const [entryName, handle] of entries) {
      const childRelPath = relPath ? `${relPath}/${entryName}` : entryName;
      const isDir = handle.kind === 'directory';

      if (this.checkIsIgnored(childRelPath, isDir, options)) {
        continue;
      }

      if (isDir) {
        dirEntries.push([entryName, handle as FileSystemDirectoryHandle]);
      } else {
        fileEntries.push([entryName, handle as FileSystemFileHandle]);
      }
    }

    for (const [entryName, handle] of dirEntries) {
      const childRelPath = relPath ? `${relPath}/${entryName}` : entryName;
      const childNode = await this.scanDirectoryHandle(
        handle,
        entryName,
        childRelPath,
        options,
      );
      currentNode.children.push(childNode);
    }

    const fileNodes = await Promise.all(
      fileEntries.map(async ([entryName, handle]) => {
        const childRelPath = relPath ? `${relPath}/${entryName}` : entryName;
        try {
          const file = await handle.getFile();
          return {
            name: entryName,
            full_path: `${currentNode.full_path}/${entryName}`,
            rel_path: childRelPath,
            is_dir: false,
            size: file.size,
            children: [],
            fileHandle: handle,
          } as FileNode;
        } catch {
          return {
            name: entryName,
            full_path: `${currentNode.full_path}/${entryName}`,
            rel_path: childRelPath,
            is_dir: false,
            size: 0,
            children: [],
            fileHandle: handle,
          } as FileNode;
        }
      }),
    );

    currentNode.children.push(...fileNodes);
    return currentNode;
  }

  private async scanWebkitEntry(
    entry: WebkitDirectoryEntry,
    name: string,
    relPath: string,
    options: ScanOptions,
  ): Promise<FileNode> {
    const currentNode: FileNode = {
      name,
      full_path: relPath ? `${relPath}/${name}` : name,
      rel_path: relPath,
      is_dir: true,
      size: 0,
      children: [],
    };

    const dirReader = entry.createReader();
    const entries: WebkitFileSystemEntry[] = [];

    try {
      let readBatch: WebkitFileSystemEntry[];
      do {
        readBatch = await new Promise((resolve) => {
          dirReader.readEntries(
            (results) => resolve(results || []),
            () => resolve([]),
          );
        });
        entries.push(...readBatch);
      } while (readBatch.length > 0);
    } catch {
      return currentNode;
    }

    entries.sort((a, b) => {
      if (a.isDirectory !== b.isDirectory) {
        return b.isDirectory ? 1 : -1;
      }
      return a.name.localeCompare(b.name);
    });

    const dirEntries: WebkitDirectoryEntry[] = [];
    const fileEntries: WebkitFileEntry[] = [];

    for (const childEntry of entries) {
      const childRelPath = relPath
        ? `${relPath}/${childEntry.name}`
        : childEntry.name;
      const isDir = childEntry.isDirectory;

      if (this.checkIsIgnored(childRelPath, isDir, options)) {
        continue;
      }

      if (isDir) {
        dirEntries.push(childEntry as WebkitDirectoryEntry);
      } else {
        fileEntries.push(childEntry as WebkitFileEntry);
      }
    }

    for (const childEntry of dirEntries) {
      const childRelPath = relPath
        ? `${relPath}/${childEntry.name}`
        : childEntry.name;
      const childNode = await this.scanWebkitEntry(
        childEntry,
        childEntry.name,
        childRelPath,
        options,
      );
      currentNode.children.push(childNode);
    }

    const fileNodes = await Promise.all(
      fileEntries.map(async (childEntry) => {
        const childRelPath = relPath
          ? `${relPath}/${childEntry.name}`
          : childEntry.name;
        try {
          const file: File = await new Promise((resolve, reject) =>
            childEntry.file(resolve, reject),
          );
          return {
            name: childEntry.name,
            full_path: `${currentNode.full_path}/${childEntry.name}`,
            rel_path: childRelPath,
            is_dir: false,
            size: file.size,
            children: [],
            rawFile: file,
          } as FileNode;
        } catch {
          return {
            name: childEntry.name,
            full_path: `${currentNode.full_path}/${childEntry.name}`,
            rel_path: childRelPath,
            is_dir: false,
            size: 0,
            children: [],
          } as FileNode;
        }
      }),
    );

    currentNode.children.push(...fileNodes);
    return currentNode;
  }

  private addFileToTree(parent: FileNode, parts: string[], file: File): void {
    if (parts.length === 1) {
      const fileName = parts[0] ?? '';
      parent.children.push({
        name: fileName,
        full_path: `${parent.full_path}/${fileName}`,
        rel_path: parent.rel_path ? `${parent.rel_path}/${fileName}` : fileName,
        is_dir: false,
        size: file.size,
        children: [],
        rawFile: file,
      });
      return;
    }

    const dirName = parts[0] ?? '';
    let childDir = parent.children.find(
      (child) => child.is_dir && child.name === dirName,
    );

    if (!childDir) {
      childDir = {
        name: dirName,
        full_path: `${parent.full_path}/${dirName}`,
        rel_path: parent.rel_path ? `${parent.rel_path}/${dirName}` : dirName,
        is_dir: true,
        size: 0,
        children: [],
      };
      parent.children.push(childDir);
    }

    this.addFileToTree(childDir, parts.slice(1), file);
  }
}
