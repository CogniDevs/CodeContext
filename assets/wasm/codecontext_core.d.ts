/* tslint:disable */
/* eslint-disable */

export function build_payload_wasm(root_name: string, root_node_json: string, files_json: string, selected_paths_json: string, options_json: string): string;

export function compress_whitespace_wasm(text: string): string;

export function count_tokens_wasm(text: string): number;

export function is_ignored_wasm(rel_path: string, is_dir: boolean, options_json: string): boolean;

export function sanitize_secrets_wasm(text: string): string;

export function strip_comments_wasm(text: string, extension: string, rules_json?: string | null): string;

export function trace_dependencies_wasm(root_dir: string, target_rel_path: string, content: string, all_known_paths_json?: string | null): string[];

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly build_payload_wasm: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number) => [number, number];
    readonly compress_whitespace_wasm: (a: number, b: number) => [number, number];
    readonly count_tokens_wasm: (a: number, b: number) => number;
    readonly is_ignored_wasm: (a: number, b: number, c: number, d: number, e: number) => number;
    readonly sanitize_secrets_wasm: (a: number, b: number) => [number, number];
    readonly strip_comments_wasm: (a: number, b: number, c: number, d: number, e: number, f: number) => [number, number];
    readonly trace_dependencies_wasm: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number) => [number, number];
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
    readonly __wbindgen_free: (a: number, b: number, c: number) => void;
    readonly __externref_drop_slice: (a: number, b: number) => void;
    readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
