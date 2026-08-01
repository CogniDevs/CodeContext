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
      const wasm = await import('codecontext_core');
      if (typeof wasm.default === 'function') {
        await wasm.default();
      }
      this.wasmModule = wasm;
      this.isLoaded.set(true);
    } catch (err: any) {
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
    return this.wasmModule.is_ignored_wasm(relPath, isDir, JSON.stringify(options));
  }

  traceDependencies(rootDir: string, targetRelPath: string, content: string): string[] {
    if (!this.wasmModule?.trace_dependencies_wasm) {
      return [];
    }
    return this.wasmModule.trace_dependencies_wasm(rootDir, targetRelPath, content);
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
    return this.wasmModule.build_payload_wasm(
      rootName,
      rootNodeJson,
      JSON.stringify(files),
      JSON.stringify(selectedPaths),
      JSON.stringify(options)
    );
  }
}
