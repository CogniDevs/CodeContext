use crate::models::{FileNode, TransformOptions};
use crate::tokenizer::count_tokens;
use crate::transformers::{
    compress_whitespace, sanitize_secrets, skeletonize_code, strip_comments,
};
#[cfg(not(target_arch = "wasm32"))]
use rayon::prelude::*;
use std::collections::HashSet;
use std::path::Path;

pub struct FileInput {
    pub rel_path: String,
    pub content: String,
}

fn escape_cdata(text: &str) -> String {
    text.replace("]]>", "]]]]><![CDATA[>")
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
                    || (c.is_dir
                        && paths
                            .iter()
                            .any(|p| p.starts_with(&format!("{}/", c.rel_path))))
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

pub fn transform_file_content(file: &FileInput, options: &TransformOptions) -> String {
    let ext = Path::new(&file.rel_path)
        .extension()
        .and_then(|s| s.to_str())
        .unwrap_or("");

    let mut content = file.content.clone();

    if options.skeleton_mode {
        content = skeletonize_code(&content, ext);
    }
    if options.strip_comments {
        content = strip_comments(&content, ext, options.comment_rules_json.as_deref());
    }
    if options.compress_whitespace {
        content = compress_whitespace(&content);
    }
    if options.sanitize_secrets {
        content = sanitize_secrets(&content);
    }

    content
}

pub fn generate_standalone_tree_payload(
    root_name: &str,
    root_node: Option<&FileNode>,
    selected_paths: &HashSet<String>,
    xml_format: bool,
) -> String {
    let tree_lines = if let Some(root) = root_node {
        let mut lines = vec![format!("{}/", root_name)];
        let filter = if selected_paths.is_empty() {
            None
        } else {
            Some(selected_paths)
        };
        lines.extend(generate_ascii_tree(root, filter, ""));
        lines.join("\n")
    } else {
        format!("{}/", root_name)
    };

    if xml_format {
        let safe_tree = escape_cdata(&tree_lines);
        format!(
            "<repository_structure>\n  <directory_structure>\n<![CDATA[\n{}\n]]>\n  </directory_structure>\n</repository_structure>",
            safe_tree
        )
    } else {
        format!(
            "=== СТРУКТУРА ПРОЕКТА ===\n{}\n================================================================================",
            tree_lines
        )
    }
}

pub fn build_payload(
    root_name: &str,
    root_node: Option<&FileNode>,
    files: &[FileInput],
    selected_paths: &HashSet<String>,
    options: &TransformOptions,
) -> String {
    let include_tree = if options.git_diff_mode {
        options.always_send_full_tree
    } else {
        options.always_send_full_tree || files.is_empty()
    };

    let tree_lines = if include_tree {
        if let Some(root) = root_node {
            let mut lines = vec![format!("{}/", root_name)];
            let paths_filter = if options.always_send_full_tree {
                None
            } else {
                Some(selected_paths)
            };
            lines.extend(generate_ascii_tree(root, paths_filter, ""));
            Some(lines.join("\n"))
        } else {
            Some(format!("{}/", root_name))
        }
    } else {
        None
    };

    let mut transformed_files: Vec<(String, String)> = Vec::new();

    if !options.git_diff_mode {
        #[cfg(not(target_arch = "wasm32"))]
        {
            transformed_files = files
                .par_iter()
                .map(|file| {
                    let content = transform_file_content(file, options);
                    (file.rel_path.clone(), content)
                })
                .collect();
        }

        #[cfg(target_arch = "wasm32")]
        {
            transformed_files = files
                .iter()
                .map(|file| {
                    let content = transform_file_content(file, options);
                    (file.rel_path.clone(), content)
                })
                .collect();
        }
    }

    let initial_payload = assemble_formatted_payload(root_name, tree_lines.as_deref(), &transformed_files, options);

    if let Some(budget) = options.max_token_budget {
        if budget > 0 && count_tokens(&initial_payload) > budget {
            for (rel_path, content) in transformed_files.iter_mut() {
                let ext = Path::new(rel_path).extension().and_then(|s| s.to_str()).unwrap_or("");
                *content = skeletonize_code(content, ext);
            }

            let skeleton_payload = assemble_formatted_payload(root_name, tree_lines.as_deref(), &transformed_files, options);
            if count_tokens(&skeleton_payload) <= budget {
                return skeleton_payload;
            }

            transformed_files.sort_by(|a, b| b.1.len().cmp(&a.1.len()));
            for idx in 0..transformed_files.len() {
                transformed_files[idx].1 = format!("[Содержимое файла truncated для укладки в лимит {} токенов]", budget);
                let current_payload = assemble_formatted_payload(root_name, tree_lines.as_deref(), &transformed_files, options);
                if count_tokens(&current_payload) <= budget {
                    return current_payload;
                }
            }
        }
    }

    initial_payload
}

fn assemble_formatted_payload(
    _root_name: &str,
    tree_lines: Option<&str>,
    transformed_files: &[(String, String)],
    options: &TransformOptions,
) -> String {
    if options.xml_format {
        let mut lines = vec!["<repository_context>\n".to_string()];

        if !options.system_prompt.trim().is_empty() {
            lines.push("  <instructions>\n".to_string());
            lines.push(format!("    {}\n", options.system_prompt.trim()));
            lines.push("  </instructions>\n\n".to_string());
        }

        if let Some(tree) = tree_lines {
            let safe_tree = escape_cdata(tree);
            lines.push("  <directory_structure>\n".to_string());
            lines.push(format!("<![CDATA[\n{}\n]]>\n", safe_tree));
            lines.push("  </directory_structure>\n\n".to_string());
        }

        if options.git_diff_mode {
            lines.push("  <git_diff_context>\n".to_string());
            lines.push(format!("    <context_lines>{}</context_lines>\n", options.git_diff_context_lines));
            if let Some(ref diff) = options.git_diff_text {
                let safe_diff = escape_cdata(diff);
                lines.push("    <patch>\n".to_string());
                lines.push(format!("<![CDATA[\n{}\n]]>\n", safe_diff));
                lines.push("    </patch>\n".to_string());
            } else {
                lines.push("    <patch>[Нет доступных изменений в Git diff]</patch>\n".to_string());
            }
            lines.push("  </git_diff_context>\n".to_string());
        } else {
            lines.push("  <source_files>\n".to_string());
            for (rel_path, content) in transformed_files {
                let safe_content = escape_cdata(content);
                lines.push(format!("    <file path=\"{}\">\n", rel_path));
                lines.push(format!("<![CDATA[\n{}\n]]>\n", safe_content));
                lines.push("    </file>\n".to_string());
            }
            lines.push("  </source_files>\n".to_string());
        }

        lines.push("</repository_context>".to_string());
        lines.concat()
    } else {
        let mut lines = Vec::new();

        if !options.system_prompt.trim().is_empty() {
            lines.push("=== ИНСТРУКЦИИ ДЛЯ НЕЙРОСЕТИ ===\n".to_string());
            lines.push(format!("{}\n", options.system_prompt.trim()));
            lines.push(
                "\n================================================================================\n\n"
                    .to_string(),
            );
        }

        if let Some(tree) = tree_lines {
            lines.push("=== ПОЛНАЯ СТРУКТУРА ПРОЕКТА ===\n".to_string());
            lines.push(format!("{}\n", tree));
            lines.push(
                "\n================================================================================\n\n"
                    .to_string(),
            );
        }

        if options.git_diff_mode {
            lines.push(format!("=== РЕЖИМ GIT DIFF (КОНТЕКСТ ДЕЛЬТЫ: {} СТРОК) ===\n\n", options.git_diff_context_lines));
            if let Some(ref diff) = options.git_diff_text {
                lines.push(diff.clone());
                lines.push("\n\n".to_string());
            } else {
                lines.push("[Нет доступных изменений в Git diff]\n\n".to_string());
            }
        } else {
            if !transformed_files.is_empty() {
                lines.push("=== СОДЕРЖИМОЕ КЛЮЧЕВЫХ ФАЙЛОВ КОДА ===\n\n".to_string());
                for (rel_path, content) in transformed_files {
                    lines.push(format!("<file path=\"{}\">\n", rel_path));
                    lines.push(content.clone());
                    lines.push("\n</file>\n\n".to_string());
                }
            } else {
                lines.push("=== СОДЕРЖИМОЕ КОДА ===\n\n[Ни один файл кода не был выбран для экспорта.]\n".to_string());
            }
        }

        lines.concat()
    }
}