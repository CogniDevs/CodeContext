use regex::Regex;
use std::sync::OnceLock;

struct SecretPattern {
    regex: Regex,
    replacement: &'static str,
}

static PATTERNS: OnceLock<Vec<SecretPattern>> = OnceLock::new();

fn get_patterns() -> &'static Vec<SecretPattern> {
    PATTERNS.get_or_init(|| {
        vec![
            SecretPattern {
                regex: Regex::new(r"sk-[a-zA-Z0-9]{20,}").unwrap(),
                replacement: "[REDACTED_OPENAI_KEY]",
            },
            SecretPattern {
                regex: Regex::new(r"ghp_[a-zA-Z0-9]{36}").unwrap(),
                replacement: "[REDACTED_GITHUB_TOKEN]",
            },
            SecretPattern {
                regex: Regex::new(r"xox[baprs]-[a-zA-Z0-9]{10,}").unwrap(),
                replacement: "[REDACTED_SLACK_TOKEN]",
            },
            SecretPattern {
                regex: Regex::new(r"\bAKIA[0-9A-Z]{16}\b").unwrap(),
                replacement: "[REDACTED_AWS_KEY]",
            },
            SecretPattern {
                regex: Regex::new(r"(?s)-----BEGIN [A-Z ]+ PRIVATE KEY-----.*?-----END [A-Z ]+ PRIVATE KEY-----").unwrap(),
                replacement: "[REDACTED_PRIVATE_KEY]",
            },
            SecretPattern {
                regex: Regex::new(r#"(?im)^(\s*(?:[\w_.]*?(?:api[_-]?key|secret|password|token|bearer)[\w_.]*?)\s*[:=]\s*)"[^"]{8,}""#).unwrap(),
                replacement: r#"$1"[REDACTED_SECRET]""#,
            },
            SecretPattern {
                regex: Regex::new(r#"(?im)^(\s*(?:[\w_.]*?(?:api[_-]?key|secret|password|token|bearer)[\w_.]*?)\s*[:=]\s*)'[^']{8,}'"#).unwrap(),
                replacement: r#"$1'[REDACTED_SECRET]'"#,
            },
        ]
    })
}

pub fn sanitize_secrets(text: &str) -> String {
    let mut result = text.to_string();
    for pattern in get_patterns() {
        result = pattern.regex.replace_all(&result, pattern.replacement).to_string();
    }
    result
}