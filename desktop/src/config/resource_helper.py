import os
import sys
from PyQt6.QtGui import QIcon, QPixmap, QPainter
from PyQt6.QtCore import QByteArray, QSize, Qt
from PyQt6.QtSvg import QSvgRenderer


def get_resource_path(relative_path: str) -> str:
    if hasattr(sys, '_MEIPASS'):
        return os.path.join(sys._MEIPASS, relative_path)

    current_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(os.path.dirname(os.path.dirname(current_dir)))
    return os.path.join(project_root, relative_path)


def get_recolored_icon(relative_path: str, color_hex: str) -> QIcon:
    svg_path = get_resource_path(relative_path)
    if not os.path.exists(svg_path):
        return QIcon()
    try:
        with open(svg_path, 'r', encoding='utf-8') as f:
            content = f.read()

        content = content.replace('stroke="currentColor"', f'stroke="{color_hex}"')
        content = content.replace('fill="currentColor"', f'fill="{color_hex}"')

        renderer = QSvgRenderer(QByteArray(content.encode('utf-8')))
        if not renderer.isValid():
            return QIcon()

        size = renderer.defaultSize()
        if size.isEmpty():
            size = QSize(24, 24)

        pixmap = QPixmap(size)
        pixmap.fill(Qt.GlobalColor.transparent)

        painter = QPainter(pixmap)
        renderer.render(painter)
        painter.end()

        return QIcon(pixmap)
    except Exception:
        return QIcon()