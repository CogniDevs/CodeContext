from PyQt6.QtWidgets import QWidget, QVBoxLayout, QHBoxLayout, QCheckBox, QGroupBox, QTextEdit
from PyQt6.QtCore import pyqtSignal

class ControlPanel(QWidget):
    settings_changed = pyqtSignal()

    def __init__(self, parent=None):
        super().__init__(parent)
        self.init_ui()

    def init_ui(self):
        layout = QVBoxLayout(self)
        layout.setContentsMargins(0, 0, 0, 0)

        ai_group = QGroupBox("Параметры контекста и обработки")
        ai_layout = QVBoxLayout(ai_group)

        toggles_layout_1 = QHBoxLayout()
        self.chk_xml = QCheckBox("Формат XML")
        self.chk_xml.setChecked(True)
        self.chk_xml.stateChanged.connect(lambda: self.settings_changed.emit())

        self.chk_strip_comments = QCheckBox("Без комментариев")
        self.chk_strip_comments.stateChanged.connect(lambda: self.settings_changed.emit())

        self.chk_compress_whitespace = QCheckBox("Сжать код")
        self.chk_compress_whitespace.stateChanged.connect(lambda: self.settings_changed.emit())

        toggles_layout_1.addWidget(self.chk_xml)
        toggles_layout_1.addWidget(self.chk_strip_comments)
        toggles_layout_1.addWidget(self.chk_compress_whitespace)
        ai_layout.addLayout(toggles_layout_1)

        toggles_layout_2 = QHBoxLayout()
        self.chk_sanitize_secrets = QCheckBox("Скрыть секреты (Rust)")
        self.chk_sanitize_secrets.stateChanged.connect(lambda: self.settings_changed.emit())

        toggles_layout_2.addWidget(self.chk_sanitize_secrets)
        ai_layout.addLayout(toggles_layout_2)

        layout.addWidget(ai_group)

        log_group = QGroupBox("Лог работы")
        log_layout = QVBoxLayout(log_group)
        self.log_output = QTextEdit()
        self.log_output.setReadOnly(True)
        log_layout.addWidget(self.log_output)

        layout.addWidget(log_group, 1)

    def get_settings(self) -> tuple:
        return (
            self.chk_xml.isChecked(),
            self.chk_strip_comments.isChecked(),
            self.chk_compress_whitespace.isChecked(),
            self.chk_sanitize_secrets.isChecked()
        )

    def append_log(self, text: str):
        self.log_output.append(text)