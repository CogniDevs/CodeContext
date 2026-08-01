import os
from PyQt6.QtCore import QObject, QTimer
from PyQt6.QtWidgets import QMessageBox, QApplication, QPushButton

from core.rust_core_service import RustCoreService
from core.git_service import GitService
from core.dependency_service import DependencyService
from core.watcher import ProjectWatcher
from core.updater import UpdateCheckerThread, perform_self_update, apply_restart_and_exit
from ui.workers.payload_worker import PayloadWorker


class PackerController(QObject):
    def __init__(self, main_window, config_manager, prompt_manager):
        super().__init__(main_window)
        self.view = main_window
        self.config_manager = config_manager
        self.prompt_manager = prompt_manager

        self.root_node_dict = {}
        self.payload_worker = None
        self.update_thread = None
        self.last_generated_payload = ""

        self.git_service = GitService()
        self.dependency_service = DependencyService()

        self.watcher = ProjectWatcher()
        self.watcher.file_changed.connect(self.on_file_changed_event)

        self.update_timer = QTimer()
        self.update_timer.setSingleShot(True)
        self.update_timer.timeout.connect(self.reload_tree)

        self.stats_timer = QTimer()
        self.stats_timer.setSingleShot(True)
        self.stats_timer.timeout.connect(self.update_stats)

        self._connect_signals()
        self._init_view_data()

        if self.config_manager.get("auto_check_updates", True):
            self.check_for_updates(silent=True)

    def _connect_signals(self):
        self.view.paths_panel.project_dir_changed.connect(self.on_project_dir_changed)
        self.view.paths_panel.export_path_changed.connect(self.on_export_path_changed)

        self.view.tree_panel.selection_changed.connect(lambda: self.stats_timer.start(200))
        self.view.tree_panel.refresh_requested.connect(self.reload_tree)

        for btn in self.view.tree_panel.findChildren(QPushButton):
            if btn.text() == "Только Git":
                btn.clicked.connect(self.on_git_select_requested)
            elif btn.text() == "Импорты":
                btn.clicked.connect(self.on_deps_select_requested)

        self.view.control_panel.settings_changed.connect(self.reload_tree)
        self.view.control_panel.auto_watch_changed.connect(self.on_auto_watch_changed)
        self.view.control_panel.prompt_changed.connect(self.on_prompt_changed)
        self.view.control_panel.add_prompt_clicked.connect(self.view.create_new_prompt)
        self.view.control_panel.edit_prompt_clicked.connect(self.view.edit_current_prompt)

        self.view.bottom_panel.copy_clicked.connect(self.copy_to_clipboard)
        self.view.bottom_panel.save_clicked.connect(self.save_to_txt)

    def _init_view_data(self):
        self.view.control_panel.populate_prompts(
            self.prompt_manager.prompts,
            self.config_manager.get("last_prompt_key", "just_code")
        )
        self.view.control_panel.set_settings(
            self.config_manager.get("xml_format", True),
            self.config_manager.get("strip_comments", False),
            self.config_manager.get("compress_whitespace", False),
            self.config_manager.get("sanitize_secrets", False),
            self.config_manager.get("skeleton_mode", False),
            self.config_manager.get("auto_watch", True)
        )

    def on_project_dir_changed(self, path: str):
        self.view.root_dir = path
        export_path = os.path.join(path, "code_context.txt") if path else ""
        self.view.paths_panel.set_export_path(export_path)

        if self.config_manager.get("auto_watch", True) and path and os.path.exists(path):
            self.watcher.start_watching(path)
        else:
            self.watcher.stop_watching()

        self.reload_tree()

    def on_export_path_changed(self, path: str):
        self.reload_tree()

    def on_prompt_changed(self):
        current_key = self.view.control_panel.get_current_prompt_key()
        if current_key:
            self.config_manager.set("last_prompt_key", current_key)
            self.reload_tree()

    def on_auto_watch_changed(self, enabled: bool):
        self.config_manager.set("auto_watch", enabled)
        if enabled:
            project_dir = self.view.paths_panel.get_project_dir()
            if project_dir and os.path.exists(project_dir):
                self.watcher.start_watching(project_dir)
                self.view.control_panel.append_log("Автоматическое слежение за папкой включено.")
        else:
            self.watcher.stop_watching()
            self.view.control_panel.append_log("Автоматическое слежение за папкой отключено.")

    def on_git_select_requested(self):
        project_dir = self.view.paths_panel.get_project_dir()
        success, msg, modified_files = self.git_service.get_modified_files(project_dir)
        if success:
            self.view.tree_panel.check_all_items(False)
            self.view.tree_panel.select_specific_paths(modified_files)
            self.view.status_bar.showMessage(msg)
            self.view.control_panel.append_log(f"Git Status: {msg}")
        else:
            QMessageBox.warning(self.view, "Git Status", msg)

    def on_deps_select_requested(self):
        project_dir = self.view.paths_panel.get_project_dir()
        target_rel = self.view.tree_panel.get_current_focused_rel_path()
        if not target_rel:
            QMessageBox.information(self.view, "Импорты", "Выберите файл в дереве для анализа его импортов.")
            return

        full_target_path = os.path.join(project_dir, target_rel)
        content = ""
        if os.path.exists(full_target_path) and os.path.isfile(full_target_path):
            try:
                with open(full_target_path, "r", encoding="utf-8", errors="replace") as f:
                    content = f.read()
            except Exception:
                content = ""

        if RustCoreService.is_available():
            deps = RustCoreService.trace_dependencies(project_dir, target_rel, content)
        else:
            deps = self.dependency_service.trace_dependencies(project_dir, target_rel)

        if not deps:
            QMessageBox.information(self.view, "Импорты", f"Для файла '{target_rel}' не найдено локальных импортов.")
            return

        self.view.tree_panel.select_specific_paths(deps)
        msg = f"Выделено импортируемых файлов ({len(deps)}) для '{target_rel}'"
        self.view.status_bar.showMessage(msg)
        self.view.control_panel.append_log(msg)

    def on_file_changed_event(self):
        self.update_timer.start(1500)

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
            "gitignore_disabled_rules": self.config_manager.get("gitignore_disabled_rules", []),
            "binary_extensions": self.config_manager.get("binary_extensions", []),
            "lockfiles_excludes": self.config_manager.get("lockfiles_excludes", []),
            "output_file_path": self.view.paths_panel.get_export_path()
        }

        saved_states = self.view.tree_panel.get_check_states()
        self.root_node_dict = RustCoreService.scan_directory(project_dir, options)
        self.view.tree_panel.populate_tree(self.root_node_dict, saved_states)
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

        current_key = self.view.control_panel.get_current_prompt_key()
        system_prompt = ""
        if current_key and current_key in self.prompt_manager.prompts:
            system_prompt = self.prompt_manager.prompts[current_key].get("prompt", "")

        xml, strip, compress, sanitize, skeleton, watch = self.view.control_panel.get_settings()

        self.config_manager.set("xml_format", xml)
        self.config_manager.set("strip_comments", strip)
        self.config_manager.set("compress_whitespace", compress)
        self.config_manager.set("sanitize_secrets", sanitize)
        self.config_manager.set("skeleton_mode", skeleton)

        self.payload_worker = PayloadWorker(
            self.view.paths_panel.get_project_dir(),
            self.root_node_dict,
            selected_files,
            selected_paths,
            system_prompt,
            xml,
            self.config_manager.get("always_send_full_tree", True),
            strip,
            compress,
            sanitize,
            skeleton,
            self.config_manager.comment_rules
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
        else:
            self.start_payload_generation(self._copy_payload_action)

    def _copy_payload_action(self, payload: str, tokens: int):
        if payload:
            QApplication.clipboard().setText(payload)
            self.view.status_bar.showMessage("Контекст скопирован в буфер обмена!")
            self.view.control_panel.append_log("Скопировано в буфер обмена.")

    def save_to_txt(self):
        out_path = self.view.paths_panel.get_export_path()
        if not out_path:
            QMessageBox.warning(self.view, "Ошибка", "Укажите путь для сохранения .txt файла.")
            return

        if self.last_generated_payload:
            self._save_payload_action(self.last_generated_payload, out_path)
        else:
            self.start_payload_generation(
                lambda payload, tokens: self._save_payload_action(payload, out_path)
            )

    def _save_payload_action(self, payload: str, out_path: str):
        if not payload:
            return
        try:
            with open(out_path, 'w', encoding='utf-8') as f:
                f.write(payload)
            self.view.status_bar.showMessage(f"Файл сохранен: {os.path.basename(out_path)}")
            self.view.control_panel.append_log(f"Файл записан: {out_path}")
            QMessageBox.information(self.view, "Успешно", f"Файл сохранен:\n{out_path}")
        except Exception as e:
            QMessageBox.critical(self.view, "Ошибка", f"Не удалось записать файл:\n{e}")

    def check_for_updates(self, silent: bool = True):
        self.update_thread = UpdateCheckerThread(self)
        self.update_thread.check_finished.connect(
            lambda available, version, url: self.on_update_check_finished(available, version, url, silent)
        )
        self.update_thread.start()

    def on_update_check_finished(self, available: bool, version: str, url: str, silent: bool):
        if available and url:
            reply = QMessageBox.question(
                self.view,
                "Доступно обновление",
                f"Найдена новая версия программы: {version}.\nЖелаете обновиться автоматически сейчас?",
                QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No
            )
            if reply == QMessageBox.StandardButton.Yes:
                self.view.status_bar.showMessage("Скачивание обновления...")
                success, msg, new_file_path = perform_self_update(url)
                if success:
                    QMessageBox.information(
                        self.view,
                        "Обновление готово",
                        f"{msg}\n\nПрограмма будет автоматически закрыта и перезапущена для завершения установки."
                    )
                    apply_restart_and_exit(new_file_path)
                else:
                    QMessageBox.warning(self.view, "Ошибка обновления", f"Не удалось выполнить обновление:\n{msg}")
                    self.view.status_bar.showMessage("Не удалось обновить приложение.")
        else:
            if not silent:
                QMessageBox.information(self.view, "Обновления", "У вас установлена последняя версия.")
                self.view.status_bar.showMessage("Версия актуальна.")