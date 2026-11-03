"""
Log Pipeline Step 4: Object Storage Manager.
Provides atomic, transactional disk/object storage writes with partial log isolation
to eliminate file corruption during engine crashes or interruptions.
"""

import os
import json
import uuid
import shutil
from pathlib import Path
from typing import Optional, Dict, Any, List
from engine.apath_log.schema import RunLog


class ObjectStorageManager:
    """
    Manages transactional storage of RunLog documents.
    Uses atomic temporary-file writes to guarantee that corrupt or half-written
    files never appear in the storage bucket.
    """

    def __init__(self, base_storage_dir: Optional[str] = None):
        if not base_storage_dir:
            base_storage_dir = os.environ.get("STORAGE_DIR", "storage")
        self.base_dir = Path(base_storage_dir).resolve()
        self.runs_dir = self.base_dir / "runs"
        self.runs_dir.mkdir(parents=True, exist_ok=True)

    def get_run_path(self, run_id: str) -> Path:
        """Returns standard destination path for completed run log."""
        return self.runs_dir / f"{run_id}.json"

    def get_partial_run_path(self, run_id: str) -> Path:
        """Returns isolated destination path for partial / interrupted run log."""
        return self.runs_dir / f"{run_id}.partial.json"

    def save_run_log_atomic(self, run_log: RunLog) -> Path:
        """
        Atomically saves a completed RunLog.
        Writes to a unique staging file and replaces the target file in one atomic operation.
        """
        target_path = self.get_run_path(run_log.run_id)
        temp_path = self.runs_dir / f".tmp_{run_log.run_id}_{uuid.uuid4().hex[:8]}.json"

        try:
            # Write to temporary file with indent
            with open(temp_path, "w", encoding="utf-8") as f:
                f.write(run_log.model_dump_json(indent=2))
                f.flush()
                os.fsync(f.fileno())

            # Atomic rename / replace
            shutil.move(str(temp_path), str(target_path))
            return target_path

        except Exception as e:
            if temp_path.exists():
                try:
                    temp_path.unlink()
                except Exception:
                    pass
            raise IOError(f"Failed atomic write for run {run_log.run_id}: {e}") from e

    def save_partial_log(
        self,
        run_id: str,
        frames: List[Dict[str, Any]],
        metadata: Dict[str, Any],
        failure_tag: str,
        error_report: Optional[Dict[str, Any]] = None,
    ) -> Path:
        """
        Saves partial progress during a crash, timeout, or cancellation.
        Ensures partial data is preserved for diagnostics without corrupting primary logs.
        """
        partial_path = self.get_partial_run_path(run_id)
        temp_path = self.runs_dir / f".tmp_partial_{run_id}_{uuid.uuid4().hex[:8]}.json"

        payload = {
            "schema_version": "apath-log/v1",
            "run_id": run_id,
            "is_partial": True,
            "failure_tag": failure_tag,
            "error_report": error_report or {},
            "metadata": metadata,
            "frame_count": len(frames),
            "frames": frames,
        }

        try:
            with open(temp_path, "w", encoding="utf-8") as f:
                json.dump(payload, f, indent=2)
                f.flush()
                os.fsync(f.fileno())

            shutil.move(str(temp_path), str(partial_path))
            return partial_path

        except Exception as e:
            if temp_path.exists():
                try:
                    temp_path.unlink()
                except Exception:
                    pass
            raise IOError(f"Failed to save partial log for run {run_id}: {e}") from e

    def load_run_log(self, run_id: str) -> Optional[RunLog]:
        """Loads and parses a completed RunLog by run_id."""
        path = self.get_run_path(run_id)
        if not path.exists():
            return None

        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        return RunLog.model_validate(data)

    def delete_run_log(self, run_id: str) -> bool:
        """Deletes both primary and partial log files for a run if present."""
        deleted = False
        p1 = self.get_run_path(run_id)
        p2 = self.get_partial_run_path(run_id)

        if p1.exists():
            p1.unlink()
            deleted = True
        if p2.exists():
            p2.unlink()
            deleted = True

        return deleted
