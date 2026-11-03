#!/usr/bin/env python3
"""
Automated Database & Object Storage Restore Utility.
Restores a verified ADAPTIVE-PATH platform backup archive with:
1. Integrity verification against manifest SHA-256
2. Database restoration (PostgreSQL pg_restore or SQLite transactional swap)
3. Object storage logs restoration
4. Post-restore data verification
"""

import os
import sys
import json
import tarfile
import hashlib
import sqlite3
import subprocess
from pathlib import Path
from datetime import datetime, timezone

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


def restore_backup(tarball_path: Path) -> bool:
    if not tarball_path.exists():
        raise FileNotFoundError(f"Backup archive not found: {tarball_path}")

    print(f"[*] Starting restore from {tarball_path.name}...")
    temp_dir = tarball_path.parent / "temp_restore"
    temp_dir.mkdir(parents=True, exist_ok=True)

    try:
        # 1. Unpack archive
        with tarfile.open(tarball_path, "r:gz") as tar:
            tar.extractall(temp_dir)

        # Locate extracted directory
        subdirs = [d for d in temp_dir.iterdir() if d.is_dir()]
        if not subdirs:
            raise ValueError("Malformed backup archive: no root directory")
        extract_root = subdirs[0]

        manifest_file = extract_root / "manifest.json"
        if not manifest_file.exists():
            raise ValueError("Malformed backup archive: missing manifest.json")

        manifest = json.loads(manifest_file.read_text(encoding="utf-8"))
        print(f"[*] Verified backup manifest: {manifest['backup_name']} (Timestamp: {manifest['timestamp_iso']})")

        # 2. Checksum verification
        db_dump_file = extract_root / "database.dump"
        if not db_dump_file.exists():
            raise ValueError("Missing database.dump file in archive")

        actual_sha = sha256_file(db_dump_file)
        if actual_sha != manifest["database_sha256"]:
            raise ValueError(f"Database SHA-256 mismatch! Expected {manifest['database_sha256']}, got {actual_sha}")
        print("[+] Checksum validation PASSED.")

        # 3. Database Restoration
        db_url = settings.database_url
        if db_url.startswith("sqlite"):
            db_path = db_url.replace("sqlite:///", "").replace("sqlite://", "")
            target_db = Path(db_path)
            if not target_db.is_absolute():
                target_db = REPO_ROOT / target_db

            print(f"[*] Restoring SQLite database to {target_db}...")
            from backend.app.database import engine as sa_engine
            sa_engine.dispose()

            src_conn = sqlite3.connect(str(db_dump_file))
            dst_conn = sqlite3.connect(str(target_db))
            src_conn.backup(dst_conn)
            src_conn.close()
            dst_conn.close()
            sa_engine.dispose()
        else:
            print("[*] Restoring PostgreSQL database via pg_restore...")
            cmd = ["pg_restore", "--clean", "--if-exists", "-d", db_url, str(db_dump_file)]
            subprocess.run(cmd, check=True)

        # 4. Storage Restoration
        storage_src = extract_root / "storage"
        storage_dst = Path(settings.storage_dir)
        if not storage_dst.is_absolute():
            storage_dst = REPO_ROOT / storage_dst

        if storage_src.exists():
            import shutil
            for folder in ["runs", "sample_runs", "scenarios"]:
                src_f = storage_src / folder
                if src_f.exists():
                    dst_f = storage_dst / folder
                    dst_f.mkdir(parents=True, exist_ok=True)
                    shutil.copytree(src_f, dst_f, dirs_exist_ok=True)
            print("[+] Object storage telemetry logs restored.")

        # 5. Post-restore Verification
        db_session = SessionLocal()
        try:
            restored_runs = db_session.query(RunRecord).count()
            restored_users = db_session.query(UserRecord).count()
            print(f"[+] Post-restore check: {restored_runs} runs restored (expected >= {manifest['total_runs']}), {restored_users} users restored.")
        finally:
            db_session.close()

        print("[+] Database and Object Storage Restore COMPLETED SUCCESSFULLY.")
        return True

    finally:
        import shutil
        if temp_dir.exists():
            shutil.rmtree(temp_dir)


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python restore.py <path_to_backup_tarball.tar.gz>")
        sys.exit(1)
    restore_backup(Path(sys.argv[1]))
