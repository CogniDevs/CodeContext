import os
from PyQt6.QtCore import QObject, pyqtSignal
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler


class FileSystemHandler(FileSystemEventHandler):
    def __init__(self, on_change_callback):
        super().__init__()
        self.on_change_callback = on_change_callback

    def on_any_event(self, event):
        ignored_parts = {'.git', '.idea', '.vscode', 'node_modules', '__pycache__', 'venv', '.venv', 'dist', 'build', 'target'}
        path_parts = set(event.src_path.replace('\\', '/').split('/'))

        if not path_parts.intersection(ignored_parts):
            self.on_change_callback()


class ProjectWatcher(QObject):
    file_changed = pyqtSignal()

    def __init__(self):
        super().__init__()
        self.observer = None
        self.current_path = None

    def start_watching(self, path: str):
        self.stop_watching()
        if not path or not os.path.exists(path):
            return

        self.current_path = path
        self.observer = Observer()
        handler = FileSystemHandler(self.file_changed.emit)

        try:
            self.observer.schedule(handler, self.current_path, recursive=True)
            self.observer.start()
        except Exception as e:
            print(f"Не удалось запустить наблюдатель изменений: {e}")

    def stop_watching(self):
        if self.observer:
            try:
                self.observer.stop()
                self.observer.join()
            except Exception:
                pass
            self.observer = None
            self.current_path = None