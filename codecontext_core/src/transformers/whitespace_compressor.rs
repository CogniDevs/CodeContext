use regex::Regex;

pub fn compress_whitespace(text: &str) -> String {
    let mut lines = Vec::new();
    for line in text.lines() {
        lines.push(line.trim_end());
    }

    let joined = lines.join("\n");
    let re = Regex::new(r"\n{3,}").unwrap();
    let result = re.replace_all(&joined, "\n\n");
    result.trim().to_string()
}