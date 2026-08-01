import json

try:
    import codecontext_core
except ImportError:
    codecontext_core = None

class RustCoreService:
    @staticmethod
    def is_available() -> bool:
        return codecontext_core is not None

    @staticmethod
    def scan_directory(root_dir: str, options: dict) -> dict:
        if not codecontext_core:
            return {}
        options_json = json.dumps(options)
        result_json = codecontext_core.scan_directory_py(root_dir, options_json)
        if not result_json or result_json == "null":
            return {}
        return json.loads(result_json)

    @staticmethod
    def count_tokens(text: str) -> int:
        if not codecontext_core:
            return 0
        return codecontext_core.count_tokens_py(text)

    @staticmethod
    def sanitize_secrets(text: str) -> str:
        if not codecontext_core:
            return text
        return codecontext_core.sanitize_secrets_py(text)

    @staticmethod
    def strip_comments(text: str, extension: str) -> str:
        if not codecontext_core:
            return text
        return codecontext_core.strip_comments_py(text, extension)

    @staticmethod
    def compress_whitespace(text: str) -> str:
        if not codecontext_core:
            return text
        return codecontext_core.compress_whitespace_py(text)

    @staticmethod
    def trace_dependencies(root_dir: str, target_rel_path: str, content: str) -> set:
        if not codecontext_core:
            return set()
        deps = codecontext_core.trace_dependencies_py(root_dir, target_rel_path, content)
        return set(deps)

    @staticmethod
    def build_payload(
        root_name: str,
        root_node: dict,
        files: list,
        selected_paths: set,
        options: dict
    ) -> str:
        if not codecontext_core:
            return ""

        root_node_json = json.dumps(root_node) if root_node else ""
        files_json = json.dumps(files)
        selected_paths_json = json.dumps(list(selected_paths))
        options_json = json.dumps(options)

        return codecontext_core.build_payload_py(
            root_name,
            root_node_json,
            files_json,
            selected_paths_json,
            options_json
        )