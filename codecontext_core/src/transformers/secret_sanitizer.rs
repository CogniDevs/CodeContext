use regex::{Captures, Regex};
use std::collections::HashMap;
use std::sync::OnceLock;

struct SecretPattern {
    regex: Regex,
    replacement: &'static str,
}

static PATTERNS: OnceLock<Vec<SecretPattern>> = OnceLock::new();
static HIGH_ENTROPY_TOKEN_RE: OnceLock<Regex> = OnceLock::new();

fn get_patterns() -> &'static Vec<SecretPattern> {
    PATTERNS.get_or_init(|| {
        vec![
            SecretPattern {
                regex: Regex::new(r"sk-[a-zA-Z0-9]{20,}").unwrap(),
                replacement: "[REDACTED_OPENAI_KEY]",
            },
            SecretPattern {
                regex: Regex::new(r"sk-ant-[a-zA-Z0-9_-]{20,}").unwrap(),
                replacement: "[REDACTED_ANTHROPIC_KEY]",
            },
            SecretPattern {
                regex: Regex::new(r"ghp_[a-zA-Z0-9]{36}").unwrap(),
                replacement: "[REDACTED_GITHUB_TOKEN]",
            },
            SecretPattern {
                regex: Regex::new(r"glpat-[a-zA-Z0-9_-]{20}").unwrap(),
                replacement: "[REDACTED_GITLAB_TOKEN]",
            },
            SecretPattern {
                regex: Regex::new(r"hf_[a-zA-Z0-9]{34,}").unwrap(),
                replacement: "[REDACTED_HUGGINGFACE_TOKEN]",
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
                regex: Regex::new(r"AIzaSy[a-zA-Z0-9_-]{33}").unwrap(),
                replacement: "[REDACTED_GOOGLE_KEY]",
            },
            SecretPattern {
                regex: Regex::new(r"sk_live_[a-zA-Z0-9]{24}").unwrap(),
                replacement: "[REDACTED_STRIPE_KEY]",
            },
            SecretPattern {
                regex: Regex::new(r"eyJ[a-zA-Z0-9_-]{10,}\.eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}").unwrap(),
                replacement: "[REDACTED_JWT_TOKEN]",
            },
            SecretPattern {
                regex: Regex::new(r"(?i)(postgres|postgresql|mongodb|mongodb\+srv|mysql|redis)://[a-zA-Z0-9_]+:[^@\s]+@[a-zA-Z0-9_.-]+:[0-9]+/[a-zA-Z0-9_.-]+").unwrap(),
                replacement: "[REDACTED_CONNECTION_STRING]",
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
                regex: Regex::new(r#"(?im)^(\s*(?:[\w_.]*?(?:api[_-]?key|secret|password|token|bearer)[\w_.]*?)\s*)'[^']{8,}'"#).unwrap(),
                replacement: r#"$1'[REDACTED_SECRET]'"#,
            },
        ]
    })
}

pub fn calculate_entropy(text: &str) -> f64 {
    if text.is_empty() {
        return 0.0;
    }
    let mut frequency = HashMap::new();
    let total_count = text.chars().count() as f64;
    for c in text.chars() {
        *frequency.entry(c).or_insert(0usize) += 1;
    }
    let mut entropy = 0.0;
    for &count in frequency.values() {
        let probability = count as f64 / total_count;
        entropy -= probability * probability.log2();
    }
    entropy
}

pub fn sanitize_secrets(text: &str) -> String {
    let mut result = text.to_string();
    for pattern in get_patterns() {
        result = pattern.regex.replace_all(&result, pattern.replacement).to_string();
    }

    let token_re = HIGH_ENTROPY_TOKEN_RE.get_or_init(|| {
        Regex::new(r#"\b[a-zA-Z0-9_\-\+/=]{21,}\b"#).unwrap()
    });

    result = token_re
        .replace_all(&result, |caps: &Captures| {
            let matched = caps.get(0).map_or("", |m| m.as_str());
            if matched.starts_with("[REDACTED_") {
                matched.to_string()
            } else if calculate_entropy(matched) > 4.5 {
                "[REDACTED_HIGH_ENTROPY_SECRET]".to_string()
            } else {
                matched.to_string()
            }
        })
        .to_string();

    result
}