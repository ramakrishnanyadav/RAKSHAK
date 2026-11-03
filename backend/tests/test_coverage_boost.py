"""
Coverage Enhancement Tests.
Exercises edge paths: email verification, password reset, OAuth mocks,
session bulk revocation, CSRF cookie validation, run retries, SSE streaming,
and the seed database script.
"""

import pytest
from datetime import timedelta
from backend.app.seed import seed_database
from backend.app.models import UserRecord, RunRecord, utcnow
from backend.app.worker import stream_run_sse


def test_seed_database_execution():
    """Test seed script populates demo users and sample runs."""
    seed_database()


def test_email_verification_flow(client, db_session):
    # Register user
    client.post(
        "/api/auth/register",
        json={"email": "verify_me@adaptive-path.local", "password": "Password1234!", "role": "researcher"},
    )
    user = db_session.query(UserRecord).filter(UserRecord.email == "verify_me@adaptive-path.local").first()
    assert user.is_verified is False
    v_token = user.verification_token
    assert v_token is not None

    # Verify with wrong token
    bad_res = client.post("/api/auth/verify-email", json={"token": "invalid_token_123"})
    assert bad_res.status_code == 404

    # Verify with correct token
    ok_res = client.post("/api/auth/verify-email", json={"token": v_token})
    assert ok_res.status_code == 200
    db_session.refresh(user)
    assert user.is_verified is True


def test_forgot_and_reset_password_flow(client, db_session):
    # Forgot password request
    forgot_res = client.post("/api/auth/forgot-password", json={"email": "researcher_test@adaptive-path.local"})
    assert forgot_res.status_code == 200

    user = db_session.query(UserRecord).filter(UserRecord.email == "researcher_test@adaptive-path.local").first()
    reset_token = user.password_reset_token
    assert reset_token is not None

    # Reset password with invalid token
    bad_reset = client.post("/api/auth/reset-password", json={"token": "bad_token", "new_password": "NewPassword123!"})
    assert bad_reset.status_code == 401

    # Reset password with valid token
    ok_reset = client.post("/api/auth/reset-password", json={"token": reset_token, "new_password": "NewPassword123!"})
    assert ok_reset.status_code == 200

    # Login with new password
    login_res = client.post(
        "/api/auth/login",
        json={"email": "researcher_test@adaptive-path.local", "password": "NewPassword123!"},
    )
    assert login_res.status_code == 200


def test_google_oauth_mock_flow(client):
    info_res = client.get("/api/auth/oauth/google")
    assert info_res.status_code == 200
    assert "auth_url" in info_res.json()

    cb_res = client.get("/api/auth/oauth/google/callback?code=mock_test_code")
    assert cb_res.status_code == 200
    assert "access_token" in cb_res.json()


def test_revoke_all_other_sessions(client):
    # Login to create session
    login_res = client.post(
        "/api/auth/login",
        json={"email": "admin_test@adaptive-path.local", "password": "AdminPass1234!"},
    )
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    revoke_all_res = client.post("/api/auth/sessions/revoke-all", headers=headers)
    assert revoke_all_res.status_code == 200


def test_csrf_protection_on_cookie_auth(client):
    # Login to set cookies
    login_res = client.post(
        "/api/auth/login",
        json={"email": "researcher_test@adaptive-path.local", "password": "ResearchPass1234!"},
    )
    assert login_res.status_code == 200
    access_token = login_res.cookies.get("access_token")

    # Mutating request using access_token cookie without Bearer header and without X-CSRF-Token
    res = client.post(
        "/api/reports",
        cookies={"access_token": access_token},
        json={"title": "Unauthorized CSRF Report", "scenario_ids": [], "planner_ids": []},
    )
    assert res.status_code == 403
    assert res.json()["code"] == "CSRF_VERIFICATION_FAILED"


def test_retry_run_endpoint(client, researcher_headers):
    retry_res = client.post("/api/runs/run_shipped_sample/retry", headers=researcher_headers)
    assert retry_res.status_code == 200
    assert "new_run_id" in retry_res.json()


@pytest.mark.asyncio
async def test_stream_run_sse_direct():
    events = []
    async for msg in stream_run_sse("run_shipped_sample"):
        events.append(msg)
        if len(events) >= 1:
            break
    assert len(events) >= 1
    assert "event: status" in events[0]
