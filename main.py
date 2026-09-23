import os
import sys
import argparse
import threading
import urllib.request
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

current_dir = os.path.dirname(os.path.abspath(__file__))
if current_dir not in sys.path:
    sys.path.insert(0, current_dir)

from backend.router import api_router

app = FastAPI(title="CodeContext Core API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)

base_dir = os.path.dirname(os.path.abspath(__file__))
dist_candidates = [
    os.path.join(base_dir, "frontend", "dist", "codecontext-web", "browser"),
    os.path.join(base_dir, "frontend", "dist", "browser"),
    os.path.join(base_dir, "frontend", "dist"),
    os.path.join(base_dir, "dist", "browser"),
    os.path.join(base_dir, "dist"),
]

static_dir = next((d for d in dist_candidates if os.path.exists(d)), None)
if static_dir:
    app.mount("/", StaticFiles(directory=static_dir, html=True), name="static")


def is_dev_server_running(url="http://127.0.0.1:4200"):
    try:
        urllib.request.urlopen(url, timeout=0.5)
        return True
    except Exception:
        return False


def run_server(host: str, port: int):
    uvicorn.run(app, host=host, port=port, log_level="warning")


def main():
    parser = argparse.ArgumentParser(description="CodeContext Desktop & Web Engine")
    parser.add_argument("--server-only", "-s", action="store_true", help="Run HTTP server only without desktop window")
    parser.add_argument("--host", default="127.0.0.1", help="Server host")
    parser.add_argument("--port", type=int, default=8000, help="Server port")
    args = parser.parse_args()

    if args.server_only:
        run_server(args.host, args.port)
        return

    try:
        import webview
    except ImportError:
        run_server(args.host, args.port)
        return

    server_thread = threading.Thread(
        target=run_server,
        args=(args.host, args.port),
        daemon=True
    )
    server_thread.start()

    target_url = f"http://{args.host}:{args.port}"
    if static_dir is None and is_dev_server_running("http://127.0.0.1:4200"):
        target_url = "http://127.0.0.1:4200"

    window = webview.create_window(
        title="CodeContext",
        url=target_url,
        width=1400,
        height=850,
        min_size=(1000, 650)
    )
    webview.start()


if __name__ == "__main__":
    main()