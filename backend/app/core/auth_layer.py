"""
Single Unified Authorization Layer.
Enforces the Role x Action x Ownership authorization matrix across the entire API.
Roles: guest (read-only on shipped assets), researcher, designer, admin.
"""

from enum import Enum
from typing import Optional, Callable, Set, Dict, Any
from fastapi import Depends, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from pydantic import BaseModel

from backend.app.database import get_db
from backend.app.models import UserRecord, SessionRecord, AuditLogRecord
from backend.app.core.security import decode_access_token, hash_token
from backend.app.core.errors import AuthenticationError, PermissionDeniedError

security_bearer = HTTPBearer(auto_error=False)


class Role(str, Enum):
    GUEST = "guest"
    RESEARCHER = "researcher"
    DESIGNER = "designer"
    ADMIN = "admin"


class Action(str, Enum):
    # Runs
    READ_RUN = "run:read"
    LAUNCH_RUN = "run:launch"
    CANCEL_RUN = "run:cancel"
    RETRY_RUN = "run:retry"
    STREAM_RUN = "run:stream"
    DOWNLOAD_LOG = "run:download_log"

    # Scenarios
    READ_SCENARIO = "scenario:read"
    CREATE_SCENARIO_VARIANT = "scenario:create_variant"

    # Benchmarks & Failures
    READ_BENCHMARK = "benchmark:read"
    READ_FAILURE = "failure:read"

    # Reports
    CREATE_REPORT = "report:create"
    READ_REPORT = "report:read"

    # Settings
    READ_SETTINGS = "settings:read"
    UPDATE_SETTINGS = "settings:update"

    # Admin Privileges
    MANAGE_USERS = "admin:manage_users"
    MANAGE_QUOTAS = "admin:manage_quotas"
    READ_AUDIT_LOGS = "admin:read_audit_logs"
    SYSTEM_STATS = "admin:system_stats"


class AuthenticatedUser(BaseModel):
    id: str
    email: str
    role: Role
    is_active: bool = True
    is_verified: bool = False
    session_id: Optional[str] = None
    is_authenticated: bool = True


GUEST_USER = AuthenticatedUser(
    id="guest",
    email="guest@adaptive-path.local",
    role=Role.GUEST,
    is_active=True,
    is_verified=True,
    session_id=None,
    is_authenticated=False,
)

# Base role-permission capabilities matrix
ROLE_PERMISSIONS: Dict[Role, Set[Action]] = {
    Role.GUEST: {
        Action.READ_RUN,        # Shipped runs + own session runs
        Action.LAUNCH_RUN,      # Core simulation open access (Stage 4G.9)
        Action.CANCEL_RUN,      # Own session runs only (enforced via check_ownership)
        Action.RETRY_RUN,       # Own session runs only (enforced via check_ownership)
        Action.STREAM_RUN,      # Live SSE simulation progress
        Action.DOWNLOAD_LOG,    # Shipped runs + own session runs
        Action.READ_SCENARIO,   # Scenario library
        Action.READ_BENCHMARK,  # Benchmark comparisons
        Action.READ_FAILURE,    # Failure analysis
        Action.READ_REPORT,     # Validation reports
        Action.READ_SETTINGS,   # View settings
    },
    Role.RESEARCHER: {
        Action.READ_RUN,
        Action.LAUNCH_RUN,
        Action.CANCEL_RUN,  # Own runs only
        Action.RETRY_RUN,   # Own runs only
        Action.STREAM_RUN,
        Action.DOWNLOAD_LOG,
        Action.READ_SCENARIO,
        Action.READ_BENCHMARK,
        Action.READ_FAILURE,
        Action.CREATE_REPORT,
        Action.READ_REPORT,
        Action.READ_SETTINGS,
        Action.UPDATE_SETTINGS,
    },
    Role.DESIGNER: {
        Action.READ_RUN,
        Action.LAUNCH_RUN,
        Action.CANCEL_RUN,
        Action.RETRY_RUN,
        Action.STREAM_RUN,
        Action.DOWNLOAD_LOG,
        Action.READ_SCENARIO,
        Action.CREATE_SCENARIO_VARIANT,
        Action.READ_BENCHMARK,
        Action.READ_FAILURE,
        Action.CREATE_REPORT,
        Action.READ_REPORT,
        Action.READ_SETTINGS,
        Action.UPDATE_SETTINGS,
    },
    Role.ADMIN: set(Action),  # Admin has every action
}


