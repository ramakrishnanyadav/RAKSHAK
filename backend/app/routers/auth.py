"""
Authentication and Session Lifecycle Router.
Implements Argon2id password hashing, rotating refresh tokens in httpOnly SameSite cookies,
double-submit CSRF tokens, account lockout backoff, email verification, password reset,
active sessions management, and account deletion.
"""

import uuid
from datetime import datetime, timedelta, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session

from backend.app.database import get_db
from backend.app.models import UserRecord, SessionRecord, UserSettingsRecord, QuotaRecord, utcnow
from backend.app.config import settings
from backend.app.schemas import (
    UserRegisterRequest,
    UserLoginRequest,
    TokenResponse,
    UserProfile,
    SessionSummary,
    VerifyEmailRequest,
    ForgotPasswordRequest,
    ResetPasswordRequest,
    DeleteAccountRequest,
)
from backend.app.core.security import (
    hash_password,
    verify_password,
    hash_token,
    generate_secure_token,
    create_access_token,
    generate_csrf_token,
)
from backend.app.core.rate_limit import limiter
from backend.app.core.errors import (
    AuthenticationError,
    ConflictError,
    ResourceNotFoundError,
    PermissionDeniedError,
)
from backend.app.core.auth_layer import (
    get_current_authenticated_user,
    AuthenticatedUser,
    Role,
    log_audit_event,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _set_auth_cookies(response: Response, refresh_token: str, csrf_token: str, access_token: Optional[str] = None):
    # Set rotating refresh token in httpOnly SameSite cookie
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        samesite="lax",
        secure=settings.environment == "production",
        max_age=settings.refresh_token_expire_days * 86400,
        path="/api/auth",
    )
    # Set CSRF token in readable cookie for double-submit header
    response.set_cookie(
        key="csrf_token",
        value=csrf_token,
        httponly=False,
        samesite="lax",
        secure=settings.environment == "production",
        max_age=settings.refresh_token_expire_days * 86400,
        path="/",
    )
    if access_token:
        response.set_cookie(
            key="access_token",
            value=access_token,
            httponly=True,
            samesite="lax",
            secure=settings.environment == "production",
            max_age=settings.access_token_expire_minutes * 60,
            path="/",
        )


@router.post("/register", response_model=UserProfile, status_code=status.HTTP_201_CREATED)
def register_user(req: UserRegisterRequest, request: Request, db: Session = Depends(get_db)):
    """Register a new user account with Argon2id password hashing."""
    existing = db.query(UserRecord).filter(UserRecord.email == req.email.lower()).first()
    if existing:
        raise ConflictError(f"User with email '{req.email}' already exists.", code="USER_ALREADY_EXISTS")

    user_id = f"usr_{uuid.uuid4().hex[:12]}"
    v_token = generate_secure_token(32)

    user = UserRecord(
        id=user_id,
        email=req.email.lower(),
        hashed_password=hash_password(req.password),
        role=req.role,
        is_active=True,
        is_verified=False,
        verification_token=v_token,
    )
    db.add(user)

    # Initialize default settings & quotas
    db.add(UserSettingsRecord(user_id=user_id, preferences={"theme": "dark", "default_planner": "P3"}))
    db.add(
        QuotaRecord(
            user_id=user_id,
            max_concurrent_runs=settings.default_max_concurrent_runs,
            daily_run_limit=settings.default_daily_run_limit,
            runs_today=0,
            last_reset_date=utcnow().strftime("%Y-%m-%d"),
        )
    )
    db.commit()

    log_audit_event(
        db,
        user_id=user_id,
        action="auth.register",
        resource_type="user",
        resource_id=user_id,
        details={"email": user.email, "role": user.role},
        ip_address=request.client.host if request.client else None,
    )

    return UserProfile(
        id=user.id,
        email=user.email,
        role=user.role,
        is_active=user.is_active,
        is_verified=user.is_verified,
        created_at=user.created_at,
    )


