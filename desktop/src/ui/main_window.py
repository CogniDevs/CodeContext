import os
from PyQt6.QtWidgets import QMainWindow, QWidget, QVBoxLayout, QSplitter, QStatusBar, QMessageBox
from PyQt6.QtCore import Qt
from PyQt6.QtGui import QAction

from config.config_manager import ConfigManager
from config.prompt_manager import PromptManager
from config.resource_helper import get_recolored_icon
from ui.widgets.paths_panel import PathsPanel
from ui.widgets.tree_panel import TreePanel
from ui.widgets.control_panel import ControlPanel
from ui.widgets.bottom_panel import BottomPanel
from ui.controller import PackerController
from ui.settings_dialog import SettingsDialog
from ui.style import get_stylesheet, DARK_PALETTE, LIGHT_PALETTE
from core.updater import CURRENT_VERSION


class CodeContextApp(QMainWindow):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("CodeContext")
        self.resize(1100, 700)
        self.setAcceptDrops(True)

        self.config_manager = ConfigManager()
        self.prompt_manager = PromptManager(self.config_manager.config_dir, self.config_manager)
        self.root_dir = ""

        self.update_application_theme()
        self.init_ui()

        self.controller = PackerController(self, self.config_manager, self.prompt_manager)

    def init_ui(self):
        main_widget = QWidget()
        self.setCentralWidget(main_widget)
        main_layout = QVBoxLayout(main_widget)

        self.paths_panel = PathsPanel(self)
        main_layout.addWidget(self.paths_panel)

        splitter = QSplitter(Qt.Orientation.Horizontal)

        self.tree_panel = TreePanel(self)
        self.control_panel = ControlPanel(self)

        splitter.addWidget(self.tree_panel)
        splitter.addWidget(self.control_panel)
        splitter.setSizes([650, 450])

        main_layout.addWidget(splitter, 1)

        self.bottom_panel = BottomPanel(self)
        main_layout.addWidget(self.bottom_panel)

        self.status_bar = QStatusBar()
        self.setStatusBar(self.status_bar)
        self.status_bar.showMessage("Готов к работе. Rust-ядро подключено.")

        self._create_menu_bar()

    def _create_menu_bar(self):
        menu_bar = self.menuBar()

        file_menu = menu_bar.addMenu("Файл")

        act_open = QAction("Открыть папку проекта...", self)
        act_open.setShortcut("Ctrl+O")
        act_open.triggered.connect(self.paths_panel.browse_directory)
        file_menu.addAction(act_open)

        act_save_path = QAction("Выбрать файл сохранения...", self)
        act_save_path.triggered.connect(self.paths_panel.browse_output_file)
        file_menu.addAction(act_save_path)

        file_menu.addSeparator()

        act_exit = QAction("Выход", self)
        act_exit.triggered.connect(self.close)
        file_menu.addAction(act_exit)

        settings_menu = menu_bar.addMenu("Настройки")

        self.act_pref = QAction("Параметры...", self)
        self.act_pref.setShortcut("Ctrl+P")

        theme = self.config_manager.get("theme", "Темная (VS Code)")
        color = "#d4d4d4" if "Темная" in theme else "#1f1f1f"
        settings_icon = get_recolored_icon("resources/icons/ui/settings.svg", color)
        if not settings_icon.isNull():
            self.act_pref.setIcon(settings_icon)

        self.act_pref.triggered.connect(self.open_settings_dialog)
        settings_menu.addAction(self.act_pref)

        help_menu = menu_bar.addMenu("Справка")

        act_check = QAction("Проверить обновления...", self)
        act_check.triggered.connect(self.check_for_updates_manual)
        help_menu.addAction(act_check)

        act_about = QAction("О программе", self)
        act_about.triggered.connect(self.show_about_dialog)
        help_menu.addAction(act_about)

    def create_new_prompt(self):
        import time
        from ui.prompt_edit_dialog import PromptCreateDialog

        dialog = PromptCreateDialog(self.prompt_manager, self)
        if dialog.exec() == PromptCreateDialog.DialogCode.Accepted:
            data = dialog.get_data()
            new_key = f"user_prompt_{int(time.time())}"
            self.prompt_manager.prompts[new_key] = data
            self.prompt_manager.save_prompts()
            self.control_panel.append_log(f"Создан новый скилл '{data['title']}'.")
            self.config_manager.set("last_prompt_key", new_key)
            self.control_panel.populate_prompts(self.prompt_manager.prompts, new_key)

    def edit_current_prompt(self):
        current_key = self.control_panel.get_current_prompt_key()
        if not current_key:
            return

        prompt_data = self.prompt_manager.prompts.get(current_key)
        if not prompt_data:
            return

        from ui.prompt_edit_dialog import PromptEditDialog

        dialog = PromptEditDialog(prompt_data.get("title", ""), prompt_data.get("prompt", ""), self)
        if dialog.exec() == PromptEditDialog.DialogCode.Accepted:
            new_text = dialog.get_text()
            self.prompt_manager.update_prompt(current_key, new_text)
            self.control_panel.append_log(f"Шаблон '{prompt_data['title']}' успешно обновлен.")
            self.controller.reload_tree()

    def open_settings_dialog(self):
        dialog = SettingsDialog(self.config_manager, self)
        if dialog.exec() == SettingsDialog.DialogCode.Accepted:
            self.update_application_theme()
            self.controller.reload_tree()

    def check_for_updates_manual(self):
        self.controller.check_for_updates(silent=False)

    def update_application_theme(self):
        theme = self.config_manager.get("theme", "Темная (VS Code)")
        if "Темная" in theme:
            self.setStyleSheet(get_stylesheet(DARK_PALETTE))
            color = "#d4d4d4"
        else:
            self.setStyleSheet(get_stylesheet(LIGHT_PALETTE))
            color = "#1f1f1f"

        if hasattr(self, 'act_pref'):
            settings_icon = get_recolored_icon("resources/icons/ui/settings.svg", color)
            if not settings_icon.isNull():
                self.act_pref.setIcon(settings_icon)

    def show_about_dialog(self):
        QMessageBox.about(
            self,
            "О программе CodeContext",
            f"<b>CodeContext Desktop {CURRENT_VERSION}</b><br><br>"
            "Единая система подготовки и упаковки контекста исходного кода для LLM.<br>"
            "Ядро сканирования и трансформеры работают на <b>Rust Engine</b>.<br><br>"
            "Разработано в <b>CogniDevs</b>."
        )

    def dragEnterEvent(self, event):
        if event.mimeData().hasUrls():
            event.acceptProposedAction()

    def dropEvent(self, event):
        for url in event.mimeData().urls():
            path = url.toLocalFile()
            if os.path.isdir(path):
                self.paths_panel.set_project_dir(os.path.abspath(path))
                break

    def closeEvent(self, event):
        if hasattr(self, 'controller') and hasattr(self.controller, 'watcher'):
            self.controller.watcher.stop_watching()
        event.accept()