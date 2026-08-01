#![allow(unsafe_op_in_unsafe_fn)]

use regex::Regex;

pub fn compress_whitespace(text: &str) -> String {
    let re = Regex::new(r"\n\s*\n").unwrap();
    let cleaned = re.replace_all(text, "\n");
    cleaned.trim().to_string()
}

#[cfg(feature = "python")]
use pyo3::prelude::*;

#[cfg(feature = "python")]
#[pyfunction]
fn compress_whitespace_py(text: &str) -> PyResult<String> {
    Ok(compress_whitespace(text))
}

#[cfg(feature = "python")]
#[pymodule]
fn codecontext_core(_py: Python, m: &PyModule) -> PyResult<()> {
    m.add_function(wrap_pyfunction!(compress_whitespace_py, m)?)?;
    Ok(())
}

#[cfg(feature = "wasm")]
use wasm_bindgen::prelude::*;

#[cfg(feature = "wasm")]
#[wasm_bindgen]
pub fn compress_whitespace_wasm(text: &str) -> String {
    compress_whitespace(text)
}