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

    match ext.as_str() {
        "py" => {
            if let Ok(re) = Regex::new(r"(?m)^\s*(?:from|import)\s+(\.?\.?[a-zA-Z0-9_.]+)") {
                for caps in re.captures_iter(content) {
                    if let Some(mat) = caps.get(1) {
                        let raw_import = mat.as_str();
                        let dot_count = raw_import.chars().take_while(|c| *c == '.').count();
                        let module_part = raw_import.trim_start_matches('.');

                        let search_bases: Vec<PathBuf> = if dot_count > 0 {
                            let mut base = target_dir.to_path_buf();
                            for _ in 0..(dot_count - 1) {
                                if let Some(parent) = base.parent() {
                                    base = parent.to_path_buf();
                                }
                            }
                            vec![base]
                        } else {
                            vec![
                                Path::new(root_dir).to_path_buf(),
                                Path::new(root_dir).join("src"),
                                target_dir.to_path_buf(),
                            ]
                        };

                        let subpath = module_part.replace('.', "/");
                        for base in search_bases {
                            let cand1 = if !subpath.is_empty() {
                                base.join(format!("{}.py", subpath))
                            } else {
                                PathBuf::new()
                            };
                            let cand2 = if !subpath.is_empty() {
                                base.join(&subpath).join("__init__.py")
                            } else {
                                base.join("__init__.py")
                            };

                            if cand1.is_file() {
                                if let Ok(rel) = cand1.strip_prefix(root_dir) {
                                    found.insert(rel.to_string_lossy().replace('\\', "/"));
                                    break;
                                }
                            }
                            if cand2.is_file() {
                                if let Ok(rel) = cand2.strip_prefix(root_dir) {
                                    found.insert(rel.to_string_lossy().replace('\\', "/"));
                                    break;
                                }
                            }
                        }
                    }
                }
            }
        }
        "js" | "jsx" | "ts" | "tsx" => {
            if let Ok(re) = Regex::new(r#"(?:import\s+.*?\s+from\s+["'](\..*?)["']|require\(["'](\..*?)["']\))"#) {
                for caps in re.captures_iter(content) {
                    let rel_import = caps.get(1).or_else(|| caps.get(2)).map(|m| m.as_str()).unwrap_or("");
                    if rel_import.is_empty() {
                        continue;
                    }

                    let abs_base = target_dir.join(rel_import);
                    let possible_exts = ["", ".js", ".ts", ".jsx", ".tsx", "/index.js", "/index.ts"];

                    for p_ext in possible_exts {
                        let test_path = PathBuf::from(format!("{}{}", abs_base.to_string_lossy(), p_ext));
                        if test_path.is_file() {
                            if let Ok(rel) = test_path.strip_prefix(root_dir) {
                                found.insert(rel.to_string_lossy().replace('\\', "/"));
                                break;
                            }
                        }
                    }
                }
            }
        }
        "c" | "cpp" | "h" | "hpp" => {
            if let Ok(re) = Regex::new(r#"(?m)^\s*#include\s+["']([^"']+)["']"#) {
                for caps in re.captures_iter(content) {
                    if let Some(mat) = caps.get(1) {
                        let header = mat.as_str();
                        let test_path1 = target_dir.join(header);
                        let test_path2 = Path::new(root_dir).join(header);

                        if test_path1.is_file() {
                            if let Ok(rel) = test_path1.strip_prefix(root_dir) {
                                found.insert(rel.to_string_lossy().replace('\\', "/"));
                            }
                        } else if test_path2.is_file() {
                            if let Ok(rel) = test_path2.strip_prefix(root_dir) {
                                found.insert(rel.to_string_lossy().replace('\\', "/"));
                            }
                        }
                    }
                }
            }
        }
        "rs" => {
            if let Ok(re) = Regex::new(r"(?m)^\s*(?:pub\s+)?mod\s+([a-zA-Z0-9_]+);") {
                for caps in re.captures_iter(content) {
                    if let Some(mat) = caps.get(1) {
                        let mod_name = mat.as_str();
                        let cand1 = target_dir.join(format!("{}.rs", mod_name));
                        let cand2 = target_dir.join(mod_name).join("mod.rs");

                        if cand1.is_file() {
                            if let Ok(rel) = cand1.strip_prefix(root_dir) {
                                found.insert(rel.to_string_lossy().replace('\\', "/"));
                            }
                        } else if cand2.is_file() {
                            if let Ok(rel) = cand2.strip_prefix(root_dir) {
                                found.insert(rel.to_string_lossy().replace('\\', "/"));
                            }
                        }
                    }
                }
            }
        }
        _ => {}
    }

    found
}