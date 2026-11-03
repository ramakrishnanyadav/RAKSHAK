"""
Failures & Root Cause Attribution Router.
Enables researchers and safety engineers to query collisions, near-misses,
and categorize failures by module attribution (Perception, Prediction, Risk, Planning).
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from backend.app.database import get_db
from backend.app.models import RunRecord
from backend.app.schemas import RunSummaryResponse, RunListResponse
from backend.app.core.auth_layer import (
    require_permission,
    Action,
    Role,
    AuthenticatedUser,
)

router = APIRouter(prefix="/api/failures", tags=["failures"])


@router.get("", response_model=RunListResponse)
def list_failures(
    scenario_id: Optional[str] = None,
    planner_id: Optional[str] = None,
    tag: Optional[str] = None,  # PERCEPTION, PREDICTION, RISK, PLANNING
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    user: AuthenticatedUser = Depends(require_permission(Action.READ_FAILURE)),
    db: Session = Depends(get_db),
):
    """Filters runs that suffered collisions or clearance breaches (< 0.6m) with module attribution."""
    query = db.query(RunRecord).filter(
        (RunRecord.collision_occurred == True) | (RunRecord.min_clearance_m < 0.6)
    )

    if user.role != Role.ADMIN:
        query = query.filter((RunRecord.is_shipped == True) | (RunRecord.owner_id == user.id))

    if scenario_id:
        query = query.filter(RunRecord.scenario_id == scenario_id)
    if planner_id:
        query = query.filter(RunRecord.planner_id == planner_id)
    if tag:
        query = query.filter(RunRecord.failure_tag == tag)

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
