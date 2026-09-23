import { Injectable, signal } from '@angular/core';

import { ScanOptions, TransformOptions } from '@models/context.models';

interface WasmCoreModule {
  default?: (moduleOrPath?: unknown) => Promise<unknown>;
  compress_whitespace_wasm: (text: string) => string;
  sanitize_secrets_wasm: (text: string) => string;
  strip_comments_wasm: (
    text: string,
    extension: string,
    rulesJson?: string | null,
  ) => string;
  count_tokens_wasm: (text: string) => number;
  is_ignored_wasm: (
    relPath: string,
    isDir: boolean,
    optionsJson: string,
  ) => boolean;
  trace_dependencies_wasm: (
    rootDir: string,
    targetRelPath: string,
    content: string,
    allKnownPathsJson?: string | null,
  ) => string[];
  generate_standalone_tree_wasm: (
    rootName: string,
    rootNodeJson: string,
    selectedPathsJson: string,
    xmlFormat: boolean,
  ) => string;
  build_payload_wasm: (
    rootName: string,
    rootNodeJson: string,
    filesJson: string,
    selectedPathsJson: string,
    optionsJson: string,
  ) => string;
  calculate_pagerank_wasm: (
    symbolsJson: string,
    edgesJson: string,
    damping: number,
    iterations: number,
  ) => string;
}

@Injectable({
  providedIn: 'root',
})
export class WasmService {
  readonly isLoaded = signal<boolean>(false);
  readonly error = signal<string | null>(null);

  private wasmModule: WasmCoreModule | null = null;
  private initPromise: Promise<void> | null = null;

  async init(): Promise<void> {
    if (this.isLoaded()) {
      return;
    }

    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = this.loadWasmModule();
    return this.initPromise;
  }

  private async loadWasmModule(): Promise<void> {
    try {
      const baseUrl = document.baseURI.endsWith('/')
        ? document.baseURI
        : `${document.baseURI}/`;
      const jsUrl = new URL('assets/wasm/codecontext_core.js', baseUrl).href;
      const wasm = (await import(/* @vite-ignore */ jsUrl)) as WasmCoreModule;

      const wasmUrl = new URL('assets/wasm/codecontext_core_bg.wasm', baseUrl)
        .href;

      if (typeof wasm.default === 'function') {
        await wasm.default(wasmUrl);
      }

      this.wasmModule = wasm;
      this.isLoaded.set(true);
      this.error.set(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.error.set(message);
      this.isLoaded.set(false);
      this.initPromise = null;
    }
  }

  compressWhitespace(text: string): string {
    return this.wasmModule
      ? this.wasmModule.compress_whitespace_wasm(text)
      : text;
  }

  sanitizeSecrets(text: string): string {
    return this.wasmModule ? this.wasmModule.sanitize_secrets_wasm(text) : text;
  }

  stripComments(
    text: string,
    extension: string,
    rulesJson?: string | null,
  ): string {
    return this.wasmModule
      ? this.wasmModule.strip_comments_wasm(text, extension, rulesJson)
      : text;
  }

  countTokens(text: string): number {
    if (this.wasmModule) {
      return this.wasmModule.count_tokens_wasm(text);
    }
    return Math.round(text.length / 3.3);
  }

  isIgnored(relPath: string, isDir: boolean, options: ScanOptions): boolean {
    if (!this.wasmModule) {
      return false;
    }
    return this.wasmModule.is_ignored_wasm(
      relPath,
      isDir,
      JSON.stringify(options),
    );
  }

  traceDependencies(
    rootDir: string,
    targetRelPath: string,
    content: string,
    allKnownPaths?: string[] | null,
  ): string[] {
    if (!this.wasmModule) {
      return [];
    }
    const knownPathsJson =
      allKnownPaths && allKnownPaths.length > 0
        ? JSON.stringify(allKnownPaths)
        : null;
    return this.wasmModule.trace_dependencies_wasm(
      rootDir,
      targetRelPath,
      content,
      knownPathsJson,
    );
  }

  generateStandaloneTree(
    rootName: string,
    rootNodeJson: string,
    selectedPaths: string[],
    xmlFormat: boolean,
  ): string {
    if (!this.wasmModule) {
      return '';
    }
    return this.wasmModule.generate_standalone_tree_wasm(
      rootName,
      rootNodeJson,
      JSON.stringify(selectedPaths),
      xmlFormat,
    );
  }

  buildPayload(
    rootName: string,
    rootNodeJson: string,
    files: Array<[string, string]>,
    selectedPaths: string[],
    options: TransformOptions,
  ): string {
    if (!this.wasmModule) {
      return '';
    }
    return this.wasmModule.build_payload_wasm(
      rootName,
      rootNodeJson,
      JSON.stringify(files),
      JSON.stringify(selectedPaths),
      JSON.stringify(options),
    );
  }

  calculatePageRank(
    symbolsJson: string,
    edgesJson: string,
    damping: number = 0.85,
    iterations: number = 20,
  ): string {
    if (!this.wasmModule) {
      return '{}';
    }
    return this.wasmModule.calculate_pagerank_wasm(
      symbolsJson,
      edgesJson,
      damping,
      iterations,
    );
  }
}
