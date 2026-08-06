from PyQt6.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QLabel, QComboBox,
    QPushButton, QCheckBox, QGroupBox, QTextEdit
)
from PyQt6.QtCore import pyqtSignal, QSize
from PyQt6.QtGui import QPalette
from config.resource_helper import get_recolored_icon


class ControlPanel(QWidget):
    prompt_changed = pyqtSignal()
    settings_changed = pyqtSignal()
    add_prompt_clicked = pyqtSignal()
    edit_prompt_clicked = pyqtSignal()
    auto_watch_changed = pyqtSignal(bool)

    def __init__(self, parent=None):
        super().__init__(parent)
        self.init_ui()

    def _get_icon_color(self) -> str:
        color = self.palette().color(QPalette.ColorRole.ButtonText)
        if not color.isValid():
            color = self.palette().color(QPalette.ColorRole.WindowText)
        return color.name()

    def init_ui(self):
        layout = QVBoxLayout(self)
        layout.setContentsMargins(0, 0, 0, 0)

        icon_color = self._get_icon_color()

        ai_group = QGroupBox("Параметры контекста и ИИ")
        ai_layout = QVBoxLayout(ai_group)

        prompt_selector_layout = QHBoxLayout()
        prompt_selector_layout.addWidget(QLabel("Шаблон задачи (Скилл):"))
        self.combo_prompts = QComboBox()
        self.combo_prompts.currentTextChanged.connect(lambda: self.prompt_changed.emit())
        prompt_selector_layout.addWidget(self.combo_prompts, 1)

        btn_add_prompt = QPushButton()
        add_icon = get_recolored_icon("resources/icons/ui/add.svg", icon_color)
        if not add_icon.isNull():
            btn_add_prompt.setIcon(add_icon)
            btn_add_prompt.setIconSize(QSize(18, 18))
        else:
            btn_add_prompt.setText("+")
        btn_add_prompt.setToolTip("Добавить новый шаблон скилла")
        btn_add_prompt.setFixedSize(32, 32)
        btn_add_prompt.clicked.connect(self.add_prompt_clicked.emit)
        prompt_selector_layout.addWidget(btn_add_prompt)

        btn_edit_prompt = QPushButton()
        edit_icon = get_recolored_icon("resources/icons/ui/edit.svg", icon_color)
        if not edit_icon.isNull():
            btn_edit_prompt.setIcon(edit_icon)
            btn_edit_prompt.setIconSize(QSize(18, 18))
        else:
            btn_edit_prompt.setText("⚙")
        btn_edit_prompt.setToolTip("Редактировать текущий шаблон скилла")
        btn_edit_prompt.setFixedSize(32, 32)
        btn_edit_prompt.clicked.connect(self.edit_prompt_clicked.emit)
        prompt_selector_layout.addWidget(btn_edit_prompt)
        ai_layout.addLayout(prompt_selector_layout)

        budget_layout = QHBoxLayout()
        budget_layout.addWidget(QLabel("Лимит токенов (Smart Budget):"))
        self.combo_budget = QComboBox()
        self.combo_budget.addItems([
            "Без ограничений",
            "32,000 токенов",
            "64,000 токенов",
            "128,000 токенов",
            "200,000 токенов"
        ])
        self.combo_budget.currentIndexChanged.connect(lambda: self.settings_changed.emit())
        budget_layout.addWidget(self.combo_budget, 1)
        ai_layout.addLayout(budget_layout)

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
        self.chk_sanitize_secrets = QCheckBox("Скрыть секреты")
        self.chk_sanitize_secrets.stateChanged.connect(lambda: self.settings_changed.emit())

        self.chk_skeleton_mode = QCheckBox("Скелет (сигнатуры)")
        self.chk_skeleton_mode.stateChanged.connect(lambda: self.settings_changed.emit())

        self.chk_watch_changes = QCheckBox("Авто-слежение")
        self.chk_watch_changes.stateChanged.connect(lambda state: self.auto_watch_changed.emit(state == 2))

        toggles_layout_2.addWidget(self.chk_sanitize_secrets)
        toggles_layout_2.addWidget(self.chk_skeleton_mode)
        toggles_layout_2.addWidget(self.chk_watch_changes)
        ai_layout.addLayout(toggles_layout_2)

        layout.addWidget(ai_group)

        log_group = QGroupBox("Лог работы")
        log_layout = QVBoxLayout(log_group)
        self.log_output = QTextEdit()
        self.log_output.setReadOnly(True)
        log_layout.addWidget(self.log_output)

        layout.addWidget(log_group, 1)

    def populate_prompts(self, prompts_dict: dict, last_prompt_key: str):
        self.combo_prompts.blockSignals(True)
        self.combo_prompts.clear()
        for key, value in prompts_dict.items():
            self.combo_prompts.addItem(value["title"], key)

        index = self.combo_prompts.findData(last_prompt_key)
        if index >= 0:
            self.combo_prompts.setCurrentIndex(index)
        self.combo_prompts.blockSignals(False)

    def get_current_prompt_key(self) -> str:
        return self.combo_prompts.currentData()

    def get_token_budget_limit(self) -> int | None:
        idx = self.combo_budget.currentIndex()
        if idx == 1:
            return 32000
        elif idx == 2:
            return 64000
        elif idx == 3:
            return 128000
        elif idx == 4:
            return 200000
        return None

    def get_settings(self) -> tuple:
        return (
            self.chk_xml.isChecked(),
            self.chk_strip_comments.isChecked(),
            self.chk_compress_whitespace.isChecked(),
            self.chk_sanitize_secrets.isChecked(),
            self.chk_skeleton_mode.isChecked(),
            self.chk_watch_changes.isChecked(),
            self.get_token_budget_limit()
        )

    def set_settings(self, xml: bool, strip: bool, compress: bool, sanitize: bool, skeleton: bool, watch: bool, budget_limit: int | None = None):
        for chk in (self.chk_xml, self.chk_strip_comments, self.chk_compress_whitespace, self.chk_sanitize_secrets, self.chk_skeleton_mode, self.chk_watch_changes):
            chk.blockSignals(True)

        self.chk_xml.setChecked(xml)
        self.chk_strip_comments.setChecked(strip)
        self.chk_compress_whitespace.setChecked(compress)
        self.chk_sanitize_secrets.setChecked(sanitize)
        self.chk_skeleton_mode.setChecked(skeleton)
        self.chk_watch_changes.setChecked(watch)

        self.combo_budget.blockSignals(True)
        if budget_limit == 32000:
            self.combo_budget.setCurrentIndex(1)
        elif budget_limit == 64000:
            self.combo_budget.setCurrentIndex(2)
        elif budget_limit == 128000:
            self.combo_budget.setCurrentIndex(3)
        elif budget_limit == 200000:
            self.combo_budget.setCurrentIndex(4)
        else:
            self.combo_budget.setCurrentIndex(0)
        self.combo_budget.blockSignals(False)

        for chk in (self.chk_xml, self.chk_strip_comments, self.chk_compress_whitespace, self.chk_sanitize_secrets, self.chk_skeleton_mode, self.chk_watch_changes):
            chk.blockSignals(False)

    def append_log(self, text: str):
        self.log_output.append(text)

    def delete_log(self):
        self.log_output.clear()