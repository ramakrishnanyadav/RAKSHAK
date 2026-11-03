"""
System Administration & Audit Router.
Provides user access governance, quota controls, audit trail querying, and system statistics.
All endpoints require elevated administrative privileges verified by the Single Authorization Layer.
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.orm import Session, joinedload

from backend.app.database import get_db
from backend.app.models import UserRecord, QuotaRecord, AuditLogRecord, RunRecord, utcnow
from backend.app.config import settings
from backend.app.schemas import (
    AdminUserListItem,
    AdminUserRoleUpdateRequest,
    AdminUserQuotaUpdateRequest,
    QuotaInfo,
    AuditLogEntryResponse,
    SystemStatsResponse,
)
from backend.app.core.auth_layer import (
    require_permission,
    Action,
    AuthenticatedUser,
    log_audit_event,
)
from backend.app.core.errors import ResourceNotFoundError

router = APIRouter(prefix="/api/admin", tags=["admin"])


@router.get("/users", response_model=List[AdminUserListItem])
def list_system_users(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    user: AuthenticatedUser = Depends(require_permission(Action.MANAGE_USERS)),
    db: Session = Depends(get_db),
):
    """List registered users with roles and quota allocations (no N+1 queries via joinedload)."""
    users = (
        db.query(UserRecord)
        .options(joinedload(UserRecord.quota))
        .order_by(UserRecord.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )

    result = []
    for u in users:
        q_info = None
        if u.quota:
            q_info = QuotaInfo(
                max_concurrent_runs=u.quota.max_concurrent_runs,
                daily_run_limit=u.quota.daily_run_limit,
                runs_today=u.quota.runs_today,
            )
        result.append(
            AdminUserListItem(
                id=u.id,
                email=u.email,
                role=u.role,
                is_active=u.is_active,
                is_verified=u.is_verified,
                created_at=u.created_at,
                quota=q_info,
            )
        )
    return result


@router.put("/users/{user_id}/role")
def update_user_role(
    user_id: str,
    req: AdminUserRoleUpdateRequest,
    request: Request,
    user: AuthenticatedUser = Depends(require_permission(Action.MANAGE_USERS)),
    db: Session = Depends(get_db),
):
    """Change role assignment for a user."""
    target_user = db.query(UserRecord).filter(UserRecord.id == user_id).first()
    if not target_user:
        raise ResourceNotFoundError(f"User '{user_id}' not found.")

    old_role = target_user.role
    target_user.role = req.role
    target_user.updated_at = utcnow()
    db.commit()

    log_audit_event(
        db,
        user_id=user.id,
        action="admin.role_change",
        resource_type="user",
        resource_id=user_id,
        details={"old_role": old_role, "new_role": req.role},
        ip_address=request.client.host if request.client else None,
    )

    return {"message": f"User {user_id} role updated to '{req.role}'"}


@router.put("/users/{user_id}/quota")
def update_user_quota(
    user_id: str,
    req: AdminUserQuotaUpdateRequest,
    request: Request,
    user: AuthenticatedUser = Depends(require_permission(Action.MANAGE_QUOTAS)),
    db: Session = Depends(get_db),
):
    """Update execution quotas for a user."""
    quota = db.query(QuotaRecord).filter(QuotaRecord.user_id == user_id).first()
    if not quota:
        quota = QuotaRecord(
            user_id=user_id,
            max_concurrent_runs=req.max_concurrent_runs,
            daily_run_limit=req.daily_run_limit,
            runs_today=0,
            last_reset_date=utcnow().strftime("%Y-%m-%d"),
        )
        db.add(quota)
    else:
        quota.max_concurrent_runs = req.max_concurrent_runs
        quota.daily_run_limit = req.daily_run_limit

    db.commit()

    log_audit_event(
        db,
        user_id=user.id,
        action="admin.quota_update",
        resource_type="quota",
        resource_id=user_id,
        details={"max_concurrent": req.max_concurrent_runs, "daily_limit": req.daily_run_limit},
        ip_address=request.client.host if request.client else None,
    )

    return {"message": f"Updated quotas for user {user_id}"}


@router.get("/audit-logs", response_model=List[AuditLogEntryResponse])
def get_audit_trail(
    action: Optional[str] = None,
    user_id: Optional[str] = None,
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    user: AuthenticatedUser = Depends(require_permission(Action.READ_AUDIT_LOGS)),
    db: Session = Depends(get_db),
):
    """Query system-wide security and operations audit log."""
    query = db.query(AuditLogRecord)
    if action:
        query = query.filter(AuditLogRecord.action == action)
    if user_id:
        query = query.filter(AuditLogRecord.user_id == user_id)

    logs = query.order_by(AuditLogRecord.timestamp.desc()).offset(offset).limit(limit).all()

    return [
        AuditLogEntryResponse(
            id=entry.id,
            user_id=entry.user_id,
            action=entry.action,
            resource_type=entry.resource_type,
            resource_id=entry.resource_id,
            details=entry.details or {},
            ip_address=entry.ip_address,
            timestamp=entry.timestamp,
        )
        for entry in logs
    ]


@router.get("/system-stats", response_model=SystemStatsResponse)
def get_system_stats(
    user: AuthenticatedUser = Depends(require_permission(Action.SYSTEM_STATS)),
    db: Session = Depends(get_db),
):
    """Retrieve operational health, worker depth, and usage statistics."""
    total_runs = db.query(RunRecord).count()
    completed_runs = db.query(RunRecord).filter(RunRecord.status == "completed").count()
    failed_runs = db.query(RunRecord).filter(RunRecord.status == "failed").count()
    cancelled_runs = db.query(RunRecord).filter(RunRecord.status == "cancelled").count()
    total_users = db.query(UserRecord).count()

    return SystemStatsResponse(
        environment=settings.environment,
        active_worker_threads=settings.worker_concurrency,
        total_runs_recorded=total_runs,
        completed_runs=completed_runs,
        failed_runs=failed_runs,
        cancelled_runs=cancelled_runs,
        total_registered_users=total_users,
    )