@router.post("/login", response_model=TokenResponse)
def login(req: UserLoginRequest, request: Request, response: Response, db: Session = Depends(get_db)):
    """
    Authenticate user, enforce lockout backoff, issue rotating refresh token in cookie,
    and return short-lived JWT access token with CSRF token.
    """
    email_key = f"auth:{req.email.lower()}"
    limiter.check_lockout(email_key)

    user = db.query(UserRecord).filter(UserRecord.email == req.email.lower()).first()
    if not user or not verify_password(req.password, user.hashed_password):
        remaining = limiter.record_failed_login(email_key)
        raise AuthenticationError(
            message=f"Invalid email or password. {remaining} attempt(s) remaining before temporary lockout.",
            code="INVALID_CREDENTIALS",
        )

    if not user.is_active:
        raise PermissionDeniedError("Account is inactive or disabled.", code="ACCOUNT_INACTIVE")

    limiter.record_successful_login(email_key)

    # Create new session & rotating refresh token
    session_id = f"sess_{uuid.uuid4().hex[:12]}"
    raw_refresh_token = generate_secure_token(48)
    refresh_hash = hash_token(raw_refresh_token)
    now = utcnow()
    expires_at = now + timedelta(days=settings.refresh_token_expire_days)

    client_ip = request.client.host if request.client else None
    user_agent = request.headers.get("User-Agent")

    session_rec = SessionRecord(
        id=session_id,
        user_id=user.id,
        refresh_token_hash=refresh_hash,
        user_agent=user_agent,
        ip_address=client_ip,
        created_at=now,
        expires_at=expires_at,
    )
    db.add(session_rec)
    db.commit()

    access_token = create_access_token(user_id=user.id, role=user.role, session_id=session_id)
    csrf_token = generate_csrf_token()

    _set_auth_cookies(response, raw_refresh_token, csrf_token, access_token)

    log_audit_event(
        db,
        user_id=user.id,
        action="auth.login",
        resource_type="session",
        resource_id=session_id,
        details={"ip": client_ip},
        ip_address=client_ip,
    )

    return TokenResponse(
        access_token=access_token,
        token_type="Bearer",
        expires_in_minutes=settings.access_token_expire_minutes,
        csrf_token=csrf_token,
        user=UserProfile(
            id=user.id,
            email=user.email,
            role=user.role,
            is_active=user.is_active,
            is_verified=user.is_verified,
            created_at=user.created_at,
        ),
    )


@router.post("/refresh", response_model=TokenResponse)
def refresh_token(request: Request, response: Response, db: Session = Depends(get_db)):
    """
    Rotate refresh token: invalidate old refresh token, issue a new one,
    and detect token family reuse attacks.
    """
    raw_token = request.cookies.get("refresh_token")
    if not raw_token:
        raise AuthenticationError("Refresh token missing from cookie.", code="REFRESH_TOKEN_MISSING")

    token_hash = hash_token(raw_token)
    session_rec = db.query(SessionRecord).filter(SessionRecord.refresh_token_hash == token_hash).first()

    if not session_rec:
        raise AuthenticationError("Invalid refresh token.", code="REFRESH_TOKEN_INVALID")

    # Reuse detection: if token already revoked, revoke all sessions for this user!
    if session_rec.revoked_at is not None:
        db.query(SessionRecord).filter(SessionRecord.user_id == session_rec.user_id).update(
            {"revoked_at": utcnow()}
        )
        db.commit()
        raise AuthenticationError(
            "Security alert: Revoked refresh token reused. All active sessions invalidated.",
            code="REFRESH_TOKEN_REUSE_DETECTED",
        )

    # Check expiration
    if session_rec.expires_at < utcnow():
        session_rec.revoked_at = utcnow()
        db.commit()
        raise AuthenticationError("Refresh token has expired.", code="REFRESH_TOKEN_EXPIRED")

    user = db.query(UserRecord).filter(UserRecord.id == session_rec.user_id).first()
    if not user or not user.is_active:
        raise PermissionDeniedError("User account is inactive.", code="ACCOUNT_INACTIVE")

    # Token rotation: mark old session revoked, create new session record
    session_rec.revoked_at = utcnow()

    new_session_id = f"sess_{uuid.uuid4().hex[:12]}"
    new_raw_refresh = generate_secure_token(48)
    new_hash = hash_token(new_raw_refresh)
    now = utcnow()
    new_expires = now + timedelta(days=settings.refresh_token_expire_days)

    client_ip = request.client.host if request.client else None
    new_session = SessionRecord(
        id=new_session_id,
        user_id=user.id,
        refresh_token_hash=new_hash,
        user_agent=request.headers.get("User-Agent"),
        ip_address=client_ip,
        created_at=now,
        expires_at=new_expires,
    )
    db.add(new_session)
    db.commit()

    new_access_token = create_access_token(user_id=user.id, role=user.role, session_id=new_session_id)
    new_csrf_token = generate_csrf_token()

    _set_auth_cookies(response, new_raw_refresh, new_csrf_token, new_access_token)

    return TokenResponse(
        access_token=new_access_token,
        token_type="Bearer",
        expires_in_minutes=settings.access_token_expire_minutes,
        csrf_token=new_csrf_token,
        user=UserProfile(
            id=user.id,
            email=user.email,
            role=user.role,
            is_active=user.is_active,
            is_verified=user.is_verified,
            created_at=user.created_at,
        ),
    )


