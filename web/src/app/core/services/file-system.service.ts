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

@Injectable({
  providedIn: 'root'
})
export class FileSystemService {
  private readonly wasmService = inject(WasmService);

  readonly currentProjectName = signal<string>('');
  readonly isScanning = signal<boolean>(false);
  readonly rootNode = signal<FileNode | null>(null);

  async openDirectoryPicker(options: ScanOptionsWasm): Promise<FileNode | null> {
    if (!('showDirectoryPicker' in window)) {
      throw new Error('File System Access API is not supported in this browser.');
    }

    try {
      this.isScanning.set(true);
      const handle = await (window as any).showDirectoryPicker();
      this.currentProjectName.set(handle.name);

      const root = await this.scanDirectoryHandle(handle, handle.name, '', options);
      this.rootNode.set(root);
      return root;
    } finally {
      this.isScanning.set(false);
    }
  }

  async readFromFiles(files: FileList | File[], options: ScanOptionsWasm): Promise<FileNode | null> {
    this.isScanning.set(true);
    try {
      const fileArray = Array.from(files);
      if (fileArray.length === 0) {
        return null;
      }

      const firstPath = fileArray[0].webkitRelativePath || fileArray[0].name;
      const rootName = firstPath.split('/')[0] || 'project';
      this.currentProjectName.set(rootName);

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

        if (this.wasmService.isIgnored(relPath, false, options)) {
          continue;
        }

        this.addFileToTree(root, relPath.split('/'), file);
      }

      this.rootNode.set(root);
      return root;
    } finally {
      this.isScanning.set(false);
    }
  }

  async readFromDataTransfer(items: DataTransferItemList, options: ScanOptionsWasm): Promise<FileNode | null> {
    this.isScanning.set(true);
    try {
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
        const root = await this.scanDirectoryHandle(rootHandle, rootHandle.name, '', options);
        this.rootNode.set(root);
        return root;
      }

      if (rootEntry) {
        this.currentProjectName.set(rootEntry.name);
        const root = await this.scanWebkitEntry(rootEntry, rootEntry.name, '', options);
        this.rootNode.set(root);
        return root;
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

    if (node.fileHandle) {
      const file = await node.fileHandle.getFile();
      return await file.text();
    }

    if (node.rawFile) {
      return await node.rawFile.text();
    }

    return '';
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
    for await (const entry of (dirHandle as any).entries()) {
      entries.push(entry);
    }

    entries.sort(([nameA, handleA], [nameB, handleB]) => {
      const isDirA = handleA.kind === 'directory';
      const isDirB = handleB.kind === 'directory';
      if (isDirA !== isDirB) {
        return isDirB ? 1 : -1;
      }
      return nameA.localeCompare(nameB);
    });

    for (const [entryName, handle] of entries) {
      const childRelPath = relPath ? `${relPath}/${entryName}` : entryName;
      const isDir = handle.kind === 'directory';

      if (this.wasmService.isIgnored(childRelPath, isDir, options)) {
        continue;
      }

      if (isDir) {
        const childNode = await this.scanDirectoryHandle(
          handle as FileSystemDirectoryHandle,
          entryName,
          childRelPath,
          options
        );
        currentNode.children.push(childNode);
      } else {
        const fileHandle = handle as FileSystemFileHandle;
        const file = await fileHandle.getFile();

        currentNode.children.push({
          name: entryName,
          full_path: `${currentNode.full_path}/${entryName}`,
          rel_path: childRelPath,
          is_dir: false,
          size: file.size,
          children: [],
          fileHandle
        });
      }
    }

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
    const entries: any[] = await new Promise((resolve) => {
      dirReader.readEntries((results: any[]) => resolve(results));
    });

    entries.sort((a, b) => {
      if (a.isDirectory !== b.isDirectory) {
        return b.isDirectory ? 1 : -1;
      }
      return a.name.localeCompare(b.name);
    });

    for (const childEntry of entries) {
      const childRelPath = relPath ? `${relPath}/${childEntry.name}` : childEntry.name;
      const isDir = childEntry.isDirectory;

      if (this.wasmService.isIgnored(childRelPath, isDir, options)) {
        continue;
      }

      if (isDir) {
        const childNode = await this.scanWebkitEntry(childEntry, childEntry.name, childRelPath, options);
        currentNode.children.push(childNode);
      } else {
        const file: File = await new Promise((resolve) => childEntry.file(resolve));
        currentNode.children.push({
          name: childEntry.name,
          full_path: `${currentNode.full_path}/${childEntry.name}`,
          rel_path: childRelPath,
          is_dir: false,
          size: file.size,
          children: [],
          rawFile: file
        });
      }
    }

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
