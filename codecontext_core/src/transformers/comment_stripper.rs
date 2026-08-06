use regex::Regex;
use serde::Deserialize;
use std::collections::HashMap;
use std::sync::OnceLock;

static C_STYLE_RE: OnceLock<Regex> = OnceLock::new();
static PYTHON_RE: OnceLock<Regex> = OnceLock::new();
static PYTHON_DOC_RE: OnceLock<Regex> = OnceLock::new();
static XML_RE: OnceLock<Regex> = OnceLock::new();
static HASH_RE: OnceLock<Regex> = OnceLock::new();
static SQL_RE: OnceLock<Regex> = OnceLock::new();

#[derive(Debug, Deserialize)]
struct CommentRule {
    extensions: Vec<String>,
    pattern: Option<String>,
    hash_pattern: Option<String>,
    docstring_pattern: Option<String>,
}

#[derive(Debug, Deserialize)]
struct CommentRulesConfig {
    rules: HashMap<String, CommentRule>,
}

#[cfg(not(target_arch = "wasm32"))]
fn strip_comments_treesitter(text: &str, language: tree_sitter::Language) -> Option<String> {
    let mut parser = tree_sitter::Parser::new();
    if parser.set_language(&language).is_err() {
        return None;
    }
    let tree = parser.parse(text, None)?;
    let root = tree.root_node();

    let mut comment_ranges = Vec::new();
    let mut stack = vec![root];
    let mut cursor = root.walk();

    while let Some(node) = stack.pop() {
        let kind = node.kind();
        if kind.contains("comment") {
            comment_ranges.push((node.start_byte(), node.end_byte()));
        } else {
            for child in node.children(&mut cursor) {
                stack.push(child);
            }
        }
    }

    if comment_ranges.is_empty() {
        return Some(text.to_string());
    }

    comment_ranges.sort_by(|a, b| a.0.cmp(&b.0));

    let mut merged_ranges: Vec<(usize, usize)> = Vec::new();
    for (start, end) in comment_ranges {
        if let Some(last) = merged_ranges.last_mut() {
            if start < last.1 {
                if end > last.1 {
                    last.1 = end;
                }
                continue;
            }
        }
        merged_ranges.push((start, end));
    }

    let text_bytes = text.as_bytes();
    let text_len = text_bytes.len();
    let mut result = Vec::with_capacity(text_len);
    let mut last_idx = 0;

    for (start, end) in merged_ranges {
        let start_clamped = start.min(text_len);
        let end_clamped = end.min(text_len);

        if start_clamped > last_idx {
            result.extend_from_slice(&text_bytes[last_idx..start_clamped]);
        }
        if end_clamped > last_idx {
            last_idx = end_clamped;
        }
    }

    if last_idx < text_len {
        result.extend_from_slice(&text_bytes[last_idx..]);
    }

    String::from_utf8(result).ok()
}