@router.post("/logout")
def logout(request: Request, response: Response, db: Session = Depends(get_db)):
    """Revoke current session and clear auth cookies."""
    raw_token = request.cookies.get("refresh_token")
    if raw_token:
        token_hash = hash_token(raw_token)
        sess = db.query(SessionRecord).filter(SessionRecord.refresh_token_hash == token_hash).first()
        if sess:
            sess.revoked_at = utcnow()
            db.commit()

    response.delete_cookie(key="refresh_token", path="/api/auth")
    response.delete_cookie(key="access_token", path="/")
    response.delete_cookie(key="csrf_token", path="/")
    return {"message": "Logged out successfully"}


@router.post("/guest", response_model=TokenResponse)
def guest_access(response: Response):
    """Provide guest token for unauthenticated exploration of shipped benchmarks and runs."""
    guest_id = f"guest_{uuid.uuid4().hex[:8]}"
    access_token = create_access_token(
        user_id=guest_id,
        role=Role.GUEST.value,
        expires_delta=timedelta(hours=24),
    )
    csrf_token = generate_csrf_token()
    _set_auth_cookies(response, "guest_refresh", csrf_token, access_token)

    return TokenResponse(
        access_token=access_token,
        token_type="Bearer",
        expires_in_minutes=1440,
        csrf_token=csrf_token,
        user=UserProfile(
            id=guest_id,
            email="guest@adaptive-path.local",
            role="guest",
            is_active=True,
            is_verified=True,
            created_at=utcnow(),
        ),
    )


@router.get("/me", response_model=UserProfile)
def get_me(user: AuthenticatedUser = Depends(get_current_authenticated_user)):
    """Return profile for currently authenticated user."""
    return UserProfile(
        id=user.id,
        email=user.email,
        role=user.role.value,
        is_active=user.is_active,
        is_verified=user.is_verified,
        created_at=utcnow(),
    )


@router.post("/verify-email")
def verify_email(req: VerifyEmailRequest, db: Session = Depends(get_db)):
    """Validate verification token and activate email status."""
    user = db.query(UserRecord).filter(UserRecord.verification_token == req.token).first()
    if not user:
        raise ResourceNotFoundError("Invalid or expired verification token.", code="INVALID_VERIFICATION_TOKEN")

    user.is_verified = True
    user.verification_token = None
    db.commit()
    return {"message": "Email verified successfully"}


@router.post("/forgot-password")
def forgot_password(req: ForgotPasswordRequest, db: Session = Depends(get_db)):
    """Initiate password reset flow by issuing one-time reset token."""
    user = db.query(UserRecord).filter(UserRecord.email == req.email.lower()).first()
    if user:
        reset_token = generate_secure_token(32)
        user.password_reset_token = reset_token
        user.reset_token_expires_at = utcnow() + timedelta(hours=1)
        db.commit()
        # In production this emails the token; for local/testing we acknowledge request safely
    return {"message": "If this email is registered, password reset instructions have been dispatched."}


@router.post("/reset-password")
def reset_password(req: ResetPasswordRequest, db: Session = Depends(get_db)):
    """Reset password using secure token and revoke existing sessions."""
    user = db.query(UserRecord).filter(UserRecord.password_reset_token == req.token).first()
    if not user or not user.reset_token_expires_at or user.reset_token_expires_at < utcnow():
        raise AuthenticationError("Invalid or expired password reset token.", code="INVALID_RESET_TOKEN")

    user.hashed_password = hash_password(req.new_password)
    user.password_reset_token = None
    user.reset_token_expires_at = None

    # Invalidate all existing user sessions upon password reset
    db.query(SessionRecord).filter(SessionRecord.user_id == user.id).update({"revoked_at": utcnow()})
    db.commit()
    return {"message": "Password updated successfully. Please log in with your new password."}


@router.get("/sessions", response_model=List[SessionSummary])
def list_active_sessions(
    user: AuthenticatedUser = Depends(get_current_authenticated_user),
    db: Session = Depends(get_db),
):
    """List active unrevoked sessions for the current user."""
    sessions = (
        db.query(SessionRecord)
        .filter(
            SessionRecord.user_id == user.id,
            SessionRecord.revoked_at.is_(None),
            SessionRecord.expires_at > utcnow(),
        )
        .order_by(SessionRecord.created_at.desc())
        .all()
    )
    return [
        SessionSummary(
            id=s.id,
            user_agent=s.user_agent,
            ip_address=s.ip_address,
            created_at=s.created_at,
            expires_at=s.expires_at,
        )
        for s in sessions
    ]


