from PyQt6.QtWidgets import QWidget, QHBoxLayout, QLabel, QPushButton
from PyQt6.QtCore import pyqtSignal
from PyQt6.QtGui import QFont

class BottomPanel(QWidget):
    copy_clicked = pyqtSignal()
    save_clicked = pyqtSignal()

    def __init__(self, parent=None):
        super().__init__(parent)
        self.init_ui()

    def init_ui(self):
        layout = QHBoxLayout(self)
        layout.setContentsMargins(0, 0, 0, 0)

        self.lbl_stats = QLabel("Выбрано файлов: 0 | Итоговый размер: 0 KB | Токены (Rust/Tiktoken): ~0")
        self.lbl_stats.setFont(QFont("Segoe UI", 9, QFont.Weight.Bold))
        layout.addWidget(self.lbl_stats, 1)

        self.btn_copy = QPushButton("Скопировать в буфер")
        self.btn_copy.setEnabled(False)
        self.btn_copy.clicked.connect(self.copy_clicked.emit)
        layout.addWidget(self.btn_copy)

        self.btn_save = QPushButton("Записать в TXT")
        self.btn_save.setEnabled(False)
        self.btn_save.clicked.connect(self.save_clicked.emit)
        layout.addWidget(self.btn_save)

    def update_stats(self, selected_files_count: int, total_kb: float, exact_tokens: int):
        self.lbl_stats.setText(
            f"Выбрано файлов: {selected_files_count} | "
            f"Итоговый размер: {total_kb} KB | Токены (Rust/Tiktoken): ~{exact_tokens}"
        )

    def set_actions_enabled(self, enabled: bool):
        self.btn_copy.setEnabled(enabled)
        self.btn_save.setEnabled(enabled)