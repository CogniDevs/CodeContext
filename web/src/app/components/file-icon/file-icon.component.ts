import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-file-icon',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './file-icon.component.html',
  styleUrl: './file-icon.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FileIconComponent {
  @Input() name = '';
  @Input() isDir = false;
  @Input() isExpanded = false;

  get iconType(): string {
    const lower = this.name.toLowerCase();

    if (this.isDir) {
      if (lower === 'src' || lower === 'source') return this.isExpanded ? 'folder-src-open' : 'folder-src';
      if (lower === 'node_modules') return this.isExpanded ? 'folder-node-open' : 'folder-node';
      if (lower === '.git' || lower === '.github') return this.isExpanded ? 'folder-git-open' : 'folder-git';
      if (lower === 'dist' || lower === 'build' || lower === 'target' || lower === 'out') return this.isExpanded ? 'folder-build-open' : 'folder-build';
      return this.isExpanded ? 'folder-open' : 'folder';
    }

    if (lower === 'package.json') return 'npm';
    if (lower === 'package-lock.json' || lower === 'yarn.lock' || lower === 'pnpm-lock.yaml' || lower === 'cargo.lock') return 'lock';
    if (lower === 'cargo.toml') return 'rust';
    if (lower === 'angular.json') return 'angular';
    if (lower.startsWith('tsconfig') || lower === '.editorconfig') return 'config';
    if (lower === '.gitignore' || lower === '.gitattributes') return 'git';
    if (lower === 'dockerfile' || lower.startsWith('docker-compose')) return 'docker';
    if (lower === 'requirements.txt' || lower === 'pipfile' || lower === 'pyproject.toml') return 'python';
    if (lower.startsWith('readme') || lower === 'license') return 'markdown';

    const ext = lower.split('.').pop() || '';
    switch (ext) {
      case 'ts':
      case 'mts':
      case 'cts':
        return 'typescript';
      case 'js':
      case 'mjs':
      case 'cjs':
      case 'jsx':
      case 'tsx':
        return 'javascript';
      case 'py':
      case 'ipynb':
        return 'python';
      case 'rs':
        return 'rust';
      case 'json':
        return 'json';
      case 'md':
      case 'markdown':
        return 'markdown';
      case 'html':
      case 'htm':
        return 'html';
      case 'scss':
      case 'sass':
      case 'less':
        return 'scss';
      case 'css':
        return 'css';
      case 'git':
        return 'git';
      case 'sh':
      case 'bash':
      case 'zsh':
      case 'bat':
      case 'ps1':
        return 'shell';
      case 'cpp':
      case 'cxx':
      case 'cc':
      case 'c':
      case 'h':
      case 'hpp':
        return 'cpp';
      case 'java':
      case 'kt':
      case 'kts':
        return 'java';
      case 'go':
        return 'go';
      case 'png':
      case 'jpg':
      case 'jpeg':
      case 'gif':
      case 'svg':
      case 'ico':
      case 'webp':
        return 'image';
      default:
        return 'file-generic';
    }
  }
}
