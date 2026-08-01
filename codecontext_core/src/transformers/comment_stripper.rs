use regex::Regex;

pub fn strip_comments(text: &str, extension: &str) -> String {
    let ext = extension.trim_start_matches('.').to_lowercase();
    match ext.as_str() {
        "js" | "jsx" | "ts" | "tsx" | "c" | "cpp" | "h" | "hpp" | "go" | "rs" | "java" | "cs" | "php" | "css" | "dart" | "kt" | "kts" | "m" => {
            strip_c_style(text)
        }
        "py" | "ipynb" => strip_python(text),
        "html" | "xml" | "svelte" | "vue" | "astro" | "svg" => strip_xml(text),
        "sh" | "bash" | "yaml" | "yml" | "toml" | "ini" | "rb" | "tf" | "dockerfile" | "makefile" => strip_hash(text),
        "sql" => strip_sql(text),
        _ => text.to_string(),
    }
}

fn strip_c_style(text: &str) -> String {
    let re = Regex::new(r#"(?m)("(?:\\.|[^"\\])*")|('(?:\\.|[^'\\])*')|(//.*$)|(/\*[\s\S]*?\*/)"#).unwrap();
    re.replace_all(text, |caps: &regex::Captures| {
        if let Some(m) = caps.get(1) {
            m.as_str().to_string()
        } else if let Some(m) = caps.get(2) {
            m.as_str().to_string()
        } else {
            String::new()
        }
    }).to_string()
}

fn strip_python(text: &str) -> String {
    let re = Regex::new(r#"(?m)("(?:\\.|[^"\\])*")|('(?:\\.|[^'\\])*')|(#.*$)"#).unwrap();
    let cleaned = re.replace_all(text, |caps: &regex::Captures| {
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

    let docstring_re = Regex::new(r#"(?m)^\s*("""[\s\S]*?"""|'''[\s\S]*?''')\s*$"#).unwrap();
    docstring_re.replace_all(&cleaned, "").to_string()
}

fn strip_xml(text: &str) -> String {
    let re = Regex::new(r#"(<!--[\s\S]*?-->)"#).unwrap();
    re.replace_all(text, "").to_string()
}

fn strip_hash(text: &str) -> String {
    let re = Regex::new(r#"(?m)("(?:\\.|[^"\\])*")|('(?:\\.|[^'\\])*')|(#.*$)"#).unwrap();
    re.replace_all(text, |caps: &regex::Captures| {
        if let Some(m) = caps.get(1) {
            m.as_str().to_string()
        } else if let Some(m) = caps.get(2) {
            m.as_str().to_string()
        } else {
            String::new()
        }
    }).to_string()
}

fn strip_sql(text: &str) -> String {
    let re = Regex::new(r#"(?m)("(?:\\.|[^"\\])*")|('(?:\\.|[^'\\])*')|(--.*$)|(/\*[\s\S]*?\*/)"#).unwrap();
    re.replace_all(text, |caps: &regex::Captures| {
        if let Some(m) = caps.get(1) {
            m.as_str().to_string()
        } else if let Some(m) = caps.get(2) {
            m.as_str().to_string()
        } else {
            String::new()
        }
    }).to_string()
}