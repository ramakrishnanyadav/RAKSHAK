"""
Log Chunks Router.
Implements HTTP Range Requests (RFC 7233 / 206 Partial Content) and paged/windowed
frame streaming so massive simulation traces are never loaded whole into memory.
"""

import os
import json
import re
from pathlib import Path
from typing import Optional
from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request, Response, status
from fastapi.responses import StreamingResponse, FileResponse
from sqlalchemy.orm import Session

from backend.app.database import get_db
from backend.app.models import RunRecord
from backend.app.config import settings
from backend.app.schemas import RunManifestResponse, FramesChunkResponse
from backend.app.core.auth_layer import (
    require_permission,
    check_ownership,
    Action,
    AuthenticatedUser,
)
from backend.app.core.errors import ResourceNotFoundError

router = APIRouter(prefix="/api/runs", tags=["logs"])


def _parse_range_header(range_header: str, file_size: int) -> tuple[int, int]:
    """Parse HTTP Range header: 'bytes=start-end'."""
    match = re.match(r"^bytes=(\d*)-(\d*)$", range_header.strip())
    if not match:
        raise HTTPException(
            status_code=status.HTTP_416_RANGE_NOT_SATISFIABLE,
            detail="Invalid Range header format.",
            headers={"Content-Range": f"bytes */{file_size}"},
        )

    start_str, end_str = match.groups()
    if not start_str and not end_str:
        raise HTTPException(status_code=status.HTTP_416_RANGE_NOT_SATISFIABLE)

    if start_str and end_str:
        start = int(start_str)
        end = int(end_str)
    elif start_str:
        start = int(start_str)
        end = file_size - 1
    else:
        # Suffix range: -500 means last 500 bytes
        length = int(end_str)
        start = max(0, file_size - length)
        end = file_size - 1

    if start >= file_size or end >= file_size or start > end:
        raise HTTPException(
            status_code=status.HTTP_416_RANGE_NOT_SATISFIABLE,
            headers={"Content-Range": f"bytes */{file_size}"},
        )

    return start, end


@router.get("/{run_id}/log")
def get_run_log_stream(
    run_id: str,
    range: Optional[str] = Header(None, alias="Range"),
    user: AuthenticatedUser = Depends(require_permission(Action.DOWNLOAD_LOG)),
    db: Session = Depends(get_db),
):
    """
    Retrieve run log with full support for HTTP Range (byte serving) requests (RFC 7233).
    Allows clients/browsers to stream arbitrary slices of huge simulation traces.
    """
    record = db.query(RunRecord).filter(RunRecord.id == run_id).first()
    if not record:
        raise ResourceNotFoundError(f"Run '{run_id}' not found.")

    check_ownership(user, resource_owner_id=record.owner_id, is_shipped=record.is_shipped)

    log_file = Path(settings.storage_dir) / "runs" / f"{run_id}.json"
    if not log_file.exists():
        raise ResourceNotFoundError(f"Log artifact file for run {run_id} does not exist on disk.")

    file_size = log_file.stat().st_size

    # If no Range header, return standard full file response with Accept-Ranges
    if not range:
        return FileResponse(
            path=str(log_file),
            media_type="application/json",
            filename=f"{run_id}.json",
            headers={"Accept-Ranges": "bytes"},
        )

    # Process HTTP Range (206 Partial Content)
    start, end = _parse_range_header(range, file_size)
    chunk_length = (end - start) + 1

    def file_chunk_generator():
        with open(log_file, "rb") as f:
            f.seek(start)
            bytes_left = chunk_length
            chunk_size = 64 * 1024  # 64 KB buffers
            while bytes_left > 0:
                read_amount = min(chunk_size, bytes_left)
                data = f.read(read_amount)
                if not data:
                    break
                bytes_left -= len(data)
                yield data

    return StreamingResponse(
        file_chunk_generator(),
        status_code=status.HTTP_206_PARTIAL_CONTENT,
        media_type="application/json",
        headers={
            "Content-Range": f"bytes {start}-{end}/{file_size}",
            "Accept-Ranges": "bytes",
            "Content-Length": str(chunk_length),
            "Cache-Control": "public, max-age=3600",
        },
    )


@router.get("/{run_id}/manifest", response_model=RunManifestResponse)
def get_run_manifest(
    run_id: str,
    user: AuthenticatedUser = Depends(require_permission(Action.READ_RUN)),
    db: Session = Depends(get_db),
):
    """
    Fetch lightweight run manifest (metadata, road network geometry, metrics summary)
    without transferring large frame lists.
    """
    record = db.query(RunRecord).filter(RunRecord.id == run_id).first()
    if not record:
        raise ResourceNotFoundError(f"Run '{run_id}' not found.")

    check_ownership(user, resource_owner_id=record.owner_id, is_shipped=record.is_shipped)

    log_file = Path(settings.storage_dir) / "runs" / f"{run_id}.json"
    if not log_file.exists():
        raise ResourceNotFoundError("Log artifact not found.")

    with open(log_file, "r", encoding="utf-8") as f:
        data = json.load(f)

    return RunManifestResponse(
        schema_version=data.get("schema_version", "apath-log/v1"),
        run_id=data.get("run_id", run_id),
        timestamp_iso=data.get("timestamp_iso", ""),
        config_hash=data.get("config_hash"),
        engine=data.get("engine", {}),
        scenario=data.get("scenario", {}),
        planner=data.get("planner", {}),
        world=data.get("world", {}),
        metrics=data.get("metrics", {}),
        total_frames=len(data.get("frames", [])),
    )


@router.get("/{run_id}/frames", response_model=FramesChunkResponse)
def get_run_frames_chunk(
    run_id: str,
    start_time: float = Query(0.0, ge=0.0, description="Start time in seconds"),
    end_time: float = Query(60.0, ge=0.0, description="End time in seconds"),
    limit: int = Query(1000, ge=1, le=5000, description="Maximum frames to return"),
    offset: int = Query(0, ge=0, description="Offset within temporal slice"),
    user: AuthenticatedUser = Depends(require_permission(Action.READ_RUN)),
    db: Session = Depends(get_db),
):
    """
    Stream a chunked temporal window of simulation frames with pagination.
    Defaults to 1000 frames (up to 100 seconds at 10 Hz) so full simulations
    are loaded without unexpected truncation midway.
    """
    record = db.query(RunRecord).filter(RunRecord.id == run_id).first()
    if not record:
        raise ResourceNotFoundError(f"Run '{run_id}' not found.")

    check_ownership(user, resource_owner_id=record.owner_id, is_shipped=record.is_shipped)

    log_file = Path(settings.storage_dir) / "runs" / f"{run_id}.json"
    if not log_file.exists():
        raise ResourceNotFoundError("Log artifact not found.")

    with open(log_file, "r", encoding="utf-8") as f:
        data = json.load(f)

    all_frames = data.get("frames", [])
    filtered_frames = [f for f in all_frames if start_time <= f.get("t", 0.0) <= end_time]
    chunk = filtered_frames[offset : offset + limit]

    return FramesChunkResponse(
        run_id=run_id,
        start_time=start_time,
        end_time=end_time,
        frame_count=len(chunk),
        frames=chunk,
    )
