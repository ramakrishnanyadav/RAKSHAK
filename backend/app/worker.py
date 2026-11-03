"""
Job System & Simulation Worker.
Manages job queueing, idempotency keys, per-user quota enforcement,
resilient execution via EngineAdapters, retries with exponential backoff,
graceful cooperative cancellation, and real-time SSE telemetry streaming.
"""

import os
import json
import time
import asyncio
import logging
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from typing import Dict, Any, Optional, List, AsyncGenerator
from threading import Lock

from backend.app.config import settings
from backend.app.database import SessionLocal
from backend.app.models import RunRecord, QuotaRecord, utcnow
from backend.app.adapters import get_adapter
from backend.app.adapters.base import SimulationCancelledException
from backend.app.adapters.errors import (
    MatlabLicenseUnavailableError,
    EngineCrashError,
    EngineTimeoutError,
    SchemaMismatchError,
)
from backend.app.adapters.pipeline.storage import ObjectStorageManager
from backend.app.core.errors import QuotaExceededError, ConflictError, ResourceNotFoundError

logger = logging.getLogger("studio.worker")

executor = ThreadPoolExecutor(max_workers=settings.worker_concurrency)

# State management for live cancellations and SSE event bus
_cancel_flags: Dict[str, bool] = {}
_state_lock = Lock()
_run_subscribers: Dict[str, List[asyncio.Queue]] = {}


def register_subscriber(run_id: str, queue: asyncio.Queue) -> None:
    with _state_lock:
        if run_id not in _run_subscribers:
            _run_subscribers[run_id] = []
        _run_subscribers[run_id].append(queue)


def unregister_subscriber(run_id: str, queue: asyncio.Queue) -> None:
    with _state_lock:
        if run_id in _run_subscribers:
            try:
                _run_subscribers[run_id].remove(queue)
                if not _run_subscribers[run_id]:
                    del _run_subscribers[run_id]
            except ValueError:
                pass


def broadcast_event(run_id: str, event_type: str, payload: Dict[str, Any]) -> None:
    """Broadcast an SSE event frame to all connected listeners."""
    with _state_lock:
        queues = list(_run_subscribers.get(run_id, []))

    msg = f"event: {event_type}\ndata: {json.dumps(payload)}\n\n"
    for q in queues:
        try:
            q.put_nowait(msg)
        except Exception:
            pass


def check_and_consume_quota(user_id: Optional[str], db) -> None:
    """Enforce per-user concurrent run and daily quota limits."""
    if not user_id:
        return  # System or unauthenticated runs

    today_str = utcnow().strftime("%Y-%m-%d")
    quota = db.query(QuotaRecord).filter(QuotaRecord.user_id == user_id).first()
    if not quota:
        # Create default quota
        quota = QuotaRecord(
            user_id=user_id,
            max_concurrent_runs=settings.default_max_concurrent_runs,
            daily_run_limit=settings.default_daily_run_limit,
            runs_today=0,
            last_reset_date=today_str,
        )
        db.add(quota)
        db.commit()

    # Reset daily counter if a new day has started
    if quota.last_reset_date != today_str:
        quota.runs_today = 0
        quota.last_reset_date = today_str

    if quota.runs_today >= quota.daily_run_limit:
        raise QuotaExceededError(
            f"Daily run limit of {quota.daily_run_limit} reached for user. Resets at midnight UTC."
        )

    # Check active concurrent runs
    active_runs = (
        db.query(RunRecord)
        .filter(
            RunRecord.owner_id == user_id,
            RunRecord.status.in_(["queued", "running"]),
        )
        .count()
    )
    if active_runs >= quota.max_concurrent_runs:
        raise QuotaExceededError(
            f"Concurrent run limit of {quota.max_concurrent_runs} exceeded. Please wait for active runs to complete."
        )

    quota.runs_today += 1
    db.commit()


