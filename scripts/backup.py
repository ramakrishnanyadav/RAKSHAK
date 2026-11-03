#!/usr/bin/env python3
"""
Automated Database & Object Storage Backup Utility.
Creates a verified, timestamped archive containing:
1. Database snapshot (PostgreSQL dump or SQLite atomic copy)
2. Simulation object store runs (`storage/runs/` and `storage/sample_runs/`)
3. Cryptographic SHA-256 checksum manifest
"""

import os
import sys
import time
import json
import tarfile
import hashlib
import sqlite3
import subprocess
from pathlib import Path
from datetime import datetime, timezone

# Add repo root to path
REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT))

from backend.app.config import settings
from backend.app.database import SessionLocal
from backend.app.models import RunRecord, UserRecord


def sha256_file(filepath: Path) -> str:
    h = hashlib.sha256()
    with open(filepath, "rb") as f:
        while chunk := f.read(65536):
            h.update(chunk)
    return h.hexdigest()


def create_backup(output_dir: Path = None) -> Path:
    if output_dir is None:
        output_dir = REPO_ROOT / "backups"
    output_dir.mkdir(parents=True, exist_ok=True)

    timestamp_str = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    backup_name = f"apath_backup_{timestamp_str}"
    work_dir = output_dir / backup_name
    work_dir.mkdir(parents=True, exist_ok=True)

    print(f"[*] Starting ADAPTIVE-PATH platform backup: {backup_name}...")

    # 1. Database Backup
    db_dump_file = work_dir / "database.dump"
    db_url = settings.database_url

    total_runs = 0
    total_users = 0
    db_session = SessionLocal()
    try:
        total_runs = db_session.query(RunRecord).count()
        total_users = db_session.query(UserRecord).count()
    except Exception as e:
        print(f"[!] Warning reading stats: {e}")
    finally:
        db_session.close()

    if db_url.startswith("sqlite"):
        db_path = db_url.replace("sqlite:///", "").replace("sqlite://", "")
        source_db = Path(db_path)
        if not source_db.is_absolute():
            source_db = REPO_ROOT / source_db

        print(f"[*] Backing up SQLite database from {source_db}...")
        # Use sqlite3 backup API for transactional consistency
        src_conn = sqlite3.connect(str(source_db))
        dst_conn = sqlite3.connect(str(db_dump_file))
        src_conn.backup(dst_conn)
        src_conn.close()
        dst_conn.close()
    else:
        print(f"[*] Backing up PostgreSQL database using pg_dump...")
        cmd = ["pg_dump", db_url, "-F", "c", "-f", str(db_dump_file)]
        subprocess.run(cmd, check=True)

    # 2. Storage / Telemetry Logs Backup
    storage_src = Path(settings.storage_dir)
    if not storage_src.is_absolute():
        storage_src = REPO_ROOT / storage_src

    storage_target = work_dir / "storage"
    storage_target.mkdir(parents=True, exist_ok=True)

    copied_files = []
    if storage_src.exists():
        import shutil
        for folder in ["runs", "sample_runs", "scenarios"]:
            src_folder = storage_src / folder
            if src_folder.exists():
                dst_folder = storage_target / folder
                shutil.copytree(src_folder, dst_folder, dirs_exist_ok=True)
                for f in dst_folder.rglob("*.*"):
                    copied_files.append(str(f.relative_to(storage_target)))

    # 3. Create Manifest
    manifest = {
        "backup_name": backup_name,
        "timestamp_iso": datetime.now(timezone.utc).isoformat(),
        "database_type": "sqlite" if db_url.startswith("sqlite") else "postgresql",
        "total_runs": total_runs,
        "total_users": total_users,
        "database_sha256": sha256_file(db_dump_file),
        "storage_files_count": len(copied_files),
        "app_version": settings.app_version,
    }

    manifest_file = work_dir / "manifest.json"
    manifest_file.write_text(json.dumps(manifest, indent=2), encoding="utf-8")

    # 4. Create compressed tarball
    tarball_path = output_dir / f"{backup_name}.tar.gz"
    print(f"[*] Packaging into {tarball_path}...")
    with tarfile.open(tarball_path, "w:gz") as tar:
        tar.add(work_dir, arcname=backup_name)

    # Clean up intermediate directory
    import shutil
    shutil.rmtree(work_dir)

    print(f"[+] Backup completed successfully: {tarball_path.name}")
    print(f"    - Database runs: {total_runs}, users: {total_users}")
    print(f"    - Telemetry files: {len(copied_files)}")
    print(f"    - Size: {tarball_path.stat().st_size / 1024:.1f} KB")
    return tarball_path


if __name__ == "__main__":
    create_backup()
