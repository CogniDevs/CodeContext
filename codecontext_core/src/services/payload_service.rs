use crate::models::{FileNode, TransformOptions};
use crate::transformers::{compress_whitespace, sanitize_secrets, strip_comments};
use std::collections::HashSet;
use std::path::Path;

pub struct FileInput {
    pub rel_path: String,
    pub content: String,
}

pub fn generate_ascii_tree(
    node: &FileNode,
    selected_paths: Option<&HashSet<String>>,
    indent: &str,
) -> Vec<String> {
    let mut lines = Vec::new();

    let children: Vec<&FileNode> = if let Some(paths) = selected_paths {
        node.children
            .iter()
            .filter(|c| {
                paths.contains(&c.rel_path)
                    || (c.is_dir && paths.iter().any(|p| p.starts_with(&format!("{}/", c.rel_path))))
            })
            .collect()
    } else {
        node.children.iter().collect()
    };

    let num_children = children.len();
    for (idx, child) in children.iter().enumerate() {
        let is_last = idx == num_children - 1;
        let prefix = if is_last { "└── " } else { "├── " };
        let next_indent = format!("{}{}", indent, if is_last { "    " } else { "│   " });

        let display_name = if child.is_dir {
            format!("{}/", child.name)
        } else {
            child.name.clone()
        };

        lines.push(format!("{}{}{}", indent, prefix, display_name));

        if child.is_dir {
            lines.extend(generate_ascii_tree(child, selected_paths, &next_indent));
        }
    }

    lines
}

pub fn build_payload(
    root_name: &str,
    root_node: Option<&FileNode>,
    files: &[FileInput],
    selected_paths: &HashSet<String>,
    options: &TransformOptions,
) -> String {
    let tree_lines = if let Some(root) = root_node {
        let mut lines = vec![format!("{}/", root_name)];
        let paths_filter = if options.always_send_full_tree {
            None
        } else {
            Some(selected_paths)
        };
        lines.extend(generate_ascii_tree(root, paths_filter, ""));
        lines.join("\n")
    } else {
        format!("{}/", root_name)
    };

    if options.xml_format {
        let mut lines = vec!["<repository_context>\n".to_string()];

        if !options.system_prompt.trim().is_empty() {
            lines.push("  <instructions>\n".to_string());
            lines.push(format!("    {}\n", options.system_prompt.trim()));
            lines.push("  </instructions>\n\n".to_string());
        }

        lines.push("  <directory_structure>\n".to_string());
        lines.push(format!("<![CDATA[\n{}\n]]>\n", tree_lines));
        lines.push("  </directory_structure>\n\n".to_string());

        lines.push("  <source_files>\n".to_string());

        for file in files {
            let ext = Path::new(&file.rel_path)
                .extension()
                .and_then(|s| s.to_str())
                .unwrap_or("");

            let mut content = file.content.clone();

            if options.strip_comments {
                content = strip_comments(&content, ext);
            }
            if options.compress_whitespace {
                content = compress_whitespace(&content);
            }
            if options.sanitize_secrets {
                content = sanitize_secrets(&content);
            }

            let safe_content = content.replace("]]>", "]]>]]><![CDATA[");

            lines.push(format!("    <file path=\"{}\">\n", file.rel_path));
            lines.push(format!("<![CDATA[\n{}\n]]>\n", safe_content));
            lines.push("    </file>\n".to_string());
        }

        lines.push("  </source_files>\n".to_string());
        lines.push("</repository_context>".to_string());

        lines.concat()
    } else {
        let mut lines = Vec::new();

        if !options.system_prompt.trim().is_empty() {
            lines.push("=== ИНСТРУКЦИЯ ДЛЯ НЕЙРОСЕТИ ===\n".to_string());
            lines.push(format!("{}\n", options.system_prompt.trim()));
            lines.push("\n================================================================================\n\n".to_string());
        }

        lines.push("=== ПОЛНАЯ СТРУКТУРА ПРОЕКТА (БЕЗ СИСТЕМНОГО МУСОРА) ===\n".to_string());
        lines.push(format!("{}\n", tree_lines));
        lines.push("\n================================================================================\n\n".to_string());

        if !files.is_empty() {
            lines.push("=== СОДЕРЖИМОЕ КЛЮЧЕВЫХ ФАЙЛОВ КОДА ===\n\n".to_string());
            for file in files {
                let ext = Path::new(&file.rel_path)
                    .extension()
                    .and_then(|s| s.to_str())
                    .unwrap_or("");

                let mut content = file.content.clone();

                if options.strip_comments {
                    content = strip_comments(&content, ext);
                }
                if options.compress_whitespace {
                    content = compress_whitespace(&content);
                }
                if options.sanitize_secrets {
                    content = sanitize_secrets(&content);
                }

                lines.push(format!("<file path=\"{}\">\n", file.rel_path));
                lines.push(content);
                lines.push("\n</file>\n\n".to_string());
            }
        } else {
            lines.push("=== СОДЕРЖИМОЕ КОДА ===\n\n[Ни один файл кода не был выбран для экспорта. Скопирована только структура проекта.]\n".to_string());
        }

        lines.concat()
    }
}