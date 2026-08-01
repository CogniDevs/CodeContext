use crate::models::ScanOptions;
use std::path::Path;

#[cfg(not(target_arch = "wasm32"))]
use crate::models::FileNode;

pub fn is_ignored(rel_path: &str, is_dir: bool, options: &ScanOptions) -> bool {
    let path_str = rel_path.replace('\\', "/");
    let parts: Vec<&str> = path_str.split('/').collect();

    for exclude in &options.manual_excludes {
        let clean = exclude.trim();
        if clean.is_empty() {
            continue;
        }
        if parts.contains(&clean) || path_str == clean || path_str.starts_with(&(clean.to_string() + "/")) {
            return true;
        }
    }

    if options.ignore_lockfiles {
        for lockfile in &options.lockfiles_excludes {
            let clean = lockfile.trim();
            if !clean.is_empty() && (parts.contains(&clean) || path_str == clean) {
                return true;
            }
        }
    }

    if !is_dir {
        if let Some(ext) = Path::new(&path_str).extension().and_then(|s| s.to_str()) {
            let ext_with_dot = format!(".{}", ext.to_lowercase());

            if options.ignore_binary && options.binary_extensions.contains(&ext_with_dot) {
                return true;
            }

            if !options.whitelist_extensions.is_empty() && !options.whitelist_extensions.contains(&ext_with_dot) {
                return true;
            }
        }
    }

    false
}

#[cfg(not(target_arch = "wasm32"))]
pub fn scan_directory(root_dir: &str, options: &ScanOptions) -> Option<FileNode> {
    let root_path = Path::new(root_dir);
    if !root_path.exists() || !root_path.is_dir() {
        return None;
    }

    let root_name = root_path.file_name()?.to_string_lossy().to_string();
    let mut root_node = FileNode::new(root_name, root_dir.to_string(), String::new(), true, 0);

    fn populate_node(current_path: &Path, root_path: &Path, parent_node: &mut FileNode, options: &ScanOptions) {
        let entries = match std::fs::read_dir(current_path) {
            Ok(e) => e,
            Err(_) => return,
        };

        let mut items: Vec<_> = entries.filter_map(|e| e.ok()).collect();
        items.sort_by(|a, b| {
            let a_is_dir = a.file_type().map_or(false, |ft| ft.is_dir());
            let b_is_dir = b.file_type().map_or(false, |ft| ft.is_dir());
            if a_is_dir != b_is_dir {
                b_is_dir.cmp(&a_is_dir)
            } else {
                a.file_name().cmp(&b.file_name())
            }
        });

        for entry in items {
            let full_path = entry.path();
            let is_dir = entry.file_type().map_or(false, |ft| ft.is_dir());
            let rel_path = match full_path.strip_prefix(root_path) {
                Ok(p) => p.to_string_lossy().replace('\\', "/"),
                Err(_) => continue,
            };

            if is_ignored(&rel_path, is_dir, options) {
                continue;
            }

            let size = if is_dir { 0 } else { entry.metadata().map_or(0, |m| m.len()) };
            let file_name = entry.file_name().to_string_lossy().to_string();
            let full_path_str = full_path.to_string_lossy().to_string();

            let mut child_node = FileNode::new(file_name, full_path_str, rel_path, is_dir, size);

            if is_dir {
                populate_node(&full_path, root_path, &mut child_node, options);
            }

            parent_node.children.push(child_node);
        }
    }

    populate_node(root_path, root_path, &mut root_node, options);
    Some(root_node)
}