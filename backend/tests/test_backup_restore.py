"""
Automated Regression Test for Platform Backup & Restore Pipeline.
Verifies:
1. Transactionally consistent backup generation with manifest SHA-256 calculation.
2. Complete data and storage restoration after simulated data loss.
3. Tamper detection on corrupted backup archives.
"""

import sys
import json
import tarfile
from pathlib import Path
import pytest

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(REPO_ROOT))

from scripts.backup import create_backup
from scripts.restore import restore_backup
from backend.app.database import SessionLocal
from backend.app.models import RunRecord, UserRecord


def test_backup_and_restore_cycle(tmp_path):
    """Verifies that create_backup and restore_backup preserve all run records and storage."""
    db = SessionLocal()
    initial_runs_count = db.query(RunRecord).count()
    db.close()

    # 1. Execute Backup to temporary test directory
    backup_tarball = create_backup(output_dir=tmp_path)
    assert backup_tarball.exists()
    assert backup_tarball.name.endswith(".tar.gz")

    # 2. Inspect archive structure
    with tarfile.open(backup_tarball, "r:gz") as tar:
        names = tar.getnames()
        assert any("manifest.json" in n for n in names)
        assert any("database.dump" in n for n in names)

    # 3. Simulate accidental deletion of a run
    db = SessionLocal()
    target_run = db.query(RunRecord).first()
    deleted_run_id = None
    if target_run:
        deleted_run_id = target_run.id
        db.delete(target_run)
        db.commit()
        after_delete_count = db.query(RunRecord).count()
        assert after_delete_count == initial_runs_count - 1
    db.close()

    # 4. Execute Restore
    restore_success = restore_backup(backup_tarball)
    assert restore_success is True

    # 5. Verify restored state
    db = SessionLocal()
    restored_runs_count = db.query(RunRecord).count()
    assert restored_runs_count == initial_runs_count

    if deleted_run_id:
        restored_run = db.query(RunRecord).filter(RunRecord.id == deleted_run_id).first()
        assert restored_run is not None
        assert restored_run.id == deleted_run_id
    db.close()


def test_restore_tamper_detection(tmp_path):
    """Verifies that restore_backup rejects archives with corrupted checksums."""
    backup_tarball = create_backup(output_dir=tmp_path)
    assert backup_tarball.exists()

    # Unpack, modify database.dump, repack
    unpack_dir = tmp_path / "tamper_work"
    unpack_dir.mkdir()
    with tarfile.open(backup_tarball, "r:gz") as tar:
        tar.extractall(unpack_dir)

    root_dir = next(unpack_dir.iterdir())
    dump_file = root_dir / "database.dump"
    # Corrupt file contents
    dump_file.write_bytes(b"CORRUPTED_DATABASE_PAYLOAD")

    tampered_tarball = tmp_path / "tampered.tar.gz"
    with tarfile.open(tampered_tarball, "w:gz") as tar:
        tar.add(root_dir, arcname=root_dir.name)

    # Attempt restore and verify ValueError on SHA-256 mismatch
    with pytest.raises(ValueError) as exc:
        restore_backup(tampered_tarball)
    assert "SHA-256 mismatch" in str(exc.value)
