import os
from PyQt6.QtCore import QObject, QTimer
from PyQt6.QtWidgets import QMessageBox, QApplication
from core.rust_core_service import RustCoreService
from ui.workers.payload_worker import PayloadWorker

class PackerController(QObject):
    def __init__(self, main_window, config_manager):
        super().__init__(main_window)
        self.view = main_window
        self.config_manager = config_manager
        self.root_node_dict = {}
        self.payload_worker = None
        self.last_generated_payload = ""

        self.stats_timer = QTimer()
        self.stats_timer.setSingleShot(True)
        self.stats_timer.timeout.connect(self.update_stats)

        self._connect_signals()

    def _connect_signals(self):
        self.view.paths_panel.project_dir_changed.connect(self.on_project_dir_changed)
        self.view.paths_panel.export_path_changed.connect(self.on_export_path_changed)
        self.view.tree_panel.selection_changed.connect(lambda: self.stats_timer.start(200))
        self.view.tree_panel.refresh_requested.connect(self.reload_tree)
        self.view.control_panel.settings_changed.connect(self.reload_tree)

        self.view.bottom_panel.copy_clicked.connect(self.copy_to_clipboard)
        self.view.bottom_panel.save_clicked.connect(self.save_to_txt)

    def on_project_dir_changed(self, path: str):
        self.view.root_dir = path
        export_path = os.path.join(path, "code_context.txt") if path else ""
        self.view.paths_panel.set_export_path(export_path)
        self.reload_tree()

    def on_export_path_changed(self, path: str):
        pass

    def reload_tree(self):
        project_dir = self.view.paths_panel.get_project_dir()
        if not project_dir or not os.path.exists(project_dir):
            return

        self.view.status_bar.showMessage("Сканирование диска через Rust Engine...")

        options = {
            "use_gitignore": self.config_manager.get("use_gitignore", True),
            "ignore_binary": self.config_manager.get("ignore_binary", True),
            "ignore_lockfiles": self.config_manager.get("ignore_lockfiles", True),
            "whitelist_extensions": self.config_manager.get("active_extensions", []),
            "manual_excludes": self.config_manager.get("global_excludes", []),
            "gitignore_disabled_rules": [],
            "binary_extensions": self.config_manager.get("binary_extensions", []),
            "lockfiles_excludes": self.config_manager.get("lockfiles_excludes", [])
        }

        self.root_node_dict = RustCoreService.scan_directory(project_dir, options)
        self.view.tree_panel.populate_tree(self.root_node_dict)
        self.update_stats()
        self.view.bottom_panel.set_actions_enabled(True)
        self.view.status_bar.showMessage("Проект просканирован успешно на Rust.")
        self.view.control_panel.append_log(f"Rust Scan: {project_dir}")

    def update_stats(self):
        selected_files = self.view.tree_panel.get_selected_files_info()
        total_size = sum(f.get('size', 0) for f in selected_files)
        total_kb = round(total_size / 1024, 1)

        if not selected_files or not self.root_node_dict:
            self.view.bottom_panel.update_stats(len(selected_files), total_kb, 0)
            return

        self.start_payload_generation(
            lambda payload, exact_tokens: self.view.bottom_panel.update_stats(
                len(selected_files), total_kb, exact_tokens
            )
        )

    def start_payload_generation(self, callback):
        if self.payload_worker and self.payload_worker.isRunning():
            return

        selected_files = self.view.tree_panel.get_selected_files_info()
        selected_paths = set()
        for f in selected_files:
            rel_path = f.get('rel_path', '')
            selected_paths.add(rel_path)
            parts = rel_path.split('/')
            for i in range(1, len(parts)):
                selected_paths.add("/".join(parts[:i]))

        xml, strip, compress, sanitize = self.view.control_panel.get_settings()

        self.payload_worker = PayloadWorker(
            self.view.paths_panel.get_project_dir(),
            self.root_node_dict,
            selected_files,
            selected_paths,
            "",
            xml,
            self.config_manager.get("always_send_full_tree", True),
            strip,
            compress,
            sanitize
        )

        self.payload_worker.finished.connect(
            lambda payload, tokens: self._on_payload_ready(payload, tokens, callback)
        )
        self.payload_worker.error.connect(self.on_payload_error)
        self.payload_worker.start()

    def _on_payload_ready(self, payload: str, tokens: int, callback):
        self.last_generated_payload = payload
        callback(payload, tokens)

    def on_payload_error(self, err_msg: str):
        QMessageBox.critical(self.view, "Ошибка генерации", f"Не удалось собрать контекст:\n{err_msg}")

    def copy_to_clipboard(self):
        if self.last_generated_payload:
            QApplication.clipboard().setText(self.last_generated_payload)
            self.view.status_bar.showMessage("Контекст скопирован в буфер обмена!")
            self.view.control_panel.append_log("Скопировано в буфер обмена.")

    def save_to_txt(self):
        out_path = self.view.paths_panel.get_export_path()
        if not out_path:
            QMessageBox.warning(self.view, "Ошибка", "Укажите путь для сохранения .txt файла.")
            return

        if self.last_generated_payload:
            try:
                with open(out_path, 'w', encoding='utf-8') as f:
                    f.write(self.last_generated_payload)
                self.view.status_bar.showMessage(f"Файл сохранен: {os.path.basename(out_path)}")
                self.view.control_panel.append_log(f"Файл записан: {out_path}")
                QMessageBox.information(self.view, "Успешно", f"Файл сохранен:\n{out_path}")
            except Exception as e:
                QMessageBox.critical(self.view, "Ошибка", f"Не удалось записать файл:\n{e}")