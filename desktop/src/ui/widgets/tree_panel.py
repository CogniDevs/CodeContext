import os
from PyQt6.QtWidgets import QWidget, QVBoxLayout, QHBoxLayout, QLabel, QLineEdit, QPushButton, QTreeWidget, QTreeWidgetItem, QHeaderView, QStyle
from PyQt6.QtCore import Qt, pyqtSignal
from PyQt6.QtGui import QIcon
from config.resource_helper import get_resource_path


class TreePanel(QWidget):
    selection_changed = pyqtSignal()
    refresh_requested = pyqtSignal()
    log_message = pyqtSignal(str)

    def __init__(self, parent=None):
        super().__init__(parent)
        self.init_ui()

    def init_ui(self):
        layout = QVBoxLayout(self)
        layout.setContentsMargins(0, 0, 0, 0)

        toolbar = QHBoxLayout()
        toolbar.addWidget(QLabel("Структура для экспорта:"))

        btn_check_all = QPushButton("Выделить всё")
        btn_check_all.clicked.connect(lambda: self.check_all_items(True))
        toolbar.addWidget(btn_check_all)

        btn_uncheck_all = QPushButton("Снять выделение")
        btn_uncheck_all.clicked.connect(lambda: self.check_all_items(False))
        toolbar.addWidget(btn_uncheck_all)

        btn_git_select = QPushButton("Только Git")
        toolbar.addWidget(btn_git_select)

        btn_deps_select = QPushButton("Импорты")
        btn_deps_select.setToolTip("Выделить все импортируемые файлы для выбранного")
        toolbar.addWidget(btn_deps_select)

        btn_expand = QPushButton("Развернуть")
        btn_expand.clicked.connect(lambda: self.tree_widget.expandAll())
        toolbar.addWidget(btn_expand)

        btn_collapse = QPushButton("Свернуть")
        btn_collapse.clicked.connect(lambda: self.tree_widget.collapseAll())
        toolbar.addWidget(btn_collapse)

        btn_refresh = QPushButton("Обновить")
        btn_refresh.clicked.connect(self.refresh_requested.emit)
        toolbar.addWidget(btn_refresh)

        layout.addLayout(toolbar)

        search_layout = QHBoxLayout()
        self.search_input = QLineEdit()
        self.search_input.setPlaceholderText("Быстрый поиск файлов по имени или расширению...")
        self.search_input.textChanged.connect(self.filter_tree)
        search_layout.addWidget(self.search_input)
        layout.addLayout(search_layout)

        self.tree_widget = QTreeWidget()
        self.tree_widget.setColumnCount(2)
        self.tree_widget.setHeaderLabels(["Файлы и каталоги", "Размер"])
        self.tree_widget.header().setSectionResizeMode(0, QHeaderView.ResizeMode.Stretch)
        self.tree_widget.itemChanged.connect(self._on_item_changed)
        
        self.tree_widget.itemExpanded.connect(self._on_item_expanded_collapsed)
        self.tree_widget.itemCollapsed.connect(self._on_item_expanded_collapsed)

        layout.addWidget(self.tree_widget)

    def get_icon_for_node(self, name: str, is_dir: bool, is_expanded: bool = False) -> QIcon:
        lower = name.lower()
        icon_name = "file"
        
        if is_dir:
            if lower in ('src', 'source', 'sources', 'code'):
                icon_name = "folder-src-open" if is_expanded else "folder-src"
            elif lower in ('node_modules', 'bower_components'):
                icon_name = "folder-node-open" if is_expanded else "folder-node"
            elif lower in ('.git', '.github', '.gitlab'):
                icon_name = "folder-git-open" if is_expanded else "folder-git"
            elif lower in ('dist', 'build', 'target', 'out', 'release', 'debug', 'bin', 'obj'):
                icon_name = "folder-target-open" if is_expanded else "folder-target"
            elif lower in ('docs', 'doc', 'site', 'website'):
                icon_name = "folder-docs-open" if is_expanded else "folder-docs"
            elif lower in ('test', 'tests', '__tests__', 'spec', 'specs'):
                icon_name = "folder-test-open" if is_expanded else "folder-test"
            elif lower in ('images', 'img', 'assets', 'static', 'public', 'resources', 'media'):
                icon_name = "folder-images-open" if is_expanded else "folder-images"
            elif lower in ('css', 'style', 'styles', 'scss', 'sass', 'less'):
                icon_name = "folder-css-open" if is_expanded else "folder-css"
            elif lower in ('config', 'configs', 'settings', '.vscode', '.idea', 'env', '.env'):
                icon_name = "folder-config-open" if is_expanded else "folder-config"
            elif lower in ('database', 'db', 'models', 'migrations', 'sql'):
                icon_name = "folder-database-open" if is_expanded else "folder-database"
            elif lower in ('components', 'widgets', 'ui', 'views', 'layouts'):
                icon_name = "folder-components-open" if is_expanded else "folder-components"
            elif lower in ('lib', 'libs', 'library', 'libraries', 'vendor', 'utils', 'helpers'):
                icon_name = "folder-lib-open" if is_expanded else "folder-lib"
            elif lower in ('api', 'apis', 'rest', 'controllers', 'routes', 'handlers'):
                icon_name = "folder-api-open" if is_expanded else "folder-api"
            elif lower in ('app', 'apps', 'application'):
                icon_name = "folder-app-open" if is_expanded else "folder-app"
            elif lower in ('scripts', 'tools', 'tasks'):
                icon_name = "folder-scripts-open" if is_expanded else "folder-scripts"
            elif lower in ('server', 'backend', 'service', 'services'):
                icon_name = "folder-server-open" if is_expanded else "folder-server"
            elif lower in ('client', 'frontend', 'web'):
                icon_name = "folder-client-open" if is_expanded else "folder-client"
            else:
                icon_name = "folder-open" if is_expanded else "folder"
        else:
            if lower == 'package.json':
                icon_name = "npm"
            elif lower == 'package-lock.json':
                icon_name = "lock"
            elif lower == 'yarn.lock':
                icon_name = "yarn"
            elif lower == 'pnpm-lock.yaml':
                icon_name = "pnpm"
            elif lower == 'cargo.toml':
                icon_name = "rust"
            elif lower == 'cargo.lock':
                icon_name = "lock"
            elif lower == 'angular.json':
                icon_name = "angular"
            elif lower == 'tsconfig.json':
                icon_name = "tsconfig"
            elif lower == 'jsconfig.json':
                icon_name = "tsconfig"
            elif lower in ('.eslintrc', '.eslintrc.json', '.eslintrc.js', '.eslintrc.yml', '.eslintrc.yaml'):
                icon_name = "eslint"
            elif lower in ('.prettierrc', '.prettierrc.json', '.prettierrc.js', '.prettierrc.yml', '.prettierrc.yaml'):
                icon_name = "prettier"
            elif lower in ('.babelrc', 'babel.config.js', 'babel.config.json'):
                icon_name = "babel"
            elif lower == 'tailwind.config.js' or lower == 'tailwind.config.ts':
                icon_name = "tailwindcss"
            elif lower == 'vite.config.js' or lower == 'vite.config.ts':
                icon_name = "vite"
            elif lower == 'webpack.config.js' or lower == 'webpack.config.ts':
                icon_name = "webpack"
            elif lower == 'nuxt.config.js' or lower == 'nuxt.config.ts':
                icon_name = "nuxt"
            elif lower == 'next.config.js' or lower == 'next.config.mjs' or lower == 'next.config.ts':
                icon_name = "next"
            elif lower == 'svelte.config.js':
                icon_name = "svelte"
            elif lower == 'makefile' or lower == 'make':
                icon_name = "makefile"
            elif lower == 'gltf' or lower == 'obj' or lower == 'fbx':
                icon_name = "3d"
            elif lower.startswith('tsconfig') or lower == '.editorconfig':
                icon_name = "settings"
            elif lower in ('.gitignore', '.gitattributes', '.gitmodules'):
                icon_name = "git"
            elif lower == 'dockerfile' or lower.startswith('docker-compose') or lower == '.dockerignore':
                icon_name = "docker"
            elif lower in ('requirements.txt', 'pipfile', 'pyproject.toml'):
                icon_name = "python"
            elif lower.startswith('readme') or lower == 'license' or lower == 'changelog':
                icon_name = "readme"
            elif lower == 'gemfile':
                icon_name = "gemfile"
            elif lower == 'composer.json' or lower == 'composer.lock':
                icon_name = "composer"
            elif lower == 'go.mod' or lower == 'go.sum':
                icon_name = "go"
            elif lower == 'jenkinsfile':
                icon_name = "jenkins"
            elif lower == 'procfile':
                icon_name = "heroku"
            elif lower == 'firebase.json':
                icon_name = "firebase"
            elif lower == 'vue.config.js' or lower == 'vue.config.ts':
                icon_name = "vue"
            else:
                ext = lower.split('.')[-1] if '.' in lower else ''
                if ext in ('ts', 'mts', 'cts'):
                    icon_name = "typescript"
                elif ext in ('js', 'mjs', 'cjs'):
                    icon_name = "javascript"
                elif ext == 'jsx':
                    icon_name = "react"
                elif ext == 'tsx':
                    icon_name = "react_ts"
                elif ext in ('py', 'ipynb', 'pyc', 'pyd'):
                    icon_name = "python"
                elif ext in ('rs', 'rlib', 'rmeta'):
                    icon_name = "rust"
                elif ext == 'json':
                    icon_name = "json"
                elif ext in ('md', 'markdown'):
                    icon_name = "markdown"
                elif ext in ('html', 'htm', 'xhtml'):
                    icon_name = "html"
                elif ext in ('scss', 'sass'):
                    icon_name = "sass"
                elif ext == 'css':
                    icon_name = "css"
                elif ext in ('sh', 'bash', 'zsh', 'bat', 'cmd', 'ps1'):
                    icon_name = "console"
                elif ext in ('cpp', 'cxx', 'cc', 'c', 'h', 'hpp', 'hxx'):
                    icon_name = "cpp"
                elif ext in ('java', 'class', 'jar'):
                    icon_name = "java"
                elif ext in ('kt', 'kts'):
                    icon_name = "kotlin"
                elif ext == 'go':
                    icon_name = "go"
                elif ext in ('png', 'jpg', 'jpeg', 'gif', 'svg', 'ico', 'webp', 'tiff', 'bmp', 'psd'):
                    icon_name = "image"
                elif ext in ('mp4', 'mov', 'avi', 'mkv', 'webm', 'flv'):
                    icon_name = "video"
                elif ext in ('mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a'):
                    icon_name = "audio"
                elif ext in ('zip', 'tar', 'gz', 'tgz', 'rar', '7z', 'dmg', 'iso'):
                    icon_name = "zip"
                elif ext in ('cs', 'csproj', 'sln'):
                    icon_name = "csharp"
                elif ext == 'swift':
                    icon_name = "swift"
                elif ext == 'dart':
                    icon_name = "dart"
                elif ext in ('rb', 'ru', 'gemspec'):
                    icon_name = "ruby"
                elif ext in ('tf', 'tfvars'):
                    icon_name = "terraform"
                elif ext in ('sql', 'sqlite', 'sqlite3', 'db', 'mdb'):
                    icon_name = "database"
                elif ext in ('yaml', 'yml'):
                    icon_name = "yaml"
                elif ext == 'toml':
                    icon_name = "toml"
                elif ext == 'xml':
                    icon_name = "xml"
                elif ext in ('ini', 'conf', 'cfg', 'properties'):
                    icon_name = "settings"
                elif ext == 'vue':
                    icon_name = "vue"
                elif ext == 'svelte':
                    icon_name = "svelte"
                elif ext == 'astro':
                    icon_name = "astro"
                elif ext == 'graphql' or ext == 'gql':
                    icon_name = "graphql"
                elif ext == 'pdf':
                    icon_name = "pdf"
                elif ext == 'csv':
                    icon_name = "table"
                elif ext == 'xlsx' or ext == 'xls':
                    icon_name = "excel"
                elif ext == 'docx' or ext == 'doc':
                    icon_name = "word"
                elif ext == 'pptx' or ext == 'ppt':
                    icon_name = "powerpoint"
                elif ext == 'gradle':
                    icon_name = "gradle"
                elif ext == 'sol':
                    icon_name = "solidity"
                elif ext == 'wasm':
                    icon_name = "wasm"
                elif ext == 'scala':
                    icon_name = "scala"
                elif ext == 'clj' or ext == 'cljs':
                    icon_name = "clojure"
                elif ext == 'el' or ext == 'elc':
                    icon_name = "emacs"
                elif ext == 'hs' or ext == 'lhs':
                    icon_name = "haskell"
                elif ext == 'ex' or ext == 'exs':
                    icon_name = "elixir"
                elif ext == 'erl' or ext == 'hrl':
                    icon_name = "erlang"
                elif ext == 'lua':
                    icon_name = "lua"
                elif ext == 'pl' or ext == 'pm':
                    icon_name = "perl"
                elif ext == 'php':
                    icon_name = "php"
                elif ext == 'r' or ext == 'rmd':
                    icon_name = "r"
                elif ext == 'zig':
                    icon_name = "zig"
                else:
                    icon_name = "file"
                    
        icon_path = get_resource_path(f"resources/icons/material/{icon_name}.svg")
        if os.path.exists(icon_path):
            return QIcon(icon_path)
            
        standard_pixmap = QStyle.StandardPixmap.SP_DirIcon if is_dir else QStyle.StandardPixmap.SP_FileIcon
        return self.style().standardIcon(standard_pixmap)

    def _on_item_expanded_collapsed(self, item):
        data = item.data(0, Qt.ItemDataRole.UserRole)
        if data and data.get('is_dir', False):
            name = item.text(0)
            is_expanded = item.isExpanded()
            icon = self.get_icon_for_node(name, True, is_expanded)
            item.setIcon(0, icon)

    def _on_item_changed(self, item, column):
        if column != 0:
            return
        self.tree_widget.blockSignals(True)
        state = item.checkState(0)
        self._update_children_state(item, state)
        self._update_parent_state(item)
        self.tree_widget.blockSignals(False)
        self.selection_changed.emit()

    def check_all_items(self, check=True):
        if self.tree_widget.topLevelItemCount() == 0:
            return
        self.tree_widget.blockSignals(True)
        root_item = self.tree_widget.topLevelItem(0)
        state = Qt.CheckState.Checked if check else Qt.CheckState.Unchecked
        root_item.setCheckState(0, state)
        self._update_children_state(root_item, state)
        self.tree_widget.blockSignals(False)
        self.selection_changed.emit()

    def _update_children_state(self, item, state):
        for i in range(item.childCount()):
            child = item.child(i)
            child.setCheckState(0, state)
            self._update_children_state(child, state)

    def _update_parent_state(self, item):
        parent = item.parent()
        if not parent:
            return

        checked_count = 0
        unchecked_count = 0
        child_count = parent.childCount()

        for i in range(child_count):
            st = parent.child(i).checkState(0)
            if st == Qt.CheckState.Checked:
                checked_count += 1
            elif st == Qt.CheckState.Unchecked:
                unchecked_count += 1

        if checked_count == child_count:
            parent.setCheckState(0, Qt.CheckState.Checked)
        elif unchecked_count == child_count:
            parent.setCheckState(0, Qt.CheckState.Unchecked)
        else:
            parent.setCheckState(0, Qt.CheckState.PartiallyChecked)

        self._update_parent_state(parent)

    def get_check_states(self) -> dict:
        states = {}
        if self.tree_widget.topLevelItemCount() == 0:
            return states
        root_item = self.tree_widget.topLevelItem(0)
        self._collect_states(root_item, states)
        return states

    def _collect_states(self, item, states: dict):
        data = item.data(0, Qt.ItemDataRole.UserRole)
        if data:
            rel_path = data.get('rel_path', '')
            states[rel_path] = item.checkState(0)
        for i in range(item.childCount()):
            self._collect_states(item.child(i), states)

    def get_selected_files_info(self, item=None) -> list:
        if item is None:
            if self.tree_widget.topLevelItemCount() == 0:
                return []
            item = self.tree_widget.topLevelItem(0)

        files = []
        state = item.checkState(0)

        if state == Qt.CheckState.Unchecked:
            return []

        data = item.data(0, Qt.ItemDataRole.UserRole)
        if data and not data.get('is_dir', False) and state == Qt.CheckState.Checked:
            files.append(data)

        for i in range(item.childCount()):
            files.extend(self.get_selected_files_info(item.child(i)))

        return files

    def get_current_focused_rel_path(self) -> str:
        current_item = self.tree_widget.currentItem()
        if not current_item:
            return ""
        data = current_item.data(0, Qt.ItemDataRole.UserRole)
        if data and not data.get('is_dir', False):
            return data.get('rel_path', '')
        return ""

    def populate_tree(self, root_node_dict: dict, saved_states: dict = None):
        self.tree_widget.blockSignals(True)
        self.tree_widget.clear()
        if not root_node_dict:
            self.tree_widget.blockSignals(False)
            return

        root_item = QTreeWidgetItem(self.tree_widget)
        root_name = root_node_dict.get('name', 'project')
        root_item.setText(0, root_name)
        root_item.setIcon(0, self.get_icon_for_node(root_name, True, True))

        root_state = Qt.CheckState.Checked
        if saved_states and root_node_dict.get('rel_path', '') in saved_states:
            root_state = saved_states[root_node_dict.get('rel_path', '')]
        root_item.setCheckState(0, root_state)

        root_item.setData(0, Qt.ItemDataRole.UserRole, {
            'full_path': root_node_dict.get('full_path', ''),
            'rel_path': root_node_dict.get('rel_path', ''),
            'is_dir': True,
            'size': 0
        })

        self._populate_ui_tree(root_item, root_node_dict.get('children', []), saved_states)
        root_item.setExpanded(True)
        self.tree_widget.blockSignals(False)

        if self.search_input.text().strip():
            self.filter_tree(self.search_input.text())

    def _populate_ui_tree(self, parent_item, children_list: list, saved_states: dict = None):
        if saved_states is None:
            saved_states = {}

        for child in children_list:
            item = QTreeWidgetItem(parent_item)
            name = child.get('name', '')
            item.setText(0, name)

            state = Qt.CheckState.Checked
            if child.get('rel_path', '') in saved_states:
                state = saved_states[child.get('rel_path', '')]
            item.setCheckState(0, state)

            is_dir = child.get('is_dir', False)
            if is_dir:
                item.setIcon(0, self.get_icon_for_node(name, True, False))
                self._populate_ui_tree(item, child.get('children', []), saved_states)
            else:
                size_bytes = child.get('size', 0)
                kb_size = round(size_bytes / 1024, 1)
                item.setText(1, f"{kb_size} KB")
                item.setIcon(0, self.get_icon_for_node(name, False, False))

            item.setData(0, Qt.ItemDataRole.UserRole, {
                'full_path': child.get('full_path', ''),
                'rel_path': child.get('rel_path', ''),
                'is_dir': is_dir,
                'size': child.get('size', 0)
            })

    def filter_tree(self, text: str):
        text = text.lower().strip()
        if self.tree_widget.topLevelItemCount() == 0:
            return

        self.tree_widget.blockSignals(True)
        root_item = self.tree_widget.topLevelItem(0)
        self._filter_item_recursive(root_item, text)
        self.tree_widget.blockSignals(False)

    def _filter_item_recursive(self, item, text: str) -> bool:
        item_text = item.text(0).lower()
        match_self = text in item_text

        any_child_visible = False
        for i in range(item.childCount()):
            if self._filter_item_recursive(item.child(i), text):
                any_child_visible = True

        is_visible = match_self or any_child_visible
        item.setHidden(not is_visible)

        if text and any_child_visible:
            item.setExpanded(True)

        return is_visible

    def select_specific_paths(self, target_paths: set):
        if not target_paths or self.tree_widget.topLevelItemCount() == 0:
            return

        self.tree_widget.blockSignals(True)
        root_item = self.tree_widget.topLevelItem(0)
        self._check_paths_recursive(root_item, target_paths)
        self.tree_widget.blockSignals(False)
        self.selection_changed.emit()

    def _check_paths_recursive(self, item, target_paths: set):
        data = item.data(0, Qt.ItemDataRole.UserRole)
        if data:
            rel_path = data.get('rel_path', '')
            is_dir = data.get('is_dir', False)

            if not is_dir and rel_path in target_paths:
                item.setCheckState(0, Qt.CheckState.Checked)
                self._update_parent_state(item)

        for i in range(item.childCount()):
            self._check_paths_recursive(item.child(i), target_paths)