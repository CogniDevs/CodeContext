use regex::Regex;

pub fn skeletonize_code(text: &str, extension: &str) -> String {
    let ext = extension.trim_start_matches('.').to_lowercase();
    match ext.as_str() {
        "py" | "ipynb" => text.to_string(),
        "js" | "jsx" | "ts" | "tsx" | "c" | "cpp" | "h" | "hpp" | "go" | "rs" | "java" | "cs"
        | "php" | "dart" | "kt" | "kts" | "swift" => skeletonize_brace(text),
        _ => text.to_string(),
    }
}

fn skeletonize_brace(text: &str) -> String {
    let Ok(re) = Regex::new(
        r"(?m)(\b(?:pub\s+|async\s+|public\s+|private\s+|protected\s+|static\s+|inline\s+|virtual\s+|override\s+|const\s+|void\s+|int\s+|bool\s+|char\s+|double\s+|float\s+|fn\s+|func\s+|function\s+)+\w+\s*(?:<[^>]*>)?\s*\([^)]*\)\s*(?:->|:)?\s*[^{]*?)\{[^{}]*\}",
    ) else {
        return text.to_string();
    };

    let mut current = text.to_string();
    for _ in 0..3 {
        let next = re
            .replace_all(&current, "${1}{ ... }")
            .to_string();
        if next == current {
            break;
        }
        current = next;
    }
    current
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