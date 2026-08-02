#![allow(unsafe_op_in_unsafe_fn)]

pub mod models;
pub mod scanner;
pub mod services;
pub mod tokenizer;
pub mod transformers;

#[cfg(any(feature = "python", feature = "wasm"))]
use models::{FileNode, ScanOptions, TransformOptions};
#[cfg(any(feature = "python", feature = "wasm"))]
use services::FileInput;
#[cfg(any(feature = "python", feature = "wasm"))]
use std::collections::HashSet;

#[cfg(feature = "python")]
use pyo3::prelude::*;

#[cfg(feature = "python")]
#[pyfunction]
fn compress_whitespace_py(text: &str) -> PyResult<String> {
    Ok(transformers::compress_whitespace(text))
}

#[cfg(feature = "python")]
#[pyfunction]
fn sanitize_secrets_py(text: &str) -> PyResult<String> {
    Ok(transformers::sanitize_secrets(text))
}

#[cfg(feature = "python")]
#[pyfunction]
fn strip_comments_py(text: &str, extension: &str, rules_json: Option<&str>) -> PyResult<String> {
    Ok(transformers::strip_comments(text, extension, rules_json))
}

#[cfg(feature = "python")]
#[pyfunction]
fn count_tokens_py(text: &str) -> PyResult<usize> {
    Ok(tokenizer::count_tokens(text))
}

#[cfg(feature = "python")]
#[pyfunction]
fn scan_directory_py(root_dir: &str, options_json: &str) -> PyResult<String> {
    let options: ScanOptions = serde_json::from_str(options_json)
        .map_err(|e| pyo3::exceptions::PyValueError::new_err(e.to_string()))?;

    let root_node = scanner::scan_directory(root_dir, &options);
    serde_json::to_string(&root_node)
        .map_err(|e| pyo3::exceptions::PyValueError::new_err(e.to_string()))
}

#[cfg(feature = "python")]
#[pyfunction]
fn trace_dependencies_py(
    root_dir: &str,
    target_rel_path: &str,
    content: &str,
) -> PyResult<Vec<String>> {
    let deps = services::trace_dependencies(root_dir, target_rel_path, content);
    Ok(deps.into_iter().collect())
}

#[cfg(feature = "python")]
#[pyfunction]
fn build_payload_py(
    root_name: &str,
    root_node_json: &str,
    files_json: &str,
    selected_paths_json: &str,
    options_json: &str,
) -> PyResult<String> {
    let root_node: Option<FileNode> = if root_node_json.trim().is_empty() {
        None
    } else {
        serde_json::from_str(root_node_json).ok()
    };

    let files_raw: Vec<(String, String)> = serde_json::from_str(files_json)
        .map_err(|e| pyo3::exceptions::PyValueError::new_err(e.to_string()))?;

    let files: Vec<FileInput> = files_raw
        .into_iter()
        .map(|(rel_path, content)| FileInput { rel_path, content })
        .collect();

    let selected_paths: HashSet<String> = serde_json::from_str(selected_paths_json)
        .map_err(|e| pyo3::exceptions::PyValueError::new_err(e.to_string()))?;

    let options: TransformOptions = serde_json::from_str(options_json)
        .map_err(|e| pyo3::exceptions::PyValueError::new_err(e.to_string()))?;

    Ok(services::build_payload(
        root_name,
        root_node.as_ref(),
        &files,
        &selected_paths,
        &options,
    ))
}

#[cfg(feature = "python")]
#[pymodule]
fn codecontext_core(_py: Python, m: &PyModule) -> PyResult<()> {
    m.add_function(wrap_pyfunction!(compress_whitespace_py, m)?)?;
    m.add_function(wrap_pyfunction!(sanitize_secrets_py, m)?)?;
    m.add_function(wrap_pyfunction!(strip_comments_py, m)?)?;
    m.add_function(wrap_pyfunction!(count_tokens_py, m)?)?;
    m.add_function(wrap_pyfunction!(scan_directory_py, m)?)?;
    m.add_function(wrap_pyfunction!(trace_dependencies_py, m)?)?;
    m.add_function(wrap_pyfunction!(build_payload_py, m)?)?;
    Ok(())
}

#[cfg(feature = "wasm")]
use wasm_bindgen::prelude::*;

#[cfg(feature = "wasm")]
#[wasm_bindgen]
pub fn compress_whitespace_wasm(text: &str) -> String {
    transformers::compress_whitespace(text)
}

#[cfg(feature = "wasm")]
#[wasm_bindgen]
pub fn sanitize_secrets_wasm(text: &str) -> String {
    transformers::sanitize_secrets(text)
}

#[cfg(feature = "wasm")]
#[wasm_bindgen]
pub fn strip_comments_wasm(text: &str, extension: &str, rules_json: Option<String>) -> String {
    transformers::strip_comments(text, extension, rules_json.as_deref())
}

#[cfg(feature = "wasm")]
#[wasm_bindgen]
pub fn count_tokens_wasm(text: &str) -> usize {
    tokenizer::count_tokens(text)
}

#[cfg(feature = "wasm")]
#[wasm_bindgen]
pub fn is_ignored_wasm(rel_path: &str, is_dir: bool, options_json: &str) -> bool {
    let options: ScanOptions = serde_json::from_str(options_json).unwrap_or_default();
    scanner::is_ignored(rel_path, is_dir, &options)
}

#[cfg(feature = "wasm")]
#[wasm_bindgen]
pub fn trace_dependencies_wasm(
    root_dir: &str,
    target_rel_path: &str,
    content: &str,
    all_known_paths_json: Option<String>,
) -> Vec<String> {
    let known_paths: Option<HashSet<String>> = all_known_paths_json
        .as_deref()
        .and_then(|s| serde_json::from_str(s).ok());

    services::dependency_service::trace_dependencies_with_known_paths(
        root_dir,
        target_rel_path,
        content,
        known_paths.as_ref(),
    )
    .into_iter()
    .collect()
}

#[cfg(feature = "wasm")]
#[wasm_bindgen]
pub fn build_payload_wasm(
    root_name: &str,
    root_node_json: &str,
    files_json: &str,
    selected_paths_json: &str,
    options_json: &str,
) -> String {
    let root_node: Option<FileNode> = if root_node_json.trim().is_empty() {
        None
    } else {
        serde_json::from_str(root_node_json).ok()
    };

    let files_raw: Vec<(String, String)> = serde_json::from_str(files_json).unwrap_or_default();
    let files: Vec<FileInput> = files_raw
        .into_iter()
        .map(|(rel_path, content)| FileInput { rel_path, content })
        .collect();

    let selected_paths: HashSet<String> = serde_json::from_str(selected_paths_json).unwrap_or_default();
    let options: TransformOptions = serde_json::from_str(options_json).unwrap_or_default();

    services::build_payload(
        root_name,
        root_node.as_ref(),
        &files,
        &selected_paths,
        &options,
    )
}