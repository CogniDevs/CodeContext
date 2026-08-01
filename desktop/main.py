import sys
import os

if sys.platform == 'win32':
    import ctypes
    try:
        ctypes.windll.shell32.SetCurrentProcessExplicitAppUserModelID("cognidevs.codecontext.gui.1.0")
    except Exception:
        pass

current_dir = os.path.dirname(os.path.abspath(__file__))
src_dir = os.path.join(current_dir, "src")

if src_dir not in sys.path:
    sys.path.insert(0, src_dir)

from PyQt6.QtWidgets import QApplication
from ui.main_window import CodeContextApp

def main():
    app = QApplication(sys.argv)
    window = CodeContextApp()
    window.show()
    sys.exit(app.exec())

if __name__ == '__main__':
    main()