import os
import re
from typing import Set


class DependencyService:
    PYTHON_IMPORT_REGEX = re.compile(r'^\s*import\s+([a-zA-Z0-9_.,\s]+)', re.MULTILINE)
    PYTHON_FROM_REGEX = re.compile(r'^\s*from\s+(\.?\.?[a-zA-Z0-9_.]+)\s+import\s+([a-zA-Z0-9_.,\s()]+)', re.MULTILINE)

    JS_TS_ES6_REGEX = re.compile(r'\bimport\s+[^"\']*?\s+from\s+["\'](\..*?)["\']', re.DOTALL)
    JS_TS_DYNAMIC_REGEX = re.compile(r'\bimport\(\s*["\'](\..*?)["\']\s*\)')
    JS_TS_REQUIRE_REGEX = re.compile(r'\brequire\(\s*["\'](\..*?)["\']\s*\)')

    CPP_INCLUDE_REGEX = re.compile(r'^\s*#include\s+["\']([^"\']+)["\']', re.MULTILINE)

    RUST_MOD_REGEX = re.compile(r'^\s*(?:pub\s+)?mod\s+([a-zA-Z0-9_]+);', re.MULTILINE)
    RUST_USE_REGEX = re.compile(r'^\s*(?:pub\s+)?use\s+(crate|super|self)::([a-zA-Z0-9_:]+)', re.MULTILINE)

    def trace_dependencies(self, root_dir: str, target_rel_path: str) -> Set[str]:
        if not root_dir or not target_rel_path:
            return set()

        full_target_path = os.path.join(root_dir, target_rel_path)
        if not os.path.exists(full_target_path) or os.path.isdir(full_target_path):
            return set()

        try:
            with open(full_target_path, 'r', encoding='utf-8', errors='replace') as f:
                content = f.read()
        except Exception:
            return set()

        _, ext = os.path.splitext(target_rel_path)
        ext = ext.lower()
        found_rel_paths = set()
        target_dir = os.path.dirname(full_target_path)

        def check_and_add(path: str) -> bool:
            if os.path.isfile(path):
                rel = os.path.relpath(path, root_dir).replace('\\', '/')
                found_rel_paths.add(rel)
                return True
            return False

        if ext == '.py':
            targets = []

            for m in self.PYTHON_IMPORT_REGEX.finditer(content):
                for part in m.group(1).split(','):
                    clean = part.strip()
                    if clean:
                        targets.append(("", clean))

            for m in self.PYTHON_FROM_REGEX.finditer(content):
                base = m.group(1)
                clean_imports = m.group(2).replace('(', '').replace(')', '').replace('\n', ' ').replace('\r', ' ')
                for part in clean_imports.split(','):
                    clean_item = part.strip()
                    if clean_item:
                        targets.append((base, clean_item))

            for base, item in targets:
                has_base = bool(base)
                full_import_path = f"{base}.{item}" if has_base else item
                dot_count = len(base) - len(base.lstrip('.')) if has_base else len(item) - len(item.lstrip('.'))

                clean_import_path = full_import_path.lstrip('.')
                subpath = clean_import_path.replace('.', '/')

                if dot_count > 0:
                    temp_base = target_dir
                    for _ in range(dot_count - 1):
                        temp_base = os.path.dirname(temp_base)
                    search_bases = [temp_base]
                else:
                    search_bases = [
                        root_dir,
                        os.path.join(root_dir, 'src'),
                        target_dir
                    ]

                for base_dir in search_bases:
                    if subpath:
                        cand1 = os.path.join(base_dir, f"{subpath}.py")
                        cand2 = os.path.join(base_dir, subpath, "__init__.py")
                        if check_and_add(cand1) or check_and_add(cand2):
                            break
                    if has_base:
                        base_subpath = base.lstrip('.').replace('.', '/')
                        if base_subpath:
                            cand1 = os.path.join(base_dir, f"{base_subpath}.py")
                            cand2 = os.path.join(base_dir, base_subpath, "__init__.py")
                            if check_and_add(cand1) or check_and_add(cand2):
                                break

        elif ext in ('.js', '.jsx', '.ts', '.tsx'):
            imports = []
            for m in self.JS_TS_ES6_REGEX.finditer(content):
                imports.append(m.group(1))
            for m in self.JS_TS_DYNAMIC_REGEX.finditer(content):
                imports.append(m.group(1))
            for m in self.JS_TS_REQUIRE_REGEX.finditer(content):
                imports.append(m.group(1))

            for rel_import in imports:
                abs_base = os.path.normpath(os.path.join(target_dir, rel_import))
                possible_exts = ['', '.js', '.ts', '.jsx', '.tsx', '/index.js', '/index.ts']

                for p_ext in possible_exts:
                    test_path = abs_base + p_ext
                    if check_and_add(test_path):
                        break

        elif ext in ('.c', '.cpp', '.h', '.hpp'):
            for m in self.CPP_INCLUDE_REGEX.finditer(content):
                header = m.group(1)
                test_path_1 = os.path.join(target_dir, header)
                test_path_2 = os.path.join(root_dir, header)

                if not check_and_add(test_path_1):
                    check_and_add(test_path_2)

        elif ext == '.rs':
            for m in self.RUST_MOD_REGEX.finditer(content):
                mod_name = m.group(1)
                cand1 = os.path.join(target_dir, f"{mod_name}.rs")
                cand2 = os.path.join(target_dir, mod_name, "mod.rs")

                if not check_and_add(cand1):
                    check_and_add(cand2)

            for m in self.RUST_USE_REGEX.finditer(content):
                base_type = m.group(1)
                subpath = m.group(2).replace('::', '/')

                if base_type == 'crate':
                    src_dir = os.path.join(root_dir, 'src')
                    base_dir = src_dir if os.path.isdir(src_dir) else root_dir
                elif base_type == 'super':
                    base_dir = os.path.dirname(target_dir) if target_dir != root_dir else target_dir
                else:
                    base_dir = target_dir

                cand1 = os.path.join(base_dir, f"{subpath}.rs")
                cand2 = os.path.join(base_dir, subpath, "mod.rs")
                cand3 = os.path.join(base_dir, f"{subpath}/mod.rs")

                if not check_and_add(cand1) and not check_and_add(cand2):
                    check_and_add(cand3)

        return found_rel_paths