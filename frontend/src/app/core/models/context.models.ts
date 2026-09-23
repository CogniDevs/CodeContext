export type Theme = 'dark' | 'light';

export interface FileNode {
  name: string;
  full_path: string;
  rel_path: string;
  is_dir: boolean;
  size: number;
  children: FileNode[];
  fileHandle?: FileSystemFileHandle;
  rawFile?: File;
  git_status?: 'modified' | 'added' | 'untracked' | 'deleted';
}

export interface ScanOptions {
  use_gitignore: boolean;
  ignore_binary: boolean;
  ignore_lockfiles: boolean;
  whitelist_extensions: string[];
  manual_excludes: string[];
  gitignore_disabled_rules: string[];
  binary_extensions: string[];
  lockfiles_excludes: string[];
  output_file_path?: string | null;
  auto_watch?: boolean;
}

export interface ScanRequest {
  root_dir: string;
  options?: ScanOptions | null;
}

export interface TransformOptions {
  strip_comments: boolean;
  compress_whitespace: boolean;
  sanitize_secrets: boolean;
  skeleton_mode: boolean;
  xml_format: boolean;
  always_send_full_tree: boolean;
  system_prompt: string;
  comment_rules_json?: string | null;
  max_token_budget?: number | null;
  git_diff_mode: boolean;
  git_diff_context_lines: number;
  git_diff_text?: string | null;
  auto_watch?: boolean;
}

export interface FilePayloadItem {
  rel_path: string;
  content: string;
}

export interface PayloadRequest {
  root_dir: string;
  root_node?: Record<string, unknown> | null;
  selected_paths: string[];
  options: TransformOptions;
  custom_files?: FilePayloadItem[] | null;
}

export interface PayloadResponse {
  payload: string;
  token_count: number;
  files_count: number;
  size_kb: number;
}

export interface StandaloneTreeRequest {
  root_name: string;
  root_node?: Record<string, unknown> | null;
  selected_paths: string[];
  xml_format: boolean;
}

export interface StandaloneTreeResponse {
  tree_text: string;
}

export interface GitStatusRequest {
  root_dir: string;
}

export interface GitStatusResponse {
  success: boolean;
  message: string;
  modified_files: string[];
}

export interface GitDiffRequest {
  root_dir: string;
  context_lines: number;
}

export interface GitDiffResponse {
  success: boolean;
  message: string;
  diff_text: string;
}

export interface DependenciesRequest {
  root_dir: string;
  target_rel_path: string;
  content?: string | null;
}

export interface DependenciesResponse {
  dependencies: string[];
}

export interface TokenCountRequest {
  text: string;
}

export interface TokenCountResponse {
  token_count: number;
}

export interface PromptPreset {
  key: string;
  title: string;
  prompt: string;
  custom?: boolean;
}

export interface RuleItem {
  id: string;
  title: string;
  description: string;
  rule_text: string;
  active: boolean;
}

export interface CustomRuleRequest {
  category: string;
  title: string;
  description: string;
  rule_text: string;
}

export interface CompilePromptRequest {
  selected_rules: Record<string, string[]>;
}

export interface CompilePromptResponse {
  compiled_prompt: string;
}

export interface SaveFileRequest {
  file_path: string;
  content: string;
}

export interface SaveFileResponse {
  success: boolean;
  message: string;
}

export interface ServiceStatus {
  status: string;
  desktop_bridge: boolean;
  rust_engine_available: boolean;
  current_version: string;
  system_platform: string;
}

export interface ContextProjectConfig {
  max_token_budget?: number;
  xml_format: boolean;
  git_diff_mode: boolean;
  strip_comments?: boolean;
  compress_whitespace?: boolean;
  sanitize_secrets?: boolean;
  skeleton_mode?: boolean;
  always_send_full_tree?: boolean;
}

export interface WatcherEvent {
  type: string;
  path: string;
  timestamp: number;
}
