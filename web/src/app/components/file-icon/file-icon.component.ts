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
    return this.getIconName();
  }

  get iconPath(): string {
    const icon = this.getIconName();
    return `assets/icons/material/${icon}.svg`;
  }

  private getIconName(): string {
    const lower = this.name.toLowerCase();

    if (this.isDir) {
      if (lower === 'src' || lower === 'source' || lower === 'sources' || lower === 'code') {
        return this.isExpanded ? 'folder-src-open' : 'folder-src';
      }
      if (lower === 'node_modules' || lower === 'bower_components') {
        return this.isExpanded ? 'folder-node-open' : 'folder-node';
      }
      if (lower === '.git' || lower === '.github' || lower === '.gitlab') {
        return this.isExpanded ? 'folder-git-open' : 'folder-git';
      }
      if (lower === 'dist' || lower === 'build' || lower === 'target' || lower === 'out' || lower === 'release' || lower === 'debug' || lower === 'bin' || lower === 'obj') {
        return this.isExpanded ? 'folder-target-open' : 'folder-target';
      }
      if (lower === 'docs' || lower === 'doc' || lower === 'site' || lower === 'website') {
        return this.isExpanded ? 'folder-docs-open' : 'folder-docs';
      }
      if (lower === 'test' || lower === 'tests' || lower === '__tests__' || lower === 'spec' || lower === 'specs') {
        return this.isExpanded ? 'folder-test-open' : 'folder-test';
      }
      if (lower === 'images' || lower === 'img' || lower === 'assets' || lower === 'static' || lower === 'public' || lower === 'resources' || lower === 'media') {
        return this.isExpanded ? 'folder-images-open' : 'folder-images';
      }
      if (lower === 'css' || lower === 'style' || lower === 'styles' || lower === 'scss' || lower === 'sass' || lower === 'less') {
        return this.isExpanded ? 'folder-css-open' : 'folder-css';
      }
      if (lower === 'config' || lower === 'configs' || lower === 'settings' || lower === '.vscode' || lower === '.idea' || lower === 'env' || lower === '.env') {
        return this.isExpanded ? 'folder-config-open' : 'folder-config';
      }
      if (lower === 'database' || lower === 'db' || lower === 'models' || lower === 'migrations' || lower === 'sql') {
        return this.isExpanded ? 'folder-database-open' : 'folder-database';
      }
      if (lower === 'components' || lower === 'widgets' || lower === 'ui' || lower === 'views' || lower === 'layouts') {
        return this.isExpanded ? 'folder-components-open' : 'folder-components';
      }
      if (lower === 'lib' || lower === 'libs' || lower === 'library' || lower === 'libraries' || lower === 'vendor' || lower === 'utils' || lower === 'helpers') {
        return this.isExpanded ? 'folder-lib-open' : 'folder-lib';
      }
      if (lower === 'api' || lower === 'apis' || lower === 'rest' || lower === 'controllers' || lower === 'routes' || lower === 'handlers') {
        return this.isExpanded ? 'folder-api-open' : 'folder-api';
      }
      if (lower === 'app' || lower === 'apps' || lower === 'application') {
        return this.isExpanded ? 'folder-app-open' : 'folder-app';
      }
      if (lower === 'scripts' || lower === 'tools' || lower === 'tasks') {
        return this.isExpanded ? 'folder-scripts-open' : 'folder-scripts';
      }
      if (lower === 'server' || lower === 'backend' || lower === 'service' || lower === 'services') {
        return this.isExpanded ? 'folder-server-open' : 'folder-server';
      }
      if (lower === 'client' || lower === 'frontend' || lower === 'web') {
        return this.isExpanded ? 'folder-client-open' : 'folder-client';
      }
      return this.isExpanded ? 'folder-open' : 'folder';
    }

    if (lower === 'package.json') return 'npm';
    if (lower === 'package-lock.json') return 'lock';
    if (lower === 'yarn.lock') return 'yarn';
    if (lower === 'pnpm-lock.yaml') return 'pnpm';
    if (lower === 'cargo.toml') return 'rust';
    if (lower === 'cargo.lock') return 'lock';
    if (lower === 'angular.json') return 'angular';
    if (lower === 'tsconfig.json') return 'tsconfig';
    if (lower === 'jsconfig.json') return 'tsconfig';
    if (lower === '.eslintrc' || lower === '.eslintrc.json' || lower === '.eslintrc.js' || lower === '.eslintrc.yml' || lower === '.eslintrc.yaml') return 'eslint';
    if (lower === '.prettierrc' || lower === '.prettierrc.json' || lower === '.prettierrc.js' || lower === '.prettierrc.yml' || lower === '.prettierrc.yaml') return 'prettier';
    if (lower === '.babelrc' || lower === 'babel.config.js' || lower === 'babel.config.json') return 'babel';
    if (lower === 'tailwind.config.js' || lower === 'tailwind.config.ts') return 'tailwindcss';
    if (lower === 'vite.config.js' || lower === 'vite.config.ts') return 'vite';
    if (lower === 'webpack.config.js' || lower === 'webpack.config.ts') return 'webpack';
    if (lower === 'nuxt.config.js' || lower === 'nuxt.config.ts') return 'nuxt';
    if (lower === 'next.config.js' || lower === 'next.config.mjs' || lower === 'next.config.ts') return 'next';
    if (lower === 'svelte.config.js') return 'svelte';
    if (lower === 'makefile' || lower === 'make') return 'makefile';
    if (lower === 'gltf' || lower === 'obj' || lower === 'fbx') return '3d';
    if (lower.startsWith('tsconfig') || lower === '.editorconfig') return 'settings';
    if (lower === '.gitignore' || lower === '.gitattributes' || lower === '.gitmodules') return 'git';
    if (lower === 'dockerfile' || lower.startsWith('docker-compose') || lower === '.dockerignore') return 'docker';
    if (lower === 'requirements.txt' || lower === 'pipfile' || lower === 'pyproject.toml') return 'python';
    if (lower.startsWith('readme') || lower === 'license' || lower === 'changelog') return 'readme';
    if (lower === 'gemfile') return 'gemfile';
    if (lower === 'composer.json' || lower === 'composer.lock') return 'composer';
    if (lower === 'go.mod' || lower === 'go.sum') return 'go';
    if (lower === 'jenkinsfile') return 'jenkins';
    if (lower === 'procfile') return 'heroku';
    if (lower === 'firebase.json') return 'firebase';
    if (lower === 'vue.config.js' || lower === 'vue.config.ts') return 'vue';

    const ext = lower.split('.').pop() || '';
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
      case 'tiff':
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
      case 'mdb':
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
      case 'clj':
      case 'cljs':
        return 'clojure';
      case 'el':
      case 'elc':
        return 'emacs';
      case 'hs':
      case 'lhs':
        return 'haskell';
      case 'ex':
      case 'exs':
        return 'elixir';
      case 'erl':
      case 'hrl':
        return 'erlang';
      case 'lua':
        return 'lua';
      case 'pl':
        return 'pm';
        return 'perl';
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