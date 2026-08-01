import os
from PyQt6.QtWidgets import QMainWindow, QWidget, QVBoxLayout, QSplitter, QStatusBar, QMessageBox
from PyQt6.QtCore import Qt
from PyQt6.QtGui import QAction

from config.config_manager import ConfigManager
from ui.widgets.paths_panel import PathsPanel
from ui.widgets.tree_panel import TreePanel
from ui.widgets.control_panel import ControlPanel
from ui.widgets.bottom_panel import BottomPanel
from ui.controller import PackerController

DARK_STYLESHEET = """
QMainWindow, QWidget { 
    background-color: #1e1e1e; 
    color: #d4d4d4; 
}
QGroupBox { 
    border: 1px solid #3c3c3c; 
    border-radius: 6px; 
    margin-top: 10px; 
    padding: 10px; 
    font-weight: bold; 
}
QGroupBox::title { 
    subcontrol-origin: margin; 
    left: 8px; 
    padding: 0 3px; 
}
QPushButton { 
    background-color: #0e639c; 
    color: #ffffff; 
    border: none; 
    padding: 6px 12px; 
    border-radius: 4px; 
    font-weight: bold; 
    font-size: 11px; 
}
QPushButton:hover { 
    background-color: #1177bb; 
}
QPushButton:disabled { 
    background-color: #3c3c3c; 
    color: #7f7f7f; 
}
QLineEdit, QTextEdit { 
    background-color: #252526; 
    border: 1px solid #3c3c3c; 
    border-radius: 4px; 
    color: #d4d4d4; 
    padding: 5px; 
}
QTreeWidget { 
    background-color: #252526; 
    border: 1px solid #3c3c3c; 
    color: #d4d4d4; 
}
QHeaderView::section { 
    background-color: #2d2d2d; 
    color: #d4d4d4; 
    border: 1px solid #3c3c3c; 
    padding: 4px; 
}
QStatusBar { 
    background-color: #0e639c; 
    color: #ffffff; 
}
"""


class CodeContextApp(QMainWindow):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("CodeContext Desktop (Powered by Rust Engine)")
        self.resize(1100, 700)
        self.setStyleSheet(DARK_STYLESHEET)
        self.setAcceptDrops(True)

        self.config_manager = ConfigManager()
        self.root_dir = ""

        self.init_ui()
        self.controller = PackerController(self, self.config_manager)

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

        act_exit = QAction("Выход", self)
        act_exit.triggered.connect(self.close)
        file_menu.addAction(act_exit)

        help_menu = menu_bar.addMenu("Справка")
        act_about = QAction("О программе", self)
        act_about.triggered.connect(self.show_about_dialog)
        help_menu.addAction(act_about)

    def show_about_dialog(self):
        QMessageBox.about(
            self,
            "О программе CodeContext",
            "<b>CodeContext Desktop v0.1.0</b><br><br>"
            "Единая система подготовки и упаковки контекста исходного кода для LLM.<br>"
            "Ядро сканирования и трансформеры работают на <b>Rust</b>.<br><br>"
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