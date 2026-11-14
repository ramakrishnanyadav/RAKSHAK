"""
Runs Lifecycle Router.
Handles job launch, batch sweeps, filtered & paginated queries, ownership enforcement,
cooperative cancellations, retries, and real-time SSE progress streaming.
"""

from typing import Optional, List
from fastapi import APIRouter, Depends, Header, Query, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from backend.app.database import get_db
from backend.app.models import RunRecord
from backend.app.schemas import (
    RunLaunchRequest,
    BatchLaunchRequest,
    RunSummaryResponse,
    RunListResponse,
    RunManifestResponse,
)
from backend.app.worker import (
    enqueue_simulation_job,
    cancel_simulation_job,
    stream_run_sse,
)
from backend.app.core.auth_layer import (
    require_permission,
    check_ownership,
    Action,
    Role,
    AuthenticatedUser,
    log_audit_event,
)
from backend.app.core.errors import ResourceNotFoundError, PermissionDeniedError
from engine.scenarios.registry import SCENARIOS_CATALOG, get_seeds_for_split

router = APIRouter(prefix="/api/runs", tags=["runs"])


@router.post("", response_model=dict)
async def launch_run(
    req: RunLaunchRequest,
    request: Request,
    idempotency_key: Optional[str] = Header(None, alias="Idempotency-Key"),
    user: AuthenticatedUser = Depends(require_permission(Action.LAUNCH_RUN)),
    db: Session = Depends(get_db),
):
    """Enqueue a simulation run with idempotency checking and quota limits."""
    if req.scenario_id not in SCENARIOS_CATALOG:
        raise ResourceNotFoundError(f"Scenario '{req.scenario_id}' not found in catalog.")

    effective_idempotency_key = idempotency_key or req.idempotency_key

    run_id = await enqueue_simulation_job(
        scenario_id=req.scenario_id,
        planner_id=req.planner_id,
        split=req.split,
        seed=req.seed,
        engine_adapter_name=req.engine_adapter,
        custom_params=req.custom_params,
        owner_id=user.id,
        idempotency_key=effective_idempotency_key,
        is_shipped=False,
        db_session=db,
    )

    log_audit_event(
        db,
        user_id=user.id,
        action="run.launch",
        resource_type="run",
        resource_id=run_id,
        details={"scenario_id": req.scenario_id, "planner_id": req.planner_id, "seed": req.seed},
        ip_address=request.client.host if request.client else None,
    )

    return {"message": "Run enqueued successfully", "run_id": run_id, "status": "queued"}


@router.post("/batch", response_model=dict)
async def launch_batch(
    req: BatchLaunchRequest,
    user: AuthenticatedUser = Depends(require_permission(Action.LAUNCH_RUN)),
    db: Session = Depends(get_db),
):
    """Enqueue a batch parameter sweep across scenarios, planners, and seeds."""
    seeds = req.seeds or get_seeds_for_split(req.split)
    queued_ids = []

    for sc_id in req.scenario_ids:
        if sc_id not in SCENARIOS_CATALOG:
            continue
        for p_id in req.planner_ids:
            for s in seeds:
                run_id = await enqueue_simulation_job(
                    scenario_id=sc_id,
                    planner_id=p_id,
                    split=req.split,
                    seed=s,
                    engine_adapter_name=req.engine_adapter,
                    owner_id=user.id,
                    is_shipped=False,
                    db_session=db,
                )
                queued_ids.append(run_id)

    return {"message": f"Queued {len(queued_ids)} batch runs", "run_ids": queued_ids}


@router.get("", response_model=RunListResponse)
def list_runs(
    scenario_id: Optional[str] = None,
    planner_id: Optional[str] = None,
    split: Optional[str] = None,
    status: Optional[str] = None,
    shipped_only: bool = False,
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    user: AuthenticatedUser = Depends(require_permission(Action.READ_RUN)),
    db: Session = Depends(get_db),
):
    """
    List runs matching filters with pagination.
    Guest users automatically only see shipped baseline runs.
    """
    query = db.query(RunRecord)

    # Enforce role scoping: users see shipped runs plus their own session runs
    if shipped_only:
        query = query.filter(RunRecord.is_shipped == True)
    elif user.role == Role.ADMIN:
        pass
    else:
        # Non-admin users and open-access guest sessions see shipped runs plus their own session runs
        query = query.filter((RunRecord.is_shipped == True) | (RunRecord.owner_id == user.id))

    if scenario_id:
        query = query.filter(RunRecord.scenario_id == scenario_id)
    if planner_id:
        query = query.filter(RunRecord.planner_id == planner_id)
    if split:
        query = query.filter(RunRecord.split == split)
    if status:
        query = query.filter(RunRecord.status == status)

    total = query.count()
    records = query.order_by(RunRecord.created_at.desc()).offset(offset).limit(limit).all()

    items = [
        RunSummaryResponse(
            id=r.id,
            scenario_id=r.scenario_id,
            planner_id=r.planner_id,
            split=r.split,
            seed=r.seed,
            engine_adapter=r.engine_adapter,
            status=r.status,
            config_hash=r.config_hash,
            is_shipped=r.is_shipped,
            owner_id=r.owner_id,
            created_at=r.created_at,
            duration_s=r.duration_s,
            completed_goal=r.completed_goal,
            collision_occurred=r.collision_occurred,
            min_clearance_m=r.min_clearance_m,
            mean_speed_m_s=r.mean_speed_m_s,
            max_jerk_m_s3=r.max_jerk_m_s3,
            replan_count=r.replan_count,
            p95_latency_ms=r.p95_latency_ms,
            failure_tag=r.failure_tag,
        )
        for r in records
    ]

    return RunListResponse(items=items, total=total, limit=limit, offset=offset)


