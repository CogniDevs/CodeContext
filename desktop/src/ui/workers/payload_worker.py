import os
from PyQt6.QtCore import QThread, pyqtSignal
from core.rust_core_service import RustCoreService


class PayloadWorker(QThread):
    finished = pyqtSignal(str, int)
    error = pyqtSignal(str)

    def __init__(
            self,
            root_dir: str,
            root_node: dict,
            selected_files: list,
            selected_paths: set,
            system_prompt: str,
            xml_format: bool,
            always_send_full_tree: bool,
            strip_comments: bool,
            compress_whitespace: bool,
            sanitize_secrets: bool,
            skeleton_mode: bool = False
    ):
        super().__init__()
        self.root_dir = root_dir
        self.root_node = root_node
        self.selected_files = selected_files
        self.selected_paths = selected_paths
        self.system_prompt = system_prompt
        self.xml_format = xml_format
        self.always_send_full_tree = always_send_full_tree
        self.strip_comments = strip_comments
        self.compress_whitespace = compress_whitespace
        self.sanitize_secrets = sanitize_secrets
        self.skeleton_mode = skeleton_mode

    def run(self):
        try:
            files_payload = []
            for file_info in self.selected_files:
                rel_path = file_info.get("rel_path", "")
                full_path = file_info.get("full_path", "")

                if not full_path or not os.path.exists(full_path):
                    continue

                try:
                    with open(full_path, "r", encoding="utf-8", errors="replace") as f:
                        content = f.read()
                    files_payload.append((rel_path, content))
                except Exception as e:
                    files_payload.append((rel_path, f"[Ошибка чтения файла: {e}]"))

            options = {
                "strip_comments": self.strip_comments,
                "compress_whitespace": self.compress_whitespace,
                "sanitize_secrets": self.sanitize_secrets,
                "skeleton_mode": self.skeleton_mode,
                "xml_format": self.xml_format,
                "always_send_full_tree": self.always_send_full_tree,
                "system_prompt": self.system_prompt
            }

            root_name = os.path.basename(self.root_dir) if self.root_dir else "project"

            payload = RustCoreService.build_payload(
                root_name,
                self.root_node,
                files_payload,
                self.selected_paths,
                options
            )

            token_count = RustCoreService.count_tokens(payload)
            self.finished.emit(payload, token_count)
        except Exception as e:
            self.error.emit(str(e))