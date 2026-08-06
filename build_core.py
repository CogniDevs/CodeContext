import os
import sys
import shutil
import subprocess

def main():
    root_dir = os.path.dirname(os.path.abspath(__file__))
    core_dir = os.path.join(root_dir, "codecontext_core")
    desktop_src_dir = os.path.join(root_dir, "desktop", "src")

    print("--- Compiling Rust core (codecontext_core) ---")
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
        print(f"Success: Copied compiled Rust library to {dest_lib}")
    else:
        print(f"Error: Compiled Rust library not found at {built_lib}")
        sys.exit(1)

if __name__ == "__main__":
    main()