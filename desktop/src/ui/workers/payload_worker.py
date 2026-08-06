import os
import json
import ast
from PyQt6.QtCore import QThread, pyqtSignal
from core.rust_core_service import RustCoreService
from core.git_service import GitService


def skeletonize_python_ast(content: str) -> str:
    class FunctionBodyReplacer(ast.NodeTransformer):
        def visit_FunctionDef(self, node: ast.FunctionDef) -> ast.FunctionDef:
            self.generic_visit(node)
            docstring = ast.get_docstring(node)
            new_body = []
            if docstring:
                new_body.append(ast.Expr(value=ast.Constant(value=docstring)))
            new_body.append(ast.Expr(value=ast.Constant(value=Ellipsis)))
            node.body = new_body
            return node

        def visit_AsyncFunctionDef(self, node: ast.AsyncFunctionDef) -> ast.AsyncFunctionDef:
            self.generic_visit(node)
            docstring = ast.get_docstring(node)
            new_body = []
            if docstring:
                new_body.append(ast.Expr(value=ast.Constant(value=docstring)))
            new_body.append(ast.Expr(value=ast.Constant(value=Ellipsis)))
            node.body = new_body
            return node

    try:
        tree = ast.parse(content)
        transformed_tree = FunctionBodyReplacer().visit(tree)
        ast.fix_missing_locations(transformed_tree)
        return ast.unparse(transformed_tree)
    except Exception:
        return content


class PayloadWorker(QThread):
    finished = pyqtSignal(str, int)
    error = pyqtSignal(str)

    def __init__(
            self,
            root_dir: str,
            root_node: dict,
            selected_files: list,
            selected_paths: set,
            system_prompt: str,
            xml_format: bool,
            always_send_full_tree: bool,
            strip_comments: bool,
            compress_whitespace: bool,
            sanitize_secrets: bool,
            skeleton_mode: bool = False,
            comment_rules: dict = None,
            git_diff_mode: bool = False,
            git_diff_context_lines: int = 3
    ):
        super().__init__()
        self.root_dir = root_dir
        self.root_node = root_node
        self.selected_files = selected_files
        self.selected_paths = selected_paths
        self.system_prompt = system_prompt
        self.xml_format = xml_format
        self.always_send_full_tree = always_send_full_tree
        self.strip_comments = strip_comments
        self.compress_whitespace = compress_whitespace
        self.sanitize_secrets = sanitize_secrets
        self.skeleton_mode = skeleton_mode
        self.comment_rules = comment_rules
        self.git_diff_mode = git_diff_mode
        self.git_diff_context_lines = git_diff_context_lines

    def run(self):
        try:
            files_payload = []
            if not self.git_diff_mode:
                for file_info in self.selected_files:
                    rel_path = file_info.get("rel_path", "")
                    full_path = file_info.get("full_path", "")

                    if not full_path or not os.path.exists(full_path):
                        continue

                    try:
                        with open(full_path, "r", encoding="utf-8", errors="replace") as f:
                            content = f.read()

                        if self.skeleton_mode and rel_path.lower().endswith('.py'):
                            content = skeletonize_python_ast(content)

                        files_payload.append((rel_path, content))
                    except Exception as e:
                        files_payload.append((rel_path, f"[Ошибка чтения файла: {e}]"))

            git_diff_text = None
            if self.git_diff_mode and self.root_dir:
                success, diff_res = GitService.get_git_diff(self.root_dir, self.git_diff_context_lines)
                if success:
                    git_diff_text = diff_res

            comment_rules_json = None
            if self.comment_rules:
                comment_rules_json = json.dumps(self.comment_rules)

            options = {
                "strip_comments": self.strip_comments,
                "compress_whitespace": self.compress_whitespace,
                "sanitize_secrets": self.sanitize_secrets,
                "skeleton_mode": self.skeleton_mode,
                "xml_format": self.xml_format,
                "always_send_full_tree": self.always_send_full_tree,
                "system_prompt": self.system_prompt,
                "comment_rules_json": comment_rules_json,
                "max_token_budget": getattr(self, "max_token_budget", None),
                "git_diff_mode": self.git_diff_mode,
                "git_diff_context_lines": self.git_diff_context_lines,
                "git_diff_text": git_diff_text
            }

            root_name = os.path.basename(self.root_dir) if self.root_dir else "project"

            payload = RustCoreService.build_payload(
                root_name,
                self.root_node,
                files_payload,
                self.selected_paths,
                options
            )

            token_count = RustCoreService.count_tokens(payload)
            self.finished.emit(payload, token_count)
        except Exception as e:
            self.error.emit(str(e))