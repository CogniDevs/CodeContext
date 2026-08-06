use regex::Regex;

fn skeletonize_treesitter(
    text: &str,
    language: tree_sitter::Language,
    is_python: bool,
) -> Option<String> {
    let mut parser = tree_sitter::Parser::new();
    if parser.set_language(&language).is_err() {
        return None;
    }
    let tree = parser.parse(text, None)?;
    let root = tree.root_node();

    let mut replacements = Vec::new();
    let mut stack = vec![root];
    let mut cursor = root.walk();

    while let Some(node) = stack.pop() {
        let kind = node.kind();
        let parent_kind = node.parent().map_or("", |p| p.kind());

        let is_func_or_method_parent = parent_kind.contains("function")
            || parent_kind.contains("method")
            || parent_kind.contains("declaration")
            || parent_kind.contains("definition")
            || parent_kind.contains("fn_")
            || parent_kind == "function_item"
            || parent_kind == "method_definition"
            || parent_kind == "function_definition"
            || parent_kind == "func_literal";

        if (kind == "block" || kind == "statement_block" || kind == "compound_statement")
            && is_func_or_method_parent
        {
            let start = node.start_byte();
            let end = node.end_byte();
            if start < end {
                replacements.push((start, end, is_python));
            }
        } else {
            for child in node.children(&mut cursor) {
                stack.push(child);
            }
        }
    }

    if replacements.is_empty() {
        return Some(text.to_string());
    }

    replacements.sort_by(|a, b| a.0.cmp(&b.0));

    let mut merged_replacements: Vec<(usize, usize, bool)> = Vec::new();
    for (start, end, py) in replacements {
        if let Some(last) = merged_replacements.last_mut() {
            if start < last.1 {
                if end > last.1 {
                    last.1 = end;
                }
                continue;
            }
        }
        merged_replacements.push((start, end, py));
    }

    let text_bytes = text.as_bytes();
    let text_len = text_bytes.len();
    let mut result = Vec::with_capacity(text_len);
    let mut last_idx = 0;

    for (start, end, py) in merged_replacements {
        let start_clamped = start.min(text_len);
        let end_clamped = end.min(text_len);

        if start_clamped > last_idx {
            result.extend_from_slice(&text_bytes[last_idx..start_clamped]);
        }

        let replacement_bytes = if py {
            "\n    ...\n".as_bytes()
        } else {
            " { ... }".as_bytes()
        };
        result.extend_from_slice(replacement_bytes);

        if end_clamped > last_idx {
            last_idx = end_clamped;
        }
    }

    if last_idx < text_len {
        result.extend_from_slice(&text_bytes[last_idx..]);
    }

    String::from_utf8(result).ok()
}

pub fn skeletonize_code(text: &str, extension: &str) -> String {
    let ext = extension.trim_start_matches('.').to_lowercase();

    let ts_lang: Option<(tree_sitter::Language, bool)> = match ext.as_str() {
        "py" | "ipynb" => Some((tree_sitter_python::language().into(), true)),
        "rs" => Some((tree_sitter_rust::language().into(), false)),
        "ts" | "js" => Some((tree_sitter_typescript::language_typescript().into(), false)),
        "tsx" | "jsx" => Some((tree_sitter_typescript::language_tsx().into(), false)),
        "c" | "h" => Some((tree_sitter_c::language().into(), false)),
        "cpp" | "hpp" | "cc" | "cxx" => Some((tree_sitter_cpp::language().into(), false)),
        "go" => Some((tree_sitter_go::language().into(), false)),
        "java" => Some((tree_sitter_java::language().into(), false)),
        _ => None,
    };

    if let Some((lang, is_python)) = ts_lang {
        if let Some(cleaned) = skeletonize_treesitter(text, lang, is_python) {
            return cleaned;
        }
    }

    match ext.as_str() {
        "py" | "ipynb" => skeletonize_python(text),
        "js" | "jsx" | "ts" | "tsx" | "c" | "cpp" | "h" | "hpp" | "go" | "rs" | "java" | "cs"
        | "php" | "dart" | "kt" | "kts" | "swift" => skeletonize_brace(text),
        _ => text.to_string(),
    }
}

