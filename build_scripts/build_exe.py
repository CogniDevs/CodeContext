import os
import sys
import shutil
import subprocess


def build():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    root_dir = os.path.dirname(script_dir)

    core_dir = os.path.join(root_dir, "codecontext_core")
    desktop_src_dir = os.path.join(root_dir, "desktop", "src")
    entry_point = os.path.join(root_dir, "desktop", "main.py")
    dist_path = os.path.join(root_dir, "dist")
    build_path = os.path.join(root_dir, "build")
    resources_src = os.path.join(root_dir, "resources")
    icon_png = os.path.join(resources_src, "icons", "icon.png")

    print("--- 1. Compiling Rust core (codecontext_core) ---")
    env = os.environ.copy()
    if sys.platform == "darwin":
        env["RUSTFLAGS"] = "-C link-arg=-undefined -C link-arg=dynamic_lookup"

    res = subprocess.run(
        ["cargo", "build", "--release", "--features", "python"],
        cwd=core_dir,
        env=env,
        shell=(sys.platform == "win32")
    )
    if res.returncode != 0:
        print("Error: Cargo build failed!")
        sys.exit(1)

    target_release_dir = os.path.join(core_dir, "target", "release")
    if sys.platform == "win32":
        built_lib = os.path.join(target_release_dir, "codecontext_core.dll")
        dest_lib = os.path.join(desktop_src_dir, "codecontext_core.pyd")
    elif sys.platform == "darwin":
        built_lib = os.path.join(target_release_dir, "libcodecontext_core.dylib")
        dest_lib = os.path.join(desktop_src_dir, "codecontext_core.so")
    else:
        built_lib = os.path.join(target_release_dir, "libcodecontext_core.so")
        dest_lib = os.path.join(desktop_src_dir, "codecontext_core.so")

    if os.path.exists(built_lib):
        shutil.copy2(built_lib, dest_lib)
        print(f"Config: Copied compiled Rust library to {dest_lib}")
    else:
        print(f"Error: Compiled Rust library not found at {built_lib}")
        sys.exit(1)

    try:
        import PyInstaller
    except ImportError:
        print("Error: PyInstaller package is required. Install via: pip install pyinstaller")
        sys.exit(1)

    print("\n--- 2. Building PyInstaller executable ---")

    add_data_sep = ";" if sys.platform == "win32" else ":"
    args = [
        entry_point,
        "--onefile",
        "--noconsole",
        "--name=CodeContext",
        f"--distpath={dist_path}",
        f"--workpath={build_path}",
        f"--paths={desktop_src_dir}",
        "--clean",
    ]

    if os.path.exists(resources_src):
        args.append(f"--add-data={resources_src}{add_data_sep}resources")
        print("Config: Found resources directory. Bundling asset folder.")

    if sys.platform == "win32":
        sys32_dir = os.path.join(os.environ.get("SystemRoot", "C:\\Windows"), "System32")
        for dll_name in ["vcruntime140.dll", "vcruntime140_1.dll"]:
            dll_path = os.path.join(sys32_dir, dll_name)
            if os.path.exists(dll_path):
                args.append(f"--add-binary={dll_path};.")

    if os.path.exists(icon_png):
        args.append(f"--icon={icon_png}")

    import PyInstaller.__main__
    PyInstaller.__main__.run(args)

    print("\n--- Build finished successfully! ---")


if __name__ == "__main__":
    build()