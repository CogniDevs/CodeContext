import { Injectable, inject, signal } from '@angular/core';
import { WasmService, ScanOptionsWasm } from './wasm.service';

export interface FileNode {
  name: string;
  full_path: string;
  rel_path: string;
  is_dir: boolean;
  size: number;
  children: FileNode[];
  fileHandle?: FileSystemFileHandle;
  rawFile?: File;
}

const DEFAULT_HARD_EXCLUDES = [
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
  'icon_data.py'
];

const DEFAULT_BINARY_EXTENSIONS = [
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.pdf', '.exe', '.dll',
  '.bin', '.zip', '.tar', '.gz', '.tgz', '.rar', '.7z', '.mp3', '.mp4',
  '.wav', '.avi', '.mov', '.woff', '.woff2', '.ttf', '.eot', '.otf', '.db',
  '.sqlite', '.sqlite3', '.dmg', '.iso', '.msi', '.pkg', '.sys', '.cab',
  '.psd', '.class', '.pyc', '.o', '.obj', '.so', '.dylib', '.suo', '.svg',
  '.rlib', '.rmeta', '.pdb', '.whl', '.wasm', '.d', '.a', '.lib'
];

@Injectable({
  providedIn: 'root'
})
export class FileSystemService {
  private readonly wasmService = inject(WasmService);

  readonly currentProjectName = signal<string>('');
  readonly isScanning = signal<boolean>(false);
  readonly rootNode = signal<FileNode | null>(null);

  private readonly fileContentCache = new Map<string, string>();

  cleanNodeForWasm(node: FileNode): any {
    return {
      name: node.name,
      full_path: node.full_path,
      rel_path: node.rel_path,
      is_dir: node.is_dir,
      size: node.size,
      children: node.children ? node.children.map(c => this.cleanNodeForWasm(c)) : []
    };
  }

  async openDirectoryPicker(options: ScanOptionsWasm): Promise<FileNode | null> {
    if (!('showDirectoryPicker' in window)) {
      throw new Error('File System Access API is not supported in this browser.');
    }

    try {
      this.isScanning.set(true);
      await this.wasmService.init();

      const handle = await (window as any).showDirectoryPicker();
      this.currentProjectName.set(handle.name);

      const effectiveOptions = await this.prepareScanOptions(handle, options);
      const root = await this.scanDirectoryHandle(handle, handle.name, '', effectiveOptions);
      this.fileContentCache.clear();
      this.rootNode.set(root);
      return root;
    } finally {
      this.isScanning.set(false);
    }
  }

  async readFromFiles(files: FileList | File[], options: ScanOptionsWasm): Promise<FileNode | null> {
    this.isScanning.set(true);
    try {
      await this.wasmService.init();

      const fileArray = Array.from(files);
      if (fileArray.length === 0) {
        return null;
      }

      const firstPath = fileArray[0].webkitRelativePath || fileArray[0].name;
      const rootName = firstPath.split('/')[0] || 'project';
      this.currentProjectName.set(rootName);

      const effectiveOptions = this.ensureDefaultExcludes(options);

      const root: FileNode = {
        name: rootName,
        full_path: rootName,
        rel_path: '',
        is_dir: true,
        size: 0,
        children: []
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

      this.fileContentCache.clear();
      this.rootNode.set(root);
      return root;
    } finally {
      this.isScanning.set(false);
    }
  }

  async readFromDataTransfer(items: DataTransferItemList, options: ScanOptionsWasm): Promise<FileNode | null> {
    this.isScanning.set(true);
    try {
      await this.wasmService.init();

      let rootHandle: FileSystemDirectoryHandle | null = null;
      let rootEntry: any = null;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.kind === 'file') {
          if ('getAsFileSystemHandle' in item) {
            const handle = await (item as any).getAsFileSystemHandle();
            if (handle && handle.kind === 'directory') {
              rootHandle = handle as FileSystemDirectoryHandle;
              break;
            }
          }
          if ('webkitGetAsEntry' in item) {
            const entry = item.webkitGetAsEntry();
            if (entry && entry.isDirectory) {
              rootEntry = entry;
              break;
            }
          }
        }
      }

      if (rootHandle) {
        this.currentProjectName.set(rootHandle.name);
        const effectiveOptions = await this.prepareScanOptions(rootHandle, options);
        const root = await this.scanDirectoryHandle(rootHandle, rootHandle.name, '', effectiveOptions);
        this.fileContentCache.clear();
        this.rootNode.set(root);
        return root;
      }

      if (rootEntry) {
        this.currentProjectName.set(rootEntry.name);
        const effectiveOptions = this.ensureDefaultExcludes(options);
        const root = await this.scanWebkitEntry(rootEntry, rootEntry.name, '', effectiveOptions);
        this.fileContentCache.clear();
        this.rootNode.set(root);
        return root;
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

      return null;
    } finally {
      this.isScanning.set(false);
    }
  }

