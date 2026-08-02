import { Injectable, signal } from '@angular/core';

export interface ScanOptionsWasm {
  use_gitignore: boolean;
  ignore_binary: boolean;
  ignore_lockfiles: boolean;
  whitelist_extensions: string[];
  manual_excludes: string[];
  gitignore_disabled_rules: string[];
  binary_extensions: string[];
  lockfiles_excludes: string[];
  output_file_path?: string | null;
}

export interface TransformOptionsWasm {
  strip_comments: boolean;
  compress_whitespace: boolean;
  sanitize_secrets: boolean;
  skeleton_mode: boolean;
  xml_format: boolean;
  always_send_full_tree: boolean;
  system_prompt: string;
  comment_rules_json?: string | null;
}

@Injectable({
  providedIn: 'root'
})
export class WasmService {
  readonly isLoaded = signal<boolean>(false);
  readonly error = signal<string | null>(null);

  private wasmModule: any = null;

  async init(): Promise<void> {
    if (this.isLoaded()) {
      return;
    }

    try {
      const jsUrl = new URL('assets/wasm/codecontext_core.js', document.baseURI).href;
      const wasm = await import(/* @vite-ignore */ jsUrl);

      const wasmUrl = new URL('assets/wasm/codecontext_core_bg.wasm', document.baseURI).href;

      if (typeof wasm.default === 'function') {
        await wasm.default(wasmUrl);
      }
      this.wasmModule = wasm;
      this.isLoaded.set(true);
    } catch (err: any) {
      console.error('[CodeContext WASM Init Error]', err);
      this.error.set(err?.message || 'Failed to initialize WebAssembly core');
    }
  }

  compressWhitespace(text: string): string {
    if (!this.wasmModule?.compress_whitespace_wasm) {
      return text;
    }
    return this.wasmModule.compress_whitespace_wasm(text);
  }

  sanitizeSecrets(text: string): string {
    if (!this.wasmModule?.sanitize_secrets_wasm) {
      return text;
    }
    return this.wasmModule.sanitize_secrets_wasm(text);
  }

  stripComments(text: string, extension: string, rulesJson?: string): string {
    if (!this.wasmModule?.strip_comments_wasm) {
      return text;
    }
    return this.wasmModule.strip_comments_wasm(text, extension, rulesJson);
  }

  countTokens(text: string): number {
    if (!this.wasmModule?.count_tokens_wasm) {
      return Math.round(text.length / 3.3);
    }
    return this.wasmModule.count_tokens_wasm(text);
  }

  isIgnored(relPath: string, isDir: boolean, options: ScanOptionsWasm): boolean {
    if (!this.wasmModule?.is_ignored_wasm) {
      return false;
    }
    const cleanOptions: ScanOptionsWasm = {
      use_gitignore: options?.use_gitignore ?? true,
      ignore_binary: options?.ignore_binary ?? true,
      ignore_lockfiles: options?.ignore_lockfiles ?? true,
      whitelist_extensions: options?.whitelist_extensions || [],
      manual_excludes: options?.manual_excludes || [],
      gitignore_disabled_rules: options?.gitignore_disabled_rules || [],
      binary_extensions: options?.binary_extensions || [],
      lockfiles_excludes: options?.lockfiles_excludes || [],
      output_file_path: options?.output_file_path ?? null
    };
    return this.wasmModule.is_ignored_wasm(relPath, isDir, JSON.stringify(cleanOptions));
  }

  traceDependencies(
    rootDir: string,
    targetRelPath: string,
    content: string,
    allKnownPaths?: string[]
  ): string[] {
    if (!this.wasmModule?.trace_dependencies_wasm) {
      return [];
    }
    const knownPathsJson = allKnownPaths && allKnownPaths.length > 0 ? JSON.stringify(allKnownPaths) : null;
    return this.wasmModule.trace_dependencies_wasm(rootDir, targetRelPath, content, knownPathsJson);
  }

  buildPayload(
    rootName: string,
    rootNodeJson: string,
    files: Array<[string, string]>,
    selectedPaths: string[],
    options: TransformOptionsWasm
  ): string {
    if (!this.wasmModule?.build_payload_wasm) {
      return '';
    }
    const cleanOptions: TransformOptionsWasm = {
      strip_comments: options?.strip_comments ?? false,
      compress_whitespace: options?.compress_whitespace ?? false,
      sanitize_secrets: options?.sanitize_secrets ?? false,
      skeleton_mode: options?.skeleton_mode ?? false,
      xml_format: options?.xml_format ?? true,
      always_send_full_tree: options?.always_send_full_tree ?? true,
      system_prompt: options?.system_prompt || '',
      comment_rules_json: options?.comment_rules_json ?? null
    };
    return this.wasmModule.build_payload_wasm(
      rootName,
      rootNodeJson,
      JSON.stringify(files),
      JSON.stringify(selectedPaths),
      JSON.stringify(cleanOptions)
    );
  }
}