use tiktoken_rs::cl100k_base;

pub fn count_tokens(text: &str) -> usize {
    if text.is_empty() {
        return 0;
    }
    match cl100k_base() {
        Ok(bpe) => bpe.encode_ordinary(text).len(),
        Err(_) => (text.len() as f64 / 3.3).round() as usize,
    }
}