"""
User Settings & Personal Preferences Router.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from backend.app.database import get_db
from backend.app.models import UserSettingsRecord, utcnow
from backend.app.schemas import UserSettingsResponse, UserSettingsUpdateRequest
from backend.app.core.auth_layer import (
    require_permission,
    Action,
    AuthenticatedUser,
)

router = APIRouter(prefix="/api/settings", tags=["settings"])


@router.get("/me", response_model=UserSettingsResponse)
def get_user_settings(
    user: AuthenticatedUser = Depends(require_permission(Action.READ_SETTINGS)),
    db: Session = Depends(get_db),
):
    """Retrieve personal UI and planner preferences."""
    settings_rec = db.query(UserSettingsRecord).filter(UserSettingsRecord.user_id == user.id).first()
    if not settings_rec:
        settings_rec = UserSettingsRecord(
            user_id=user.id,
            preferences={"theme": "dark", "default_planner": "P3", "default_split": "tune"},
        )
        db.add(settings_rec)
        db.commit()

    return UserSettingsResponse(
        preferences=settings_rec.preferences or {},
        updated_at=settings_rec.updated_at,
    )


@router.put("/me", response_model=UserSettingsResponse)
def update_user_settings(
    req: UserSettingsUpdateRequest,
    user: AuthenticatedUser = Depends(require_permission(Action.UPDATE_SETTINGS)),
    db: Session = Depends(get_db),
):
    """Update personal UI preferences."""
    settings_rec = db.query(UserSettingsRecord).filter(UserSettingsRecord.user_id == user.id).first()
    if not settings_rec:
        settings_rec = UserSettingsRecord(user_id=user.id, preferences=req.preferences)
        db.add(settings_rec)
    else:
        settings_rec.preferences = req.preferences
        settings_rec.updated_at = utcnow()

    db.commit()
    return UserSettingsResponse(
        preferences=settings_rec.preferences,
        updated_at=settings_rec.updated_at,
    )


@router.get("/data/export")
def export_user_data(
    user: AuthenticatedUser = Depends(require_permission(Action.READ_SETTINGS)),
    db: Session = Depends(get_db),
):
    """
    GDPR / DPDP Right to Data Portability.
    Exports all personal account details, preferences, active sessions, quotas, and authored runs.
    """
    from backend.app.models import UserRecord, SessionRecord, QuotaRecord, RunRecord

    user_rec = db.query(UserRecord).filter(UserRecord.id == user.id).first()
    settings_rec = db.query(UserSettingsRecord).filter(UserSettingsRecord.user_id == user.id).first()
    quota_rec = db.query(QuotaRecord).filter(QuotaRecord.user_id == user.id).first()
    sessions = db.query(SessionRecord).filter(SessionRecord.user_id == user.id).all()
    runs = db.query(RunRecord).filter(RunRecord.owner_id == user.id).all()

    return {
        "user_profile": {
            "id": user_rec.id if user_rec else user.id,
            "email": user_rec.email if user_rec else None,
            "role": user_rec.role if user_rec else user.role.value,
            "created_at": user_rec.created_at.isoformat() if user_rec and user_rec.created_at else None,
        },
        "preferences": settings_rec.preferences if settings_rec else {},
        "quota": {
            "max_concurrent_runs": quota_rec.max_concurrent_runs if quota_rec else None,
            "daily_run_limit": quota_rec.daily_run_limit if quota_rec else None,
            "runs_today": quota_rec.runs_today if quota_rec else None,
        },
        "sessions": [
            {
                "id": s.id,
                "created_at": s.created_at.isoformat() if s.created_at else None,
                "user_agent": s.user_agent,
                "ip_address": s.ip_address,
                "last_active_at": s.last_active_at.isoformat() if s.last_active_at else None,
            }
            for s in sessions
        ],
        "runs": [
            {
                "id": r.id,
                "scenario_id": r.scenario_id,
                "planner_id": r.planner_id,
                "split": r.split,
                "seed": r.seed,
                "status": r.status,
                "created_at": r.created_at.isoformat() if r.created_at else None,
                "duration_s": r.duration_s,
                "completed_goal": r.completed_goal,
                "collision_occurred": r.collision_occurred,
                "min_clearance_m": r.min_clearance_m,
            }
            for r in runs
        ],
    }

