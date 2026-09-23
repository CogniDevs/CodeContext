import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  signal,
} from '@angular/core';

@Component({
  selector: 'app-file-icon',
  templateUrl: './file-icon.component.html',
  styleUrl: './file-icon.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
})
export class FileIconComponent {
  readonly name = input<string>('');
  readonly isDir = input<boolean>(false);
  readonly isExpanded = input<boolean>(false);

  private readonly hasLoadError = signal<boolean>(false);

  readonly iconName = computed<string>(() => {
    if (this.hasLoadError()) {
      return this.isDir()
        ? this.isExpanded()
          ? 'folder-open'
          : 'folder'
        : 'file';
    }
    return this.resolveIconName();
  });

  readonly iconPath = computed<string>(() => {
    return `assets/icons/material/${this.iconName()}.svg`;
  });

  protected onIconError(): void {
    this.hasLoadError.set(true);
  }

  private resolveIconName(): string {
    const raw = this.name().toLowerCase();

    if (this.isDir()) {
      if (
        raw === 'src' ||
        raw === 'source' ||
        raw === 'sources' ||
        raw === 'code'
      ) {
        return this.isExpanded() ? 'folder-src-open' : 'folder-src';
      }
      if (raw === 'node_modules' || raw === 'bower_components') {
        return this.isExpanded() ? 'folder-node-open' : 'folder-node';
      }
      if (raw === '.git' || raw === '.github' || raw === '.gitlab') {
        return this.isExpanded() ? 'folder-git-open' : 'folder-git';
      }
      if (
        raw === 'dist' ||
        raw === 'build' ||
        raw === 'target' ||
        raw === 'out' ||
        raw === 'release' ||
        raw === 'debug' ||
        raw === 'bin' ||
        raw === 'obj'
      ) {
        return this.isExpanded() ? 'folder-target-open' : 'folder-target';
      }
      if (
        raw === 'docs' ||
        raw === 'doc' ||
        raw === 'site' ||
        raw === 'website'
      ) {
        return this.isExpanded() ? 'folder-docs-open' : 'folder-docs';
      }
      if (
        raw === 'test' ||
        raw === 'tests' ||
        raw === '__tests__' ||
        raw === 'spec' ||
        raw === 'specs'
      ) {
        return this.isExpanded() ? 'folder-test-open' : 'folder-test';
      }
      if (
        raw === 'images' ||
        raw === 'img' ||
        raw === 'assets' ||
        raw === 'static' ||
        raw === 'public' ||
        raw === 'resources' ||
        raw === 'media'
      ) {
        return this.isExpanded() ? 'folder-images-open' : 'folder-images';
      }
      if (
        raw === 'css' ||
        raw === 'style' ||
        raw === 'styles' ||
        raw === 'scss' ||
        raw === 'sass' ||
        raw === 'less'
      ) {
        return this.isExpanded() ? 'folder-css-open' : 'folder-css';
      }
      if (
        raw === 'config' ||
        raw === 'configs' ||
        raw === 'settings' ||
        raw === '.vscode' ||
        raw === '.idea' ||
        raw === 'env' ||
        raw === '.env'
      ) {
        return this.isExpanded() ? 'folder-config-open' : 'folder-config';
      }
      if (
        raw === 'database' ||
        raw === 'db' ||
        raw === 'models' ||
        raw === 'migrations' ||
        raw === 'sql'
      ) {
        return this.isExpanded() ? 'folder-database-open' : 'folder-database';
      }
      if (
        raw === 'components' ||
        raw === 'widgets' ||
        raw === 'ui' ||
        raw === 'views' ||
        raw === 'layouts'
      ) {
        return this.isExpanded()
          ? 'folder-components-open'
          : 'folder-components';
      }
      if (
        raw === 'lib' ||
        raw === 'libs' ||
        raw === 'library' ||
        raw === 'libraries' ||
        raw === 'vendor' ||
        raw === 'utils' ||
        raw === 'helpers'
      ) {
        return this.isExpanded() ? 'folder-lib-open' : 'folder-lib';
      }
      if (
        raw === 'api' ||
        raw === 'apis' ||
        raw === 'rest' ||
        raw === 'controllers' ||
        raw === 'routes' ||
        raw === 'handlers'
      ) {
        return this.isExpanded() ? 'folder-api-open' : 'folder-api';
      }
      if (raw === 'app' || raw === 'apps' || raw === 'application') {
        return this.isExpanded() ? 'folder-app-open' : 'folder-app';
      }
      if (raw === 'scripts' || raw === 'tools' || raw === 'tasks') {
        return this.isExpanded() ? 'folder-scripts-open' : 'folder-scripts';
      }
      if (
        raw === 'server' ||
        raw === 'backend' ||
        raw === 'service' ||
        raw === 'services'
      ) {
        return this.isExpanded() ? 'folder-server-open' : 'folder-server';
      }
      if (raw === 'client' || raw === 'frontend' || raw === 'web') {
        return this.isExpanded() ? 'folder-client-open' : 'folder-client';
      }
      return this.isExpanded() ? 'folder-open' : 'folder';
    }

    if (raw === 'package.json') return 'npm';
    if (raw === 'package-lock.json') return 'lock';
    if (raw === 'yarn.lock') return 'yarn';
    if (raw === 'pnpm-lock.yaml') return 'pnpm';
    if (raw === 'cargo.toml') return 'rust';
    if (raw === 'cargo.lock') return 'lock';
    if (raw === 'angular.json') return 'angular';
    if (raw === 'tsconfig.json') return 'tsconfig';
    if (raw === 'jsconfig.json') return 'tsconfig';
    if (raw.startsWith('.eslintrc')) return 'eslint';
    if (raw.startsWith('.prettierrc')) return 'prettier';
    if (raw.startsWith('tailwind.config')) return 'tailwindcss';
    if (raw.startsWith('vite.config')) return 'vite';
    if (raw.startsWith('webpack.config')) return 'webpack';
    if (
      raw.startsWith('dockerfile') ||
      raw.startsWith('docker-compose') ||
      raw === '.dockerignore'
    )
      return 'docker';
    if (
      raw === 'requirements.txt' ||
      raw === 'pipfile' ||
      raw === 'pyproject.toml'
    )
      return 'python';
    if (
      raw.startsWith('readme') ||
      raw.startsWith('license') ||
      raw.startsWith('changelog')
    )
      return 'readme';
    if (raw === 'cmakelists.txt') return 'cpp';
    if (
      raw === '.gitignore' ||
      raw === '.gitattributes' ||
      raw === '.gitmodules'
    )
      return 'git';

    const dotIndex = raw.lastIndexOf('.');
    if (dotIndex === -1) {
      return 'file';
    }

    const ext = raw.substring(dotIndex + 1);
    switch (ext) {
      case 'ts':
      case 'mts':
      case 'cts':
        return 'typescript';
      case 'js':
      case 'mjs':
      case 'cjs':
        return 'javascript';
      case 'jsx':
        return 'react';
      case 'tsx':
        return 'react_ts';
      case 'py':
      case 'ipynb':
      case 'pyc':
      case 'pyd':
        return 'python';
      case 'rs':
      case 'rlib':
      case 'rmeta':
        return 'rust';
      case 'json':
        return 'json';
      case 'md':
      case 'markdown':
        return 'markdown';
      case 'html':
      case 'htm':
      case 'xhtml':
        return 'html';
      case 'scss':
      case 'sass':
        return 'sass';
      case 'css':
        return 'css';
      case 'sh':
      case 'bash':
      case 'zsh':
      case 'bat':
      case 'cmd':
      case 'ps1':
        return 'console';
      case 'cpp':
      case 'cxx':
      case 'cc':
      case 'c':
      case 'h':
      case 'hpp':
      case 'hxx':
      case 'cmake':
        return 'cpp';
      case 'java':
      case 'class':
      case 'jar':
        return 'java';
      case 'kt':
      case 'kts':
        return 'kotlin';
      case 'go':
        return 'go';
      case 'png':
      case 'jpg':
      case 'jpeg':
      case 'gif':
      case 'svg':
      case 'ico':
      case 'webp':
      case 'bmp':
      case 'psd':
        return 'image';
      case 'mp4':
      case 'mov':
      case 'avi':
      case 'mkv':
      case 'webm':
      case 'flv':
        return 'video';
      case 'mp3':
      case 'wav':
      case 'ogg':
      case 'flac':
      case 'aac':
      case 'm4a':
        return 'audio';
      case 'zip':
      case 'tar':
      case 'gz':
      case 'tgz':
      case 'rar':
      case '7z':
      case 'dmg':
      case 'iso':
        return 'zip';
      case 'cs':
      case 'csproj':
      case 'sln':
        return 'csharp';
      case 'swift':
        return 'swift';
      case 'dart':
        return 'dart';
      case 'rb':
      case 'ru':
      case 'gemspec':
        return 'ruby';
      case 'tf':
      case 'tfvars':
        return 'terraform';
      case 'sql':
      case 'sqlite':
      case 'sqlite3':
      case 'db':
        return 'database';
      case 'yaml':
      case 'yml':
        return 'yaml';
      case 'toml':
        return 'toml';
      case 'xml':
        return 'xml';
      case 'ini':
      case 'conf':
      case 'cfg':
      case 'properties':
        return 'settings';
      case 'vue':
        return 'vue';
      case 'svelte':
        return 'svelte';
      case 'astro':
        return 'astro';
      case 'graphql':
      case 'gql':
        return 'graphql';
      case 'pdf':
        return 'pdf';
      case 'csv':
        return 'table';
      case 'xlsx':
      case 'xls':
        return 'excel';
      case 'docx':
      case 'doc':
        return 'word';
      case 'pptx':
      case 'ppt':
        return 'powerpoint';
      case 'gradle':
        return 'gradle';
      case 'wasm':
        return 'wasm';
      case 'scala':
        return 'scala';
      case 'lua':
        return 'lua';
      case 'php':
        return 'php';
      case 'r':
      case 'rmd':
        return 'r';
      case 'zig':
        return 'zig';
      default:
        return 'file';
    }
  }
}