def execute_simulation_task(
    run_id: str,
    scenario_id: str,
    planner_id: str,
    split: str,
    seed: int,
    engine_adapter_name: str,
    custom_params: Dict[str, Any],
    max_retries: int = 2,
    db_session: Optional[Any] = None,
):
    """
    Worker task executed in thread pool.
    Handles retry backoff, log persistence, status updates, and SSE events.
    """
    owns_db = db_session is None
    db = db_session if db_session is not None else SessionLocal()
    adapter = get_adapter(engine_adapter_name)

    attempt = 0
    while attempt <= max_retries:
        try:
            # 1. Update record to running
            record = db.query(RunRecord).filter(RunRecord.id == run_id).first()
            if not record:
                return

            if record.cancel_requested or _cancel_flags.get(run_id, False):
                record.status = "cancelled"
                record.failure_tag = "CANCELLED_BY_USER"
                db.commit()
                broadcast_event(run_id, "cancelled", {"run_id": run_id, "message": "Run cancelled before start"})
                return

            record.status = "running"
            record.retry_count = attempt
            db.commit()

            broadcast_event(run_id, "status", {"status": "running", "attempt": attempt + 1})

            def is_cancelled_check() -> bool:
                if _cancel_flags.get(run_id, False):
                    return True
                # Fresh DB check
                rec = db.query(RunRecord).filter(RunRecord.id == run_id).first()
                return rec.cancel_requested if rec else False

            def progress_callback(fraction: float, message: str, telemetry: Optional[Dict[str, Any]] = None):
                broadcast_event(
                    run_id,
                    "progress",
                    {"run_id": run_id, "fraction": fraction, "message": message, "telemetry": telemetry or {}},
                )

            # 2. Execute via EngineAdapter
            log = adapter.execute(
                scenario_id=scenario_id,
                planner_id=planner_id,
                seed=seed,
                split=split,
                custom_params=custom_params,
                on_progress=progress_callback,
                is_cancelled=is_cancelled_check,
            )

            # 3. Write apath-log v1 JSON to disk storage via atomic pipeline manager
            storage_mgr = ObjectStorageManager(settings.storage_dir)
            log_file = storage_mgr.save_run_log_atomic(log)

            # 4. Update Run Record
            m = log.metrics
            record.status = "completed"
            record.config_hash = log.config_hash
            record.duration_s = m.duration_s
            record.completed_goal = m.completed_goal
            record.collision_occurred = m.collision_occurred
            record.min_clearance_m = m.min_clearance_m
            record.mean_speed_m_s = m.mean_speed_m_s
            record.max_jerk_m_s3 = m.max_jerk_m_s3
            record.replan_count = m.replan_count
            record.p95_latency_ms = m.p95_latency_ms
            record.failure_tag = m.failure_tag
            record.log_path = str(log_file.relative_to(settings.storage_dir))
            db.commit()

            broadcast_event(
                run_id,
                "completed",
                {"run_id": run_id, "status": "completed", "collision": m.collision_occurred, "goal": m.completed_goal},
            )
            break

        except SimulationCancelledException as ce:
            logger.info(f"Simulation run {run_id} cancelled.")
            db.rollback()
            record = db.query(RunRecord).filter(RunRecord.id == run_id).first()
            if record:
                record.status = "cancelled"
                record.failure_tag = "CANCELLED_BY_OPERATOR"
                db.commit()
            broadcast_event(run_id, "cancelled", {"run_id": run_id, "message": str(ce)})
            break

        except MatlabLicenseUnavailableError as mle:
            logger.error(f"MATLAB license unavailable for run {run_id}: {mle.message}")
            db.rollback()
            record = db.query(RunRecord).filter(RunRecord.id == run_id).first()
            if record:
                record.status = "failed"
                record.failure_tag = "LICENCE_UNAVAILABLE"
                db.commit()
            broadcast_event(run_id, "failed", {"run_id": run_id, "error": mle.message, "failure_tag": "LICENCE_UNAVAILABLE"})
            break

        except (EngineCrashError, EngineTimeoutError, SchemaMismatchError) as spe:
            db.rollback()
            logger.error(f"Engine failure for run {run_id}: {spe.message}")
            record = db.query(RunRecord).filter(RunRecord.id == run_id).first()
            if record:
                record.status = "failed"
                record.failure_tag = spe.failure_tag
                db.commit()
            broadcast_event(run_id, "failed", {"run_id": run_id, "error": spe.message, "failure_tag": spe.failure_tag})
            break

        except Exception as exc:
            db.rollback()
            logger.warning(f"Error executing run {run_id} (attempt {attempt + 1}/{max_retries + 1}): {exc}")
            attempt += 1
            if attempt <= max_retries:
                # Exponential backoff retry
                backoff_s = settings.worker_retry_backoff_base_s * (2 ** (attempt - 1))
                time.sleep(backoff_s)
            else:
                # Retries exhausted
                record = db.query(RunRecord).filter(RunRecord.id == run_id).first()
                if record:
                    record.status = "failed"
                    record.failure_tag = f"ERROR: {str(exc)[:100]}"
                    db.commit()
                broadcast_event(run_id, "failed", {"run_id": run_id, "error": str(exc)})
                break
        finally:
            _cancel_flags.pop(run_id, None)

    if owns_db:
        db.close()


