"""
Health, Readiness, and Operational Metrics Router.
Implements Kubernetes-compatible /health (liveness) and /health/ready (readiness)
as well as basic system metrics.
"""

from pathlib import Path
from fastapi import APIRouter, Depends, Response, status
from sqlalchemy import text
from sqlalchemy.orm import Session

from backend.app.database import get_db
from backend.app.config import settings
from backend.app.models import RunRecord
from backend.app.schemas import HealthCheckResponse, ReadinessResponse

router = APIRouter(tags=["observability"])


@router.get("/health", response_model=HealthCheckResponse)
def health_liveness():
    """Liveness probe: verifies API process is alive and responsive."""
    return HealthCheckResponse(
        status="healthy",
        service=settings.app_name,
        version=settings.app_version,
        engine_contract="apath-log/v1",
    )


@router.get("/health/ready", response_model=ReadinessResponse)
def health_readiness(response: Response, db: Session = Depends(get_db)):
    """Readiness probe: validates database connectivity and storage write access."""
    db_ok = False
    storage_ok = False

    # 1. Database check
    try:
        db.execute(text("SELECT 1"))
        db_ok = True
    except Exception:
        db_ok = False

    # 2. Storage write access check
    try:
        test_file = Path(settings.storage_dir) / ".health_check.tmp"
        test_file.write_text("ok", encoding="utf-8")
        test_file.unlink(missing_ok=True)
        storage_ok = True
    except Exception:
        storage_ok = False

    is_ready = db_ok and storage_ok
    if not is_ready:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE

    return ReadinessResponse(
        status="ready" if is_ready else "unready",
        database_connected=db_ok,
        storage_writable=storage_ok,
        worker_ready=True,
    )


@router.get("/metrics")
def get_metrics(db: Session = Depends(get_db)):
    """Prometheus-compatible and JSON operational metrics."""
    total_runs = db.query(RunRecord).count()
    completed_runs = db.query(RunRecord).filter(RunRecord.status == "completed").count()
    active_runs = db.query(RunRecord).filter(RunRecord.status.in_(["queued", "running"])).count()
    failed_runs = db.query(RunRecord).filter(RunRecord.status == "failed").count()

    return {
        "service": settings.app_name,
        "version": settings.app_version,
        "runs_total": total_runs,
        "runs_completed": completed_runs,
        "runs_active": active_runs,
        "runs_failed": failed_runs,
    }