  async getFileContent(node: FileNode): Promise<string> {
    if (node.is_dir) {
      return '';
    }

    if (this.fileContentCache.has(node.rel_path)) {
      return this.fileContentCache.get(node.rel_path)!;
    }

    if (node.name.toLowerCase() === 'icon_data.py' || node.name.toLowerCase().endsWith('_data.py')) {
      return `[Auto-generated base64 asset file '${node.name}' omitted]`;
    }

    const dotIdx = node.name.lastIndexOf('.');
    if (dotIdx !== -1) {
      const ext = node.name.substring(dotIdx).toLowerCase();
      if (DEFAULT_BINARY_EXTENSIONS.includes(ext)) {
        return `[Binary file '${node.name}' omitted]`;
      }
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
      for (let i = 0; i < Math.min(lines.length, 50); i++) {
        if (lines[i].length > 8000) {
          content = `[File '${node.name}' omitted: contains excessively long single-line data]`;
          break;
        }
      }
      this.fileContentCache.set(node.rel_path, content);
    }

    return content;
  }

  private ensureDefaultExcludes(options: ScanOptionsWasm): ScanOptionsWasm {
    const excludes = new Set([...DEFAULT_HARD_EXCLUDES, ...(options.manual_excludes || [])]);
    return {
      ...options,
      manual_excludes: Array.from(excludes)
    };
  }

  private async prepareScanOptions(
    rootHandle: FileSystemDirectoryHandle,
    options: ScanOptionsWasm
  ): Promise<ScanOptionsWasm> {
    const baseOptions = this.ensureDefaultExcludes(options);
    if (!baseOptions.use_gitignore) {
      return baseOptions;
    }

    const gitignoreRules = await this.parseGitignoreFromHandle(rootHandle);
    if (gitignoreRules.length === 0) {
      return baseOptions;
    }

    const mergedExcludes = new Set([...baseOptions.manual_excludes]);
    for (const rule of gitignoreRules) {
      if (!baseOptions.gitignore_disabled_rules.includes(rule)) {
        mergedExcludes.add(rule);
      }
    }

    return {
      ...baseOptions,
      manual_excludes: Array.from(mergedExcludes)
    };
  }

  private async parseGitignoreFromHandle(dirHandle: FileSystemDirectoryHandle): Promise<string[]> {
    try {
      const fileHandle = await dirHandle.getFileHandle('.gitignore');
      const file = await fileHandle.getFile();
      const text = await file.text();
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
    } catch {
      return [];
    }
  }

  private checkIsIgnored(relPath: string, isDir: boolean, options: ScanOptionsWasm): boolean {
    const cleanPath = relPath.replace(/\\/g, '/');
    const parts = cleanPath.split('/');
    const name = parts[parts.length - 1];

    if (DEFAULT_HARD_EXCLUDES.includes(name) || DEFAULT_HARD_EXCLUDES.includes(cleanPath)) {
      return true;
    }

    for (const exclude of options.manual_excludes) {
      const cleanExclude = exclude.trim().replace(/\/$/, '');
      if (cleanExclude && (parts.includes(cleanExclude) || cleanPath === cleanExclude || cleanPath.startsWith(cleanExclude + '/'))) {
        return true;
      }
    }

    if (!isDir) {
      const dotIdx = name.lastIndexOf('.');
      if (dotIdx !== -1) {
        const ext = name.substring(dotIdx).toLowerCase();

        if (options.ignore_binary) {
          if (DEFAULT_BINARY_EXTENSIONS.includes(ext) || (options.binary_extensions && options.binary_extensions.includes(ext))) {
            return true;
          }
        }

        if (options.ignore_lockfiles) {
          if (options.lockfiles_excludes && options.lockfiles_excludes.includes(name)) {
            return true;
          }
        }

        if (options.whitelist_extensions && options.whitelist_extensions.length > 0) {
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
    options: ScanOptionsWasm
  ): Promise<FileNode> {
    const currentNode: FileNode = {
      name,
      full_path: relPath ? `${relPath}/${name}` : name,
      rel_path: relPath,
      is_dir: true,
      size: 0,
      children: []
    };

    const entries: Array<[string, FileSystemHandle]> = [];
    try {
      for await (const entry of (dirHandle as any).entries()) {
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
      const childNode = await this.scanDirectoryHandle(handle, entryName, childRelPath, options);
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
            fileHandle: handle
          } as FileNode;
        } catch {
          return {
            name: entryName,
            full_path: `${currentNode.full_path}/${entryName}`,
            rel_path: childRelPath,
            is_dir: false,
            size: 0,
            children: [],
            fileHandle: handle
          } as FileNode;
        }
      })
    );

    currentNode.children.push(...fileNodes);
    return currentNode;
  }

