use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct ScanOptions {
    pub use_gitignore: bool,
    pub ignore_binary: bool,
    pub ignore_lockfiles: bool,
    pub whitelist_extensions: Vec<String>,
    pub manual_excludes: Vec<String>,
    pub gitignore_disabled_rules: Vec<String>,
    pub binary_extensions: Vec<String>,
    pub lockfiles_excludes: Vec<String>,
    pub output_file_path: Option<String>,
}

impl Default for ScanOptions {
    fn default() -> Self {
        Self {
            use_gitignore: true,
            ignore_binary: true,
            ignore_lockfiles: true,
            whitelist_extensions: Vec::new(),
            manual_excludes: vec![
                ".git".to_string(),
                "node_modules".to_string(),
                "dist".to_string(),
                "target".to_string(),
                ".angular".to_string(),
                "build".to_string(),
                "out".to_string(),
                "__pycache__".to_string(),
                ".venv".to_string(),
                "venv".to_string(),
            ],
            gitignore_disabled_rules: Vec::new(),
            binary_extensions: Vec::new(),
            lockfiles_excludes: Vec::new(),
            output_file_path: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct TransformOptions {
    pub strip_comments: bool,
    pub compress_whitespace: bool,
    pub sanitize_secrets: bool,
    pub skeleton_mode: bool,
    pub xml_format: bool,
    pub always_send_full_tree: bool,
    pub system_prompt: String,
    pub comment_rules_json: Option<String>,
    pub max_token_budget: Option<usize>,
    pub git_diff_mode: bool,
    pub git_diff_context_lines: usize,
}

impl Default for TransformOptions {
    fn default() -> Self {
        Self {
            strip_comments: false,
            compress_whitespace: false,
            sanitize_secrets: false,
            skeleton_mode: false,
            xml_format: true,
            always_send_full_tree: false,
            system_prompt: String::new(),
            comment_rules_json: None,
            max_token_budget: None,
            git_diff_mode: false,
            git_diff_context_lines: 3,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileNode {
    pub name: String,
    pub full_path: String,
    pub rel_path: String,
    pub is_dir: bool,
    pub size: u64,
    pub children: Vec<FileNode>,
}

impl FileNode {
    pub fn new(name: String, full_path: String, rel_path: String, is_dir: bool, size: u64) -> Self {
        Self {
            name,
            full_path,
            rel_path,
            is_dir,
            size,
            children: Vec::new(),
        }
    }
}