fn find_matching_brace_bytes(bytes: &[u8], start_idx: usize) -> Option<usize> {
    let mut brace_count = 0;
    let mut i = start_idx;
    let len = bytes.len();

    let mut in_string = false;
    let mut in_char = false;
    let mut in_line_comment = false;
    let mut in_block_comment = false;
    let mut escaped = false;

    while i < len {
        let b = bytes[i];
        let next = if i + 1 < len { Some(bytes[i + 1]) } else { None };

        if in_line_comment {
            if b == b'\n' {
                in_line_comment = false;
            }
        } else if in_block_comment {
            if b == b'*' && next == Some(b'/') {
                in_block_comment = false;
                i += 1;
            }
        } else if in_string {
            if escaped {
                escaped = false;
            } else if b == b'\\' {
                escaped = true;
            } else if b == b'"' {
                in_string = false;
            }
        } else if in_char {
            if escaped {
                escaped = false;
            } else if b == b'\\' {
                escaped = true;
            } else if b == b'\'' {
                in_char = false;
            }
        } else {
            if b == b'/' && next == Some(b'/') {
                in_line_comment = true;
                i += 1;
            } else if b == b'/' && next == Some(b'*') {
                in_block_comment = true;
                i += 1;
            } else if b == b'"' {
                in_string = true;
                escaped = false;
            } else if b == b'\'' {
                in_char = true;
                escaped = false;
            } else if b == b'{' {
                brace_count += 1;
            } else if b == b'}' {
                brace_count -= 1;
                if brace_count == 0 {
                    return Some(i);
                }
            }
        }
        i += 1;
    }
    None
}

fn skeletonize_brace(text: &str) -> String {
    let Ok(re) = Regex::new(
        r"(?m)\b(?:pub\s+|async\s+|public\s+|private\s+|protected\s+|static\s+|inline\s+|virtual\s+|override\s+|const\s+|void\s+|int\s+|bool\s+|char\s+|double\s+|float\s+|fn\s+|func\s+|function\s+)+\w+\s*(?:<[^>]*>)?\s*\([^)]*\)\s*(?:->|:)?\s*[^{]*?\{",
    ) else {
        return text.to_string();
    };

    let mut result = text.to_string();
    let mut replacements = Vec::new();

    for mat in re.find_iter(text) {
        let open_brace_idx = mat.end() - 1;
        if let Some(close_brace_idx) = find_matching_brace_bytes(text.as_bytes(), open_brace_idx) {
            replacements.push((open_brace_idx, close_brace_idx));
        }
    }

    replacements.sort_by(|a, b| b.0.cmp(&a.0));

    for (start, end) in replacements {
        if start + 1 < end {
            result.replace_range((start + 1)..end, " ... ");
        }
    }

    result
}

fn skeletonize_python(text: &str) -> String {
    let lines: Vec<&str> = text.lines().collect();
    let mut result = Vec::new();
    let mut in_function_body = false;
    let mut func_indent = 0;
    let mut in_docstring = false;
    let mut docstring_quote = "";

    let Ok(def_re) = Regex::new(r"^(\s*)(?:async\s+)?def\s+[a-zA-Z_][a-zA-Z0-9_]*\s*\(") else {
        return text.to_string();
    };

    let Ok(class_or_def) = Regex::new(r"^(\s*)(?:class|def|async\s+def|@)\b") else {
        return text.to_string();
    };

    for line in lines {
        let trimmed = line.trim();

        if trimmed.is_empty() {
            if !in_function_body {
                result.push(line.to_string());
            }
            continue;
        }

        let current_indent = line.len() - line.trim_start().len();

        if in_docstring {
            result.push(line.to_string());
            if trimmed.contains(docstring_quote) {
                in_docstring = false;
            }
            continue;
        }

        if in_function_body {
            if current_indent > func_indent {
                if trimmed.starts_with("\"\"\"") || trimmed.starts_with("'''") {
                    let quote = if trimmed.starts_with("\"\"\"") { "\"\"\"" } else { "'''" };
                    result.push(line.to_string());
                    let occurrences = trimmed.matches(quote).count();
                    if occurrences == 1 {
                        in_docstring = true;
                        docstring_quote = quote;
                    }
                    continue;
                }
                continue;
            } else {
                in_function_body = false;
            }
        }

        if let Some(caps) = def_re.captures(line) {
            in_function_body = true;
            func_indent = caps.get(1).map_or(0, |m| m.as_str().len());
            result.push(line.to_string());
            let indent_str = " ".repeat(func_indent + 4);
            result.push(format!("{}...", indent_str));
        } else {
            if class_or_def.is_match(line) {
                in_function_body = false;
            }
            result.push(line.to_string());
        }
    }

    result.join("\n")
}