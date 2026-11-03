"""
Authentication & Session Lifecycle API Tests.
Verifies registration, login, cookie setting, token rotation, lockout backoff,
session management, and account deletion.
"""

import pytest
from backend.app.models import UserRecord, SessionRecord


def test_register_new_user(client):
    res = client.post(
        "/api/auth/register",
        json={"email": "new_user@adaptive-path.local", "password": "SecurePassword123!", "role": "researcher"},
    )
    assert res.status_code == 201
    data = res.json()
    assert data["email"] == "new_user@adaptive-path.local"
    assert data["role"] == "researcher"
    assert data["is_active"] is True
    assert data["is_verified"] is False


def test_register_duplicate_email_conflict(client):
    res = client.post(
        "/api/auth/register",
        json={"email": "researcher_test@adaptive-path.local", "password": "SecurePassword123!", "role": "researcher"},
    )
    assert res.status_code == 409
    data = res.json()
    assert data["code"] == "USER_ALREADY_EXISTS"


def test_login_success_and_cookies(client):
    res = client.post(
        "/api/auth/login",
        json={"email": "researcher_test@adaptive-path.local", "password": "ResearchPass1234!"},
    )
    assert res.status_code == 200
    data = res.json()
    assert "access_token" in data
    assert data["token_type"] == "Bearer"
    assert "csrf_token" in data
    assert data["user"]["email"] == "researcher_test@adaptive-path.local"

    # Verify cookies
    assert "refresh_token" in res.cookies
    assert "csrf_token" in res.cookies
    assert "access_token" in res.cookies


def test_login_invalid_password_and_lockout(client):
    # 4 bad attempts
    for _ in range(4):
        res = client.post(
            "/api/auth/login",
            json={"email": "researcher_test@adaptive-path.local", "password": "WrongPassword!"},
        )
        assert res.status_code == 401
        assert res.json()["code"] == "INVALID_CREDENTIALS"

    # 5th attempt triggers lockout
    res = client.post(
        "/api/auth/login",
        json={"email": "researcher_test@adaptive-path.local", "password": "WrongPassword!"},
    )
    assert res.status_code == 429
    assert res.json()["code"] == "ACCOUNT_LOCKED"


def test_refresh_token_rotation_and_reuse_detection(client):
    # 1. Login to get cookies
    login_res = client.post(
        "/api/auth/login",
        json={"email": "researcher_test@adaptive-path.local", "password": "ResearchPass1234!"},
    )
    assert login_res.status_code == 200
    first_refresh = login_res.cookies.get("refresh_token")

    # 2. Call refresh
    refresh_res = client.post(
        "/api/auth/refresh",
        cookies={"refresh_token": first_refresh},
    )
    assert refresh_res.status_code == 200
    second_refresh = refresh_res.cookies.get("refresh_token")
    assert second_refresh != first_refresh

    # 3. Reuse old refresh token (first_refresh) -> triggers reuse detection & revokes family
    reuse_res = client.post(
        "/api/auth/refresh",
        cookies={"refresh_token": first_refresh},
    )
    assert reuse_res.status_code == 401
    assert reuse_res.json()["code"] == "REFRESH_TOKEN_REUSE_DETECTED"


def test_guest_access(client):
    res = client.post("/api/auth/guest")
    assert res.status_code == 200
    data = res.json()
    assert data["user"]["role"] == "guest"
    assert "access_token" in data


def test_me_endpoint(client, researcher_headers):
    res = client.get("/api/auth/me", headers=researcher_headers)
    assert res.status_code == 200
    assert res.json()["email"] == "researcher_test@adaptive-path.local"


def test_sessions_management(client):
    # Login
    login_res = client.post(
        "/api/auth/login",
        json={"email": "researcher_test@adaptive-path.local", "password": "ResearchPass1234!"},
    )
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # List sessions
    sess_res = client.get("/api/auth/sessions", headers=headers)
    assert sess_res.status_code == 200
    sessions = sess_res.json()
    assert len(sessions) >= 1
    session_id = sessions[0]["id"]

    # Revoke single session
    del_res = client.delete(f"/api/auth/sessions/{session_id}", headers=headers)
    assert del_res.status_code == 200


def test_account_deletion_with_password(client):
    # Register disposable user
    client.post(
        "/api/auth/register",
        json={"email": "disposable@adaptive-path.local", "password": "Disposable1234!", "role": "researcher"},
    )
    login_res = client.post(
        "/api/auth/login",
        json={"email": "disposable@adaptive-path.local", "password": "Disposable1234!"},
    )
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Delete with wrong password
    del_fail = client.request(
        "DELETE",
        "/api/auth/account",
        headers=headers,
        json={"password": "WrongPassword!"},
    )
    assert del_fail.status_code == 401

    # Delete with correct password
    del_ok = client.request(
        "DELETE",
        "/api/auth/account",
        headers=headers,
        json={"password": "Disposable1234!"},
    )
    assert del_ok.status_code == 200
    assert del_ok.json()["message"] == "Account permanently deleted"