  private async scanWebkitEntry(
    entry: any,
    name: string,
    relPath: string,
    options: ScanOptionsWasm
  ): Promise<FileNode> {
    const currentNode: FileNode = {
      name,
      full_path: relPath ? `${relPath}/${name}` : name,
      rel_path: relPath,
      is_dir: true,
      size: 0,
      children: []
    };

    const dirReader = entry.createReader();
    const entries: any[] = [];

    try {
      let readBatch: any[];
      do {
        readBatch = await new Promise((resolve) => {
          dirReader.readEntries(
            (results: any[]) => resolve(results || []),
            () => resolve([])
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

    const dirEntries: any[] = [];
    const fileEntries: any[] = [];

    for (const childEntry of entries) {
      const childRelPath = relPath ? `${relPath}/${childEntry.name}` : childEntry.name;
      const isDir = childEntry.isDirectory;

      if (this.checkIsIgnored(childRelPath, isDir, options)) {
        continue;
      }

      if (isDir) {
        dirEntries.push(childEntry);
      } else {
        fileEntries.push(childEntry);
      }
    }

    for (const childEntry of dirEntries) {
      const childRelPath = relPath ? `${relPath}/${childEntry.name}` : childEntry.name;
      const childNode = await this.scanWebkitEntry(childEntry, childEntry.name, childRelPath, options);
      currentNode.children.push(childNode);
    }

    const fileNodes = await Promise.all(
      fileEntries.map(async (childEntry) => {
        const childRelPath = relPath ? `${relPath}/${childEntry.name}` : childEntry.name;
        try {
          const file: File = await new Promise((resolve, reject) => childEntry.file(resolve, reject));
          return {
            name: childEntry.name,
            full_path: `${currentNode.full_path}/${childEntry.name}`,
            rel_path: childRelPath,
            is_dir: false,
            size: file.size,
            children: [],
            rawFile: file
          } as FileNode;
        } catch {
          return {
            name: childEntry.name,
            full_path: `${currentNode.full_path}/${childEntry.name}`,
            rel_path: childRelPath,
            is_dir: false,
            size: 0,
            children: []
          } as FileNode;
        }
      })
    );

    currentNode.children.push(...fileNodes);
    return currentNode;
  }

  private addFileToTree(parent: FileNode, parts: string[], file: File): void {
    if (parts.length === 1) {
      parent.children.push({
        name: parts[0],
        full_path: `${parent.full_path}/${parts[0]}`,
        rel_path: parent.rel_path ? `${parent.rel_path}/${parts[0]}` : parts[0],
        is_dir: false,
        size: file.size,
        children: [],
        rawFile: file
      });
      return;
    }

    const dirName = parts[0];
    let childDir = parent.children.find((c) => c.is_dir && c.name === dirName);

    if (!childDir) {
      childDir = {
        name: dirName,
        full_path: `${parent.full_path}/${dirName}`,
        rel_path: parent.rel_path ? `${parent.rel_path}/${dirName}` : dirName,
        is_dir: true,
        size: 0,
        children: []
      };
      parent.children.push(childDir);
    }

    this.addFileToTree(childDir, parts.slice(1), file);
  }
}
