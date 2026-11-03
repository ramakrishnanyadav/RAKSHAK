#!/usr/bin/env python3
"""
One-Command Demo Bundle for ADAPTIVE-PATH Platform.
Enables offline demonstration with zero external network connectivity.
Key actions:
1. Enforces zero-licence emulation (MOCK_MATLAB=1, ENGINE_STRICT_LICENCE=0).
2. Applies database migrations and seeds 14 verified multi-planner runs.
3. Launches backend API service and static Studio frontend.
4. Opens default browser to the Judge Fast-Track Demo flow (http://localhost:5173/demo).
"""

import os
import sys
import time
import shutil
import subprocess
import webbrowser
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT))

# Enforce Offline & Safe Demo Environment Variables
os.environ["MOCK_MATLAB"] = "1"
os.environ["ENGINE_STRICT_LICENCE"] = "0"
os.environ["APATH_ENVIRONMENT"] = "development"
os.environ["APATH_DATABASE_URL"] = "sqlite:///./adaptive_path.db"
os.environ["APATH_STORAGE_DIR"] = str(REPO_ROOT / "storage")
os.environ["APATH_JWT_SECRET"] = "demo-day-secret-sih2026-offline-presentation"
os.environ["APATH_CSRF_SECRET"] = "demo-day-csrf-secret-sih2026-offline"
os.environ["APATH_CORS_ORIGINS"] = '["http://localhost:5173","http://localhost:3000","http://127.0.0.1:5173"]'


def print_banner():
    print("""
========================================================================
     ADAPTIVE-PATH STUDIO — ONE-COMMAND OFFLINE DEMO BUNDLE
          Smart India Hackathon 2026 • SIH26037 • MathWorks
========================================================================
[*] Pre-warmed offline environment configured.
[*] MATLAB Zero-Licence Emulation: ACTIVE.
[*] External network dependency: NONE (100% Localhost).
========================================================================
""")


def verify_sample_runs():
    print("[*] Step 1/4: Verifying pre-bundled sample runs...")
    sample_runs_dir = REPO_ROOT / "storage" / "sample_runs"
    studio_public_dir = REPO_ROOT / "studio" / "public" / "sample_runs"

    if not sample_runs_dir.exists():
        print("[!] Generating sample runs from pilot simulation suite...")
        subprocess.run([sys.executable, str(REPO_ROOT / "scripts" / "generate_sample_runs.py")], check=True)

    # Sync sample runs into studio public directory for direct browser offline playback
    studio_public_dir.mkdir(parents=True, exist_ok=True)
    for f in sample_runs_dir.glob("*.json"):
        shutil.copy2(f, studio_public_dir / f.name)
    print(f"[+] Verified {len(list(studio_public_dir.glob('*.json')))} sample runs ready for instant replay.")


def run_database_migrations_and_seed():
    print("[*] Step 2/4: Applying database schema migrations & seeding shipped runs...")
    # Run Alembic migrations
    try:
        subprocess.run(
            [sys.executable, "-m", "alembic", "-c", "backend/alembic.ini", "upgrade", "head"],
            cwd=str(REPO_ROOT),
            check=True,
        )
    except Exception as e:
        print(f"[!] Migration notice: {e}")

    # Seed sample runs into DB
    subprocess.run([sys.executable, "-m", "backend.app.seed"], cwd=str(REPO_ROOT), check=True)
    print("[+] Database initialized and seeded successfully.")


def launch_services():
    print("[*] Step 3/4: Starting Backend API & Frontend Studio processes...")
    processes = []

    # 1. Start Backend API
    api_cmd = [
        sys.executable,
        "-m",
        "uvicorn",
        "backend.app.main:app",
        "--host",
        "127.0.0.1",
        "--port",
        "8000",
        "--log-level",
        "warning",
    ]
    api_proc = subprocess.Popen(api_cmd, cwd=str(REPO_ROOT))
    processes.append(api_proc)

    # 2. Check if Studio dist exists, otherwise use dev server
    studio_dir = REPO_ROOT / "studio"
    studio_dist = studio_dir / "dist"

    if studio_dist.exists():
        print("[*] Launching pre-built Studio SPA bundle on http://localhost:5173...")
        spa_server = str(REPO_ROOT / "scripts" / "serve_studio_spa.py")
        web_cmd = [sys.executable, spa_server]
        web_proc = subprocess.Popen(web_cmd)
        processes.append(web_proc)
    else:
        print("[*] Launching Studio Vite dev server on http://localhost:5173...")
        npm_cmd = "npm.cmd" if sys.platform == "win32" else "npm"
        web_proc = subprocess.Popen([npm_cmd, "run", "dev", "--", "--port", "5173", "--host"], cwd=str(studio_dir))
        processes.append(web_proc)

    print("[+] Services launched successfully.")
    print("    - Web Studio: http://localhost:5173/demo")
    print("    - Backend API: http://localhost:8000/docs")
    print("    - Liveness Probe: http://localhost:8000/api/health")

    # Step 4: Open Browser
    print("[*] Step 4/4: Opening browser to Demo Guest Mode...")
    time.sleep(2.0)
    webbrowser.open("http://localhost:5173/demo")

    print("\n[READY] Press Ctrl+C in this terminal to shut down all demo services.\n")
    try:
        while True:
            time.sleep(1.0)
    except KeyboardInterrupt:
        print("\n[*] Gracefully stopping demo services...")
        for p in processes:
            p.terminate()
            p.wait()
        print("[+] All services stopped cleanly. Demo session complete.")


def main():
    print_banner()
    verify_sample_runs()
    run_database_migrations_and_seed()
    launch_services()


if __name__ == "__main__":
    main()
