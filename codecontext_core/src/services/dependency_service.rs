use regex::Regex;
use std::collections::HashSet;
use std::path::{Path, PathBuf};

pub fn trace_dependencies(root_dir: &str, target_rel_path: &str, content: &str) -> HashSet<String> {
    let mut found = HashSet::new();
    if root_dir.is_empty() || target_rel_path.is_empty() || content.is_empty() {
        return found;
    }

    let ext = Path::new(target_rel_path)
        .extension()
        .and_then(|s| s.to_str())
        .unwrap_or("")
        .to_lowercase();

    let full_target_path = Path::new(root_dir).join(target_rel_path);
    let target_dir = full_target_path.parent().unwrap_or_else(|| Path::new(root_dir));

    let mut check_and_insert = |path: PathBuf| -> bool {
        if path.is_file() {
            if let Ok(rel) = path.strip_prefix(root_dir) {
                found.insert(rel.to_string_lossy().replace('\\', "/"));
                return true;
            }
        }
        false
    };

    match ext.as_str() {
        "py" => {
            let import_re = Regex::new(r"(?m)^\s*import\s+([a-zA-Z0-9_.,\s]+)").unwrap();
            let from_re = Regex::new(r"(?m)^\s*from\s+(\.?\.?[a-zA-Z0-9_.]+)\s+import\s+([a-zA-Z0-9_.,\s()]+)").unwrap();

            let mut targets = Vec::new();

            for caps in import_re.captures_iter(content) {
                if let Some(mat) = caps.get(1) {
                    for part in mat.as_str().split(',') {
                        let clean = part.trim();
                        if !clean.is_empty() {
                            targets.push((String::new(), clean.to_string()));
                        }
                    }
                }
            }

            for caps in from_re.captures_iter(content) {
                let base = caps.get(1).map_or("", |m| m.as_str()).to_string();
                if let Some(imports_mat) = caps.get(2) {
                    let clean_imports = imports_mat.as_str()
                        .replace('(', "")
                        .replace(')', "")
                        .replace('\n', " ")
                        .replace('\r', " ");
                    for part in clean_imports.split(',') {
                        let clean_item = part.trim();
                        if !clean_item.is_empty() {
                            targets.push((base.clone(), clean_item.to_string()));
                        }
                    }
                }
            }

            for (base, item) in targets {
                let has_base = !base.is_empty();
                let full_import_path = if has_base {
                    format!("{}.{}", base, item)
                } else {
                    item.clone()
                };

                let dot_count = if has_base {
                    base.chars().take_while(|c| *c == '.').count()
                } else {
                    item.chars().take_while(|c| *c == '.').count()
                };

                let clean_path = full_import_path.trim_start_matches('.');
                let subpath = clean_path.replace('.', "/");

                let search_bases: Vec<PathBuf> = if dot_count > 0 {
                    let mut temp_base = target_dir.to_path_buf();
                    for _ in 0..(dot_count - 1) {
                        if let Some(parent) = temp_base.parent() {
                            temp_base = parent.to_path_buf();
                        }
                    }
                    vec![temp_base]
                } else {
                    vec![
                        Path::new(root_dir).to_path_buf(),
                        Path::new(root_dir).join("src"),
                        target_dir.to_path_buf(),
                    ]
                };

                for base_dir in search_bases {
                    if !subpath.is_empty() {
                        let cand1 = base_dir.join(format!("{}.py", subpath));
                        let cand2 = base_dir.join(&subpath).join("__init__.py");
                        if check_and_insert(cand1) || check_and_insert(cand2) {
                            break;
                        }
                    }
                    if has_base {
                        let base_subpath = base.trim_start_matches('.').replace('.', "/");
                        if !base_subpath.is_empty() {
                            let cand1 = base_dir.join(format!("{}.py", base_subpath));
                            let cand2 = base_dir.join(&base_subpath).join("__init__.py");
                            if check_and_insert(cand1) || check_and_insert(cand2) {
                                break;
                            }
                        }
                    }
                }
            }
        }
        "js" | "jsx" | "ts" | "tsx" => {
            let es6_re = Regex::new(r#"(?s)\bimport\s+[^"']*?\s+from\s+["'](\..*?)["']"#).unwrap();
            let dynamic_re = Regex::new(r#"\bimport\(\s*["'](\..*?)["']\s*\)"#).unwrap();
            let require_re = Regex::new(r#"\brequire\(\s*["'](\..*?)["']\s*\)"#).unwrap();

            let mut imports = Vec::new();
            for caps in es6_re.captures_iter(content) {
                if let Some(m) = caps.get(1) {
                    imports.push(m.as_str());
                }
            }
            for caps in dynamic_re.captures_iter(content) {
                if let Some(m) = caps.get(1) {
                    imports.push(m.as_str());
                }
            }
            for caps in require_re.captures_iter(content) {
                if let Some(m) = caps.get(1) {
                    imports.push(m.as_str());
                }
            }

            for rel_import in imports {
                let abs_base = target_dir.join(rel_import);
                let possible_exts = ["", ".js", ".ts", ".jsx", ".tsx", "/index.js", "/index.ts"];

                for p_ext in possible_exts {
                    let test_path = PathBuf::from(format!("{}{}", abs_base.to_string_lossy(), p_ext));
                    if check_and_insert(test_path) {
                        break;
                    }
                }
            }
        }
        "c" | "cpp" | "h" | "hpp" => {
            let include_re = Regex::new(r#"(?m)^\s*#include\s+["']([^"']+)["']"#).unwrap();
            for caps in include_re.captures_iter(content) {
                if let Some(mat) = caps.get(1) {
                    let header = mat.as_str();
                    let test_path1 = target_dir.join(header);
                    let test_path2 = Path::new(root_dir).join(header);

                    if !check_and_insert(test_path1) {
                        check_and_insert(test_path2);
                    }
                }
            }
        }
        "rs" => {
            let mod_re = Regex::new(r"(?m)^\s*(?:pub\s+)?mod\s+([a-zA-Z0-9_]+);").unwrap();
            let use_re = Regex::new(r#"(?m)^\s*(?:pub\s+)?use\s+(crate|super|self)::([a-zA-Z0-9_:]+)"#).unwrap();

            for caps in mod_re.captures_iter(content) {
                if let Some(mat) = caps.get(1) {
                    let mod_name = mat.as_str();
                    let cand1 = target_dir.join(format!("{}.rs", mod_name));
                    let cand2 = target_dir.join(mod_name).join("mod.rs");

                    if !check_and_insert(cand1) {
                        check_and_insert(cand2);
                    }
                }
            }

            for caps in use_re.captures_iter(content) {
                let base_type = caps.get(1).map_or("", |m| m.as_str());
                if let Some(path_mat) = caps.get(2) {
                    let raw_path = path_mat.as_str();
                    let subpath = raw_path.replace("::", "/");

                    let base_dir = match base_type {
                        "crate" => {
                            let src_dir = Path::new(root_dir).join("src");
                            if src_dir.is_dir() {
                                src_dir
                            } else {
                                Path::new(root_dir).to_path_buf()
                            }
                        }
                        "super" => target_dir.parent().unwrap_or(target_dir).to_path_buf(),
                        _ => target_dir.to_path_buf(),
                    };

                    let cand1 = base_dir.join(format!("{}.rs", subpath));
                    let cand2 = base_dir.join(&subpath).join("mod.rs");
                    let cand3 = base_dir.join(format!("{}/mod.rs", subpath));

                    if !check_and_insert(cand1) && !check_and_insert(cand2) {
                        check_and_insert(cand3);
                    }
                }
            }
        }
        _ => {}
    }

    found
}