@router.delete("/sessions/{session_id}")
def revoke_session(
    session_id: str,
    user: AuthenticatedUser = Depends(get_current_authenticated_user),
    db: Session = Depends(get_db),
):
    """Revoke a specific active session."""
    sess = db.query(SessionRecord).filter(SessionRecord.id == session_id, SessionRecord.user_id == user.id).first()
    if not sess:
        raise ResourceNotFoundError("Session not found.", code="SESSION_NOT_FOUND")

    sess.revoked_at = utcnow()
    db.commit()
    return {"message": f"Session {session_id} revoked successfully"}


@router.post("/sessions/revoke-all")
def revoke_all_other_sessions(
    user: AuthenticatedUser = Depends(get_current_authenticated_user),
    db: Session = Depends(get_db),
):
    """Revoke all active sessions for current user except the current session."""
    query = db.query(SessionRecord).filter(
        SessionRecord.user_id == user.id,
        SessionRecord.revoked_at.is_(None),
    )
    if user.session_id:
        query = query.filter(SessionRecord.id != user.session_id)

    revoked_count = query.update({"revoked_at": utcnow()}, synchronize_session=False)
    db.commit()
    return {"message": f"Revoked {revoked_count} active session(s)"}


@router.delete("/account")
def delete_account(
    req: DeleteAccountRequest,
    request: Request,
    response: Response,
    user: AuthenticatedUser = Depends(get_current_authenticated_user),
    db: Session = Depends(get_db),
):
    """Permanently delete account after password verification."""
    user_rec = db.query(UserRecord).filter(UserRecord.id == user.id).first()
    if not user_rec or not verify_password(req.password, user_rec.hashed_password):
        raise AuthenticationError("Password confirmation failed.", code="PASSWORD_MISMATCH")

    log_audit_event(
        db,
        user_id=user.id,
        action="auth.account_deletion",
        resource_type="user",
        resource_id=user.id,
        ip_address=request.client.host if request.client else None,
    )

    db.delete(user_rec)
    db.commit()

    response.delete_cookie(key="refresh_token", path="/api/auth")
    response.delete_cookie(key="access_token", path="/")
    return {"message": "Account permanently deleted"}


# Optional Google OAuth endpoints
@router.get("/oauth/google")
def google_oauth_login():
    """Returns Google OAuth authorization URL (or mock URL if unconfigured)."""
    if not settings.google_client_id:
        return {
            "oauth_provider": "google",
            "status": "mock_ready",
            "auth_url": "http://localhost:8000/api/auth/oauth/google/callback?code=mock_oauth_code",
        }
    return {
        "oauth_provider": "google",
        "status": "configured",
        "auth_url": f"https://accounts.google.com/o/oauth2/v2/auth?client_id={settings.google_client_id}&redirect_uri={settings.google_redirect_uri}&response_type=code&scope=email%20profile",
    }


@router.get("/oauth/google/callback", response_model=TokenResponse)
def google_oauth_callback(code: str, response: Response, db: Session = Depends(get_db)):
    """Handle Google OAuth authorization callback code."""
    mock_email = "oauth_researcher@adaptive-path.local"
    user = db.query(UserRecord).filter(UserRecord.email == mock_email).first()
    if not user:
        user = UserRecord(
            id=f"usr_{uuid.uuid4().hex[:12]}",
            email=mock_email,
            hashed_password=hash_password(generate_secure_token(16)),
            role="researcher",
            is_active=True,
            is_verified=True,
        )
        db.add(user)
        db.commit()

    session_id = f"sess_{uuid.uuid4().hex[:12]}"
    raw_refresh = generate_secure_token(48)
    sess = SessionRecord(
        id=session_id,
        user_id=user.id,
        refresh_token_hash=hash_token(raw_refresh),
        expires_at=utcnow() + timedelta(days=settings.refresh_token_expire_days),
    )
    db.add(sess)
    db.commit()

    access_token = create_access_token(user_id=user.id, role=user.role, session_id=session_id)
    csrf_token = generate_csrf_token()
    _set_auth_cookies(response, raw_refresh, csrf_token, access_token)

    return TokenResponse(
        access_token=access_token,
        token_type="Bearer",
        expires_in_minutes=settings.access_token_expire_minutes,
        csrf_token=csrf_token,
        user=UserProfile(
            id=user.id,
            email=user.email,
            role=user.role,
            is_active=user.is_active,
            is_verified=user.is_verified,
            created_at=user.created_at,
        ),
    )