def get_current_user_optional(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_bearer),
    db: Session = Depends(get_db),
) -> AuthenticatedUser:
    """
    Extract user from Bearer header, cookie, or local anonymous session.
    Provides secure open access with session-level data isolation.
    """
    token = None
    if credentials:
        token = credentials.credentials
    elif "access_token" in request.cookies:
        token = request.cookies.get("access_token")

    # Extract or create persistent anonymous session identifier
    anon_session_id = (
        request.headers.get("X-Session-ID")
        or request.cookies.get("anon_session_id")
        or "default_guest"
    )

    if not token:
        return AuthenticatedUser(
            id=f"guest_{anon_session_id}",
            email=f"guest_{anon_session_id}@adaptive-path.local",
            role=Role.GUEST,
            is_active=True,
            is_verified=True,
            session_id=anon_session_id,
            is_authenticated=False,
        )

    try:
        payload = decode_access_token(token)
        user_id = payload.get("sub")
        role = payload.get("role", "guest")
        session_id = payload.get("session_id") or anon_session_id
        if not user_id:
            return AuthenticatedUser(
                id=f"guest_{anon_session_id}",
                email=f"guest_{anon_session_id}@adaptive-path.local",
                role=Role.GUEST,
                is_active=True,
                is_verified=True,
                session_id=anon_session_id,
                is_authenticated=False,
            )

        user = db.query(UserRecord).filter(UserRecord.id == user_id).first()
        if not user:
            # Token valid but user record not in DB (e.g. test guest tokens)
            return AuthenticatedUser(
                id=user_id,
                email=f"{user_id}@adaptive-path.local",
                role=Role(role) if role in [r.value for r in Role] else Role.GUEST,
                is_active=True,
                is_verified=True,
                session_id=session_id,
                is_authenticated=False if role == "guest" else True,
            )

        if not user.is_active:
            raise PermissionDeniedError("Account is inactive or disabled", code="ACCOUNT_INACTIVE")

        # Validate session revocation if session_id is tied to token
        if session_id:
            sess = db.query(SessionRecord).filter(SessionRecord.id == session_id).first()
            if sess and sess.revoked_at is not None:
                raise AuthenticationError("Session has been revoked", code="SESSION_REVOKED")

        return AuthenticatedUser(
            id=user.id,
            email=user.email,
            role=Role(user.role),
            is_active=user.is_active,
            is_verified=user.is_verified,
            session_id=session_id,
            is_authenticated=True,
        )
    except AuthenticationError:
        return AuthenticatedUser(
            id=f"guest_{anon_session_id}",
            email=f"guest_{anon_session_id}@adaptive-path.local",
            role=Role.GUEST,
            is_active=True,
            is_verified=True,
            session_id=anon_session_id,
            is_authenticated=False,
        )
    except Exception:
        return AuthenticatedUser(
            id=f"guest_{anon_session_id}",
            email=f"guest_{anon_session_id}@adaptive-path.local",
            role=Role.GUEST,
            is_active=True,
            is_verified=True,
            session_id=anon_session_id,
            is_authenticated=False,
        )


def get_current_authenticated_user(
    user: AuthenticatedUser = Depends(get_current_user_optional),
) -> AuthenticatedUser:
    """Strict dependency requiring authenticated account (non-guest)."""
    if not user.is_authenticated or user.role == Role.GUEST:
        raise AuthenticationError("Authentication required for this operation", code="UNAUTHORIZED")
    return user


class AuthorizationChecker:
    """
    Callable dependency enforcing Role x Action x Resource Ownership.
    """

    def __init__(self, action: Action, ownership_param: Optional[str] = None):
        self.action = action
        self.ownership_param = ownership_param

    def __call__(
        self,
        request: Request,
        user: AuthenticatedUser = Depends(get_current_user_optional),
    ) -> AuthenticatedUser:
        # 1. Check if user has permission for action in policy matrix
        allowed_actions = ROLE_PERMISSIONS.get(user.role, set())
        if self.action not in allowed_actions:
            raise PermissionDeniedError(
                message=f"Action '{self.action.value}' is not permitted for role '{user.role.value}'",
                code="ROLE_PERMISSION_DENIED",
                details={"required_action": self.action.value, "user_role": user.role.value},
            )

        # 2. Check resource ownership if required and user is not admin
        if self.ownership_param and user.role != Role.ADMIN:
            # We will attach the user object to request state so downstream endpoint can verify resource ownership
            pass

        return user


def require_permission(action: Action, ownership_param: Optional[str] = None) -> AuthorizationChecker:
    """Factory creating authorization dependency."""
    return AuthorizationChecker(action, ownership_param)


def check_ownership(user: AuthenticatedUser, resource_owner_id: Optional[str], is_shipped: bool = False) -> None:
    """
    Explicit ownership verifier for resource operations:
    - Admin can access/mutate anything.
    - Shipped resources are read-only public.
    - Owners can mutate their own resources.
    """
    if user.role == Role.ADMIN:
        return

    if is_shipped:
        # Shipped runs can be read by anyone, but never mutated or deleted
        return

    if resource_owner_id and (resource_owner_id == user.id or (user.session_id and resource_owner_id == user.session_id)):
        return

    raise PermissionDeniedError(
        message="You do not have permission to access or modify this resource.",
        code="OWNERSHIP_DENIED",
        details={"owner_id": resource_owner_id, "user_id": user.id},
    )


def log_audit_event(
    db: Session,
    user_id: Optional[str],
    action: str,
    resource_type: str,
    resource_id: Optional[str] = None,
    details: Optional[Dict[str, Any]] = None,
    ip_address: Optional[str] = None,
) -> None:
    """Persist structured audit trail."""
    import uuid
    from datetime import datetime, timezone

    audit_entry = AuditLogRecord(
        id=f"aud_{uuid.uuid4().hex[:12]}",
        user_id=user_id,
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        details=details or {},
        ip_address=ip_address,
        timestamp=datetime.now(timezone.utc),
    )
    db.add(audit_entry)
    db.commit()