pub fn strip_comments(text: &str, extension: &str, rules_json: Option<&str>) -> String {
    let ext = extension.trim_start_matches('.').to_lowercase();
    let ext_with_dot = format!(".{}", ext);

    if let Some(json_str) = rules_json {
        if !json_str.trim().is_empty() {
            if let Ok(config) = serde_json::from_str::<CommentRulesConfig>(json_str) {
                for (rule_name, rule_data) in &config.rules {
                    let matches_ext = rule_data
                        .extensions
                        .iter()
                        .any(|e| e.to_lowercase() == ext || e.to_lowercase() == ext_with_dot);

                    if matches_ext {
                        if rule_name == "python_style" {
                            let mut cleaned = text.to_string();
                            let h_pat = rule_data.hash_pattern.as_deref().unwrap_or(r#"(?m)("(?:\\.|[^"\\])*")|('(?:\\.|[^'\\])*')|(#.*$)"#);
                            if let Ok(re) = Regex::new(h_pat) {
                                cleaned = re.replace_all(&cleaned, |caps: &regex::Captures| {
                                    if let Some(m) = caps.get(1) {
                                        m.as_str().to_string()
                                    } else if let Some(m) = caps.get(2) {
                                        m.as_str().to_string()
                                    } else {
                                        let comment = caps.get(3).map_or("", |m| m.as_str());
                                        if comment.starts_with("#!") {
                                            comment.to_string()
                                        } else {
                                            String::new()
                                        }
                                    }
                                }).to_string();
                            }

                            let d_pat = rule_data.docstring_pattern.as_deref().unwrap_or(r#"(?m)^\s*("""[\s\S]*?"""|'''[\s\S]*?''')\s*$"#);
                            if let Ok(re) = Regex::new(d_pat) {
                                cleaned = re.replace_all(&cleaned, "").to_string();
                            }
                            return cleaned;
                        } else if let Some(pattern) = &rule_data.pattern {
                            if let Ok(re) = Regex::new(pattern) {
                                return re.replace_all(text, |caps: &regex::Captures| {
                                    if let Some(m) = caps.get(1) {
                                        m.as_str().to_string()
                                    } else if let Some(m) = caps.get(2) {
                                        m.as_str().to_string()
                                    } else if let Some(m) = caps.get(3) {
                                        m.as_str().to_string()
                                    } else {
                                        String::new()
                                    }
                                }).to_string();
                            }
                        }
                    }
                }
            }
        }
    }

    #[cfg(not(target_arch = "wasm32"))]
    {
        let ts_lang: Option<tree_sitter::Language> = match ext.as_str() {
            "py" | "ipynb" => Some(tree_sitter_python::language().into()),
            "rs" => Some(tree_sitter_rust::language().into()),
            "ts" | "js" => Some(tree_sitter_typescript::language_typescript().into()),
            "tsx" | "jsx" => Some(tree_sitter_typescript::language_tsx().into()),
            "c" | "h" => Some(tree_sitter_c::language().into()),
            "cpp" | "hpp" | "cc" | "cxx" => Some(tree_sitter_cpp::language().into()),
            "go" => Some(tree_sitter_go::language().into()),
            "java" => Some(tree_sitter_java::language().into()),
            _ => None,
        };

        if let Some(lang) = ts_lang {
            if let Some(cleaned) = strip_comments_treesitter(text, lang) {
                return cleaned;
            }
        }
    }

    match ext.as_str() {
        "js" | "jsx" | "ts" | "tsx" | "c" | "cpp" | "h" | "hpp" | "go" | "rs" | "java" | "cs"
        | "php" | "css" | "scss" | "dart" | "kt" | "kts" | "m" | "gradle" | "shader"
        | "cginc" | "hlsl" | "swift" => strip_c_style(text),
        "py" | "ipynb" => strip_python(text),
        "html" | "xml" | "svelte" | "vue" | "astro" | "svg" | "plist" => strip_xml(text),
        "sh" | "bash" | "yaml" | "yml" | "toml" | "ini" | "rb" | "ru" | "tf" | "tfvars"
        | "dockerfile" | "makefile" | "properties" | "cmake" => strip_hash(text),
        "sql" => strip_sql(text),
        _ => text.to_string(),
    }
}

fn strip_c_style(text: &str) -> String {
    let re = C_STYLE_RE.get_or_init(|| {
        Regex::new(r#"(?m)("(?:\\.|[^"\\])*")|('(?:\\.|[^'\\])*')|(`(?:\\.|[^`\\])*`)|(//.*$)|(/\*[\s\S]*?\*/)"#).unwrap()
    });
    re.replace_all(text, |caps: &regex::Captures| {
        if let Some(m) = caps.get(1) {
            m.as_str().to_string()
        } else if let Some(m) = caps.get(2) {
            m.as_str().to_string()
        } else if let Some(m) = caps.get(3) {
            m.as_str().to_string()
        } else {
            String::new()
        }
    })
    .to_string()
}

fn strip_python(text: &str) -> String {
    let re = PYTHON_RE.get_or_init(|| {
        Regex::new(r#"(?m)("(?:\\.|[^"\\])*")|('(?:\\.|[^'\\])*')|(#.*$)"#).unwrap()
    });
    let cleaned = re
        .replace_all(text, |caps: &regex::Captures| {
            if let Some(m) = caps.get(1) {
                m.as_str().to_string()
            } else if let Some(m) = caps.get(2) {
                m.as_str().to_string()
            } else {
                let comment = caps.get(3).map_or("", |m| m.as_str());
                if comment.starts_with("#!") {
                    comment.to_string()
                } else {
                    String::new()
                }
            }
        })
        .to_string();

    let docstring_re = PYTHON_DOC_RE.get_or_init(|| {
        Regex::new(r#"(?m)^\s*("""[\s\S]*?"""|'''[\s\S]*?''')\s*$"#).unwrap()
    });
    docstring_re.replace_all(&cleaned, "").to_string()
}

fn strip_xml(text: &str) -> String {
    let re = XML_RE.get_or_init(|| {
        Regex::new(r#"(<!--[\s\S]*?-->)"#).unwrap()
    });
    re.replace_all(text, "").to_string()
}

fn strip_hash(text: &str) -> String {
    let re = HASH_RE.get_or_init(|| {
        Regex::new(r#"(?m)("(?:\\.|[^"\\])*")|('(?:\\.|[^'\\])*')|(#.*$)"#).unwrap()
    });
    re.replace_all(text, |caps: &regex::Captures| {
        if let Some(m) = caps.get(1) {
            m.as_str().to_string()
        } else if let Some(m) = caps.get(2) {
            m.as_str().to_string()
        } else {
            String::new()
        }
    })
    .to_string()
}

fn strip_sql(text: &str) -> String {
    let re = SQL_RE.get_or_init(|| {
        Regex::new(r#"(?m)("(?:\\.|[^"\\])*")|('(?:\\.|[^'\\])*')|(--.*$)|(/\*[\s\S]*?\*/)"#).unwrap()
    });
    re.replace_all(text, |caps: &regex::Captures| {
        if let Some(m) = caps.get(1) {
            m.as_str().to_string()
        } else if let Some(m) = caps.get(2) {
            m.as_str().to_string()
        } else {
            String::new()
        }
    })
    .to_string()
}