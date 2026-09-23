import os
import sys
import shutil
import subprocess


def run_cmd(cmd, cwd=None, env=None):
    shell = sys.platform == 'win32'
    res = subprocess.run(cmd, cwd=cwd, env=env, shell=shell)
    if res.returncode != 0:
        print(f'Error executing: {" ".join(cmd) if isinstance(cmd, list) else cmd}')
        sys.exit(1)


def build():
    root_dir = os.path.dirname(os.path.abspath(__file__))
    core_dir = os.path.join(root_dir, 'codecontext_core')
    backend_dir = os.path.join(root_dir, 'backend')
    frontend_dir = os.path.join(root_dir, 'frontend')
    dist_path = os.path.join(root_dir, 'dist')
    build_path = os.path.join(root_dir, 'build')
    resources_src = os.path.join(root_dir, 'resources')
    icon_ico = os.path.join(resources_src, 'icons', 'icon.ico')
    icon_png = os.path.join(resources_src, 'icons', 'icon.png')
    main_entry = os.path.join(root_dir, 'main.py')

    print('--- 1. Compiling Native Rust Core (PyO3) ---')
    env = os.environ.copy()
    if sys.platform == 'darwin':
        env['RUSTFLAGS'] = '-C link-arg=-undefined -C link-arg=dynamic_lookup'

    run_cmd(['cargo', 'build', '--release', '--features', 'python'], cwd=core_dir, env=env)

    target_release_dir = os.path.join(core_dir, 'target', 'release')
    if sys.platform == 'win32':
        built_lib = os.path.join(target_release_dir, 'codecontext_core.dll')
        dest_lib = os.path.join(backend_dir, 'codecontext_core.pyd')
    elif sys.platform == 'darwin':
        built_lib = os.path.join(target_release_dir, 'libcodecontext_core.dylib')
        dest_lib = os.path.join(backend_dir, 'codecontext_core.so')
    else:
        built_lib = os.path.join(target_release_dir, 'libcodecontext_core.so')
        dest_lib = os.path.join(backend_dir, 'codecontext_core.so')

    if os.path.exists(built_lib):
        shutil.copy2(built_lib, dest_lib)
        print(f'Installed native Rust binary: {dest_lib}')
    else:
        print(f'Error: Compiled Rust library not found at {built_lib}')
        sys.exit(1)

    print('\n--- 2. Building WebAssembly Core & Angular Frontend ---')
    if os.path.exists(frontend_dir):
        if not os.path.exists(os.path.join(frontend_dir, 'node_modules')):
            print('Installing frontend npm dependencies...')
            run_cmd(['npm', 'install'], cwd=frontend_dir)

        print('Compiling WASM pkg...')
        run_cmd(['wasm-pack', 'build', '--target', 'web', '--out-dir', 'pkg', '--', '--features', 'wasm'], cwd=core_dir)
        pkg_gitignore = os.path.join(core_dir, 'pkg', '.gitignore')
        if os.path.exists(pkg_gitignore):
            os.remove(pkg_gitignore)

        print('Building Angular SPA distribution...')
        run_cmd(['npm', 'run', 'build'], cwd=frontend_dir)

    print('\n--- 3. Packaging Desktop Binary with PyInstaller ---')
    try:
        import PyInstaller
    except ImportError:
        print('Installing PyInstaller...')
        run_cmd([sys.executable, '-m', 'pip', 'install', 'pyinstaller'])

    add_data_sep = ';' if sys.platform == 'win32' else ':'
    pyinstaller_args = [
        main_entry,
        '--onefile',
        '--noconsole',
        '--name=CodeContext',
        f'--distpath={dist_path}',
        f'--workpath={build_path}',
        f'--paths={root_dir}',
        f'--paths={backend_dir}',
        '--clean',
    ]

    if os.path.exists(resources_src):
        pyinstaller_args.append(f'--add-data={resources_src}{add_data_sep}resources')

    frontend_dist_browser = os.path.join(frontend_dir, 'dist', 'codecontext-web', 'browser')
    if not os.path.exists(frontend_dist_browser):
        frontend_dist_browser = os.path.join(frontend_dir, 'dist', 'codecontext-frontend', 'browser')
    if not os.path.exists(frontend_dist_browser):
        frontend_dist_browser = os.path.join(frontend_dir, 'dist')

    if os.path.exists(frontend_dist_browser):
        pyinstaller_args.append(f'--add-data={frontend_dist_browser}{add_data_sep}frontend/dist/codecontext-web/browser')

    if sys.platform == 'win32':
        sys32_dir = os.path.join(os.environ.get('SystemRoot', 'C:\\Windows'), 'System32')
        for dll_name in ['vcruntime140.dll', 'vcruntime140_1.dll']:
            dll_path = os.path.join(sys32_dir, dll_name)
            if os.path.exists(dll_path):
                pyinstaller_args.append(f'--add-binary={dll_path};.')

        if os.path.exists(icon_ico):
            pyinstaller_args.append(f'--icon={icon_ico}')
        elif os.path.exists(icon_png):
            pyinstaller_args.append(f'--icon={icon_png}')
    elif sys.platform == 'darwin':
        if os.path.exists(icon_png):
            pyinstaller_args.append(f'--icon={icon_png}')

    import PyInstaller.__main__
    PyInstaller.__main__.run(pyinstaller_args)

    print('\n--- Build process completed successfully! Binary available in dist/ ---')


if __name__ == '__main__':
    build()