async def enqueue_simulation_job(
    scenario_id: str,
    planner_id: str,
    split: str = "tune",
    seed: int = 1000,
    engine_adapter_name: str = "python",
    custom_params: Optional[Dict[str, Any]] = None,
    owner_id: Optional[str] = None,
    idempotency_key: Optional[str] = None,
    is_shipped: bool = False,
    db_session: Optional[Any] = None,
) -> str:
    """
    Enqueues simulation job with idempotency checking and quota consumption.
    """
    owns_db = db_session is None
    db = db_session if db_session is not None else SessionLocal()
    try:
        # Check idempotency key if provided
        if idempotency_key:
            existing_by_key = db.query(RunRecord).filter(RunRecord.idempotency_key == idempotency_key).first()
            if existing_by_key:
                return existing_by_key.id

        # Check and consume user quota
        if not is_shipped:
            check_and_consume_quota(owner_id, db)

        run_id = f"run_{scenario_id.lower()}_{planner_id.lower()}_{split}_s{seed}"
        params = custom_params or {}

        # Register or reset record in DB
        record = db.query(RunRecord).filter(RunRecord.id == run_id).first()
        if not record:
            record = RunRecord(
                id=run_id,
                idempotency_key=idempotency_key,
                owner_id=owner_id,
                scenario_id=scenario_id,
                planner_id=planner_id,
                split=split,
                seed=seed,
                engine_adapter=engine_adapter_name,
                status="queued",
                is_shipped=is_shipped,
                max_retries=settings.worker_max_retries,
            )
            db.add(record)
        else:
            record.status = "queued"
            record.cancel_requested = False
            record.idempotency_key = idempotency_key
            record.retry_count = 0
            record.failure_tag = None
        db.commit()

        loop = asyncio.get_running_loop()
        loop.run_in_executor(
            executor,
            execute_simulation_task,
            run_id,
            scenario_id,
            planner_id,
            split,
            seed,
            engine_adapter_name,
            params,
            settings.worker_max_retries,
        )
        return run_id
    finally:
        if owns_db:
            db.close()


def cancel_simulation_job(run_id: str, db_session: Optional[Any] = None) -> None:
    """Signal cooperative cancellation to worker."""
    _cancel_flags[run_id] = True
    owns_db = db_session is None
    db = db_session if db_session is not None else SessionLocal()
    try:
        record = db.query(RunRecord).filter(RunRecord.id == run_id).first()
        if not record:
            raise ResourceNotFoundError(f"Run {run_id} not found")

        record.cancel_requested = True
        if record.status == "queued":
            record.status = "cancelled"
            record.failure_tag = "CANCELLED_IN_QUEUE"
        db.commit()
    finally:
        if owns_db:
            db.close()


async def stream_run_sse(run_id: str) -> AsyncGenerator[str, None]:
    """Yield Server-Sent Events for a run until completion, cancellation, or failure."""
    queue: asyncio.Queue = asyncio.Queue()
    register_subscriber(run_id, queue)

    try:
        # Check current state from DB first
        db = SessionLocal()
        record = db.query(RunRecord).filter(RunRecord.id == run_id).first()
        db.close()

        if record:
            yield f"event: status\ndata: {json.dumps({'run_id': run_id, 'status': record.status})}\n\n"
            if record.status in ("completed", "failed", "cancelled"):
                return

        while True:
            try:
                # Wait for next event with 10s heartbeat timeout
                msg = await asyncio.wait_for(queue.get(), timeout=10.0)
                yield msg

                if "event: completed" in msg or "event: failed" in msg or "event: cancelled" in msg:
                    break
            except asyncio.TimeoutError:
                yield f": heartbeat {int(time.time())}\n\n"
    finally:
        unregister_subscriber(run_id, queue)


if __name__ == "__main__":
    import sys
    import signal

    logging.basicConfig(
        level=logging.INFO,
        format='{"timestamp":"%(asctime)s","level":"%(levelname)s","logger":"%(name)s","message":"%(message)s"}',
    )
    logger.info("Simulation worker daemon started (concurrency=%d, adapter=%s)", settings.worker_concurrency, settings.engine_adapter_default)

    running = True

    def _sig_handler(sig, frame):
        global running
        logger.info("Received termination signal %s; shutting down worker daemon gracefully...", sig)
        running = False

    signal.signal(signal.SIGINT, _sig_handler)
    signal.signal(signal.SIGTERM, _sig_handler)

    try:
        while running:
            db = SessionLocal()
            try:
                queued = (
                    db.query(RunRecord)
                    .filter(RunRecord.status == "queued")
                    .order_by(RunRecord.created_at.asc())
                    .all()
                )
                for q in queued:
                    if not running:
                        break
                    logger.info("Daemon picking up queued simulation run: %s", q.id)
                    enqueue_run(
                        run_id=q.id,
                        scenario_id=q.scenario_id,
                        planner_id=q.planner_id,
                        engine_adapter=q.engine_adapter,
                        split=q.split,
                        seed=q.seed,
                        scenario_params=q.scenario_params,
                        user_id=q.user_id,
                    )
            except Exception as e:
                logger.error("Error in worker polling loop: %s", e)
            finally:
                db.close()

            time.sleep(1.5)
    except KeyboardInterrupt:
        logger.info("Worker daemon stopped by user.")
    logger.info("Worker daemon exited cleanly.")

