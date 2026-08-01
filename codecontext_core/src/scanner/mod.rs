pub mod scanner_service;

pub use scanner_service::is_ignored;
#[cfg(not(target_arch = "wasm32"))]
pub use scanner_service::scan_directory;