@router.get("/{run_id}", response_model=RunSummaryResponse)
def get_run(
    run_id: str,
    user: AuthenticatedUser = Depends(require_permission(Action.READ_RUN)),
    db: Session = Depends(get_db),
):
    """Retrieve run record summary with ownership enforcement."""
    record = db.query(RunRecord).filter(RunRecord.id == run_id).first()
    if not record:
        raise ResourceNotFoundError(f"Run '{run_id}' not found.")

    check_ownership(user, resource_owner_id=record.owner_id, is_shipped=record.is_shipped)

    return RunSummaryResponse(
        id=record.id,
        scenario_id=record.scenario_id,
        planner_id=record.planner_id,
        split=record.split,
        seed=record.seed,
        engine_adapter=record.engine_adapter,
        status=record.status,
        config_hash=record.config_hash,
        is_shipped=record.is_shipped,
        owner_id=record.owner_id,
        created_at=record.created_at,
        duration_s=record.duration_s,
        completed_goal=record.completed_goal,
        collision_occurred=record.collision_occurred,
        min_clearance_m=record.min_clearance_m,
        mean_speed_m_s=record.mean_speed_m_s,
        max_jerk_m_s3=record.max_jerk_m_s3,
        replan_count=record.replan_count,
        p95_latency_ms=record.p95_latency_ms,
        failure_tag=record.failure_tag,
    )


@router.post("/{run_id}/cancel")
def cancel_run(
    run_id: str,
    request: Request,
    user: AuthenticatedUser = Depends(require_permission(Action.CANCEL_RUN)),
    db: Session = Depends(get_db),
):
    """Cooperatively cancel a queued or running simulation run."""
    record = db.query(RunRecord).filter(RunRecord.id == run_id).first()
    if not record:
        raise ResourceNotFoundError(f"Run '{run_id}' not found.")

    check_ownership(user, resource_owner_id=record.owner_id, is_shipped=record.is_shipped)

    cancel_simulation_job(run_id, db_session=db)

    log_audit_event(
        db,
        user_id=user.id,
        action="run.cancel",
        resource_type="run",
        resource_id=run_id,
        ip_address=request.client.host if request.client else None,
    )

    return {"message": f"Cancellation requested for run {run_id}", "status": "cancelling"}


@router.post("/{run_id}/retry")
async def retry_run(
    run_id: str,
    user: AuthenticatedUser = Depends(require_permission(Action.RETRY_RUN)),
    db: Session = Depends(get_db),
):
    """Retry a failed or cancelled simulation run."""
    record = db.query(RunRecord).filter(RunRecord.id == run_id).first()
    if not record:
        raise ResourceNotFoundError(f"Run '{run_id}' not found.")

    check_ownership(user, resource_owner_id=record.owner_id, is_shipped=record.is_shipped)

    new_run_id = await enqueue_simulation_job(
        scenario_id=record.scenario_id,
        planner_id=record.planner_id,
        split=record.split,
        seed=record.seed,
        engine_adapter_name=record.engine_adapter,
        owner_id=user.id,
        is_shipped=False,
        db_session=db,
    )
    return {"message": f"Retrying run {run_id}", "new_run_id": new_run_id, "status": "queued"}


@router.get("/{run_id}/stream")
async def stream_run(
    run_id: str,
    user: AuthenticatedUser = Depends(require_permission(Action.STREAM_RUN)),
    db: Session = Depends(get_db),
):
    """Real-time Server-Sent Events (SSE) telemetry stream."""
    record = db.query(RunRecord).filter(RunRecord.id == run_id).first()
    if not record:
        raise ResourceNotFoundError(f"Run '{run_id}' not found.")

    check_ownership(user, resource_owner_id=record.owner_id, is_shipped=record.is_shipped)

    return StreamingResponse(
        stream_run_sse(run_id),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
