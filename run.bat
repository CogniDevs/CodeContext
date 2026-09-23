@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion
cd /d "%~dp0"

echo ===================================================
echo             CodeContext Desktop Launcher
echo ===================================================

if not exist "venv\Scripts\python.exe" (
    echo [*] Создание виртуального окружения Python...
    py -3.11 -m venv venv 2>nul || py -3.12 -m venv venv 2>nul || python -m venv venv
    call venv\Scripts\activate.bat
    python -m pip install --upgrade pip
    pip install -r requirements.txt
) else (
    call venv\Scripts\activate.bat
)

if not exist "backend\codecontext_core.pyd" (
    echo [*] Сборка нативного C-ABI ядра Rust...
    cd codecontext_core
    cargo build --release --features python
    if exist "target\release\codecontext_core.dll" (
        copy /y "target\release\codecontext_core.dll" "..\backend\codecontext_core.pyd" >nul
    )
    cd ..
)

if not exist "frontend\node_modules" (
    echo [*] Установка npm зависимостей фронтенда...
    cd frontend
    call npm install
    cd ..
)

set "DO_REBUILD=0"
if not exist "frontend\dist\codecontext-web\browser\index.html" (
    set "DO_REBUILD=1"
) else (
    echo.
    echo Выберите вариант запуска:
    echo   [1] Запустить приложение (без пересборки)
    echo   [2] Пересобрать Frontend (WASM + Angular) и запустить
    echo   [3] Полная пересборка (Rust + WASM + Angular) и запустить
    echo.
    set "CHOICE=1"
    set /p "CHOICE=Ваш выбор (по умолчанию [1]): "

    if "!CHOICE!"=="2" (
        set "DO_REBUILD=1"
    )
    if "!CHOICE!"=="3" (
        echo [*] Пересборка нативного Rust ядра...
        cd codecontext_core
        cargo build --release --features python
        if exist "target\release\codecontext_core.dll" (
            copy /y "target\release\codecontext_core.dll" "..\backend\codecontext_core.pyd" >nul
        )
        cd ..
        set "DO_REBUILD=1"
    )
)

if "!DO_REBUILD!"=="1" (
    echo [*] Сборка WebAssembly и Angular SPA...
    cd frontend
    call npm run build
    cd ..
)

echo.
echo [*] Запуск приложения CodeContext...
python main.py

if errorlevel 1 (
    echo.
    echo [!] Ошибка запуска приложения.
    pause
)