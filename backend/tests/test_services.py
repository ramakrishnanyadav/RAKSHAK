"""
Unit Tests for Core Backend Services:
- Argon2id password hashing and constant-time verification
- JWT token encoding, decoding, and expiration enforcement
- CSRF token double-submit generation and verification
- Rate limiting sliding windows and account lockout backoff
- Engine adapters (Python reference and MATLAB RoadRunner batch)
"""

import time
import pytest
from datetime import timedelta

from backend.app.core.security import (
    hash_password,
    verify_password,
    create_access_token,
    decode_access_token,
    hash_token,
    generate_secure_token,
    generate_csrf_token,
    verify_csrf_token,
)
from backend.app.core.rate_limit import SecurityRateLimiter
from backend.app.core.errors import AuthenticationError, AccountLockedError, AppException
from backend.app.adapters.python_adapter import PythonEngineAdapter
from backend.app.adapters.matlab_adapter import MatlabRoadrunnerAdapter
from backend.app.adapters.base import SimulationCancelledException
from backend.app.adapters import get_adapter


def test_argon2id_password_hashing():
    pw = "SuperSecureP@ss1234"
    h = hash_password(pw)
    assert h.startswith("$argon2id$")
    assert verify_password(pw, h) is True
    assert verify_password("WrongPassword!", h) is False
    assert verify_password("", h) is False


def test_jwt_token_lifecycle():
    token = create_access_token(user_id="user_123", role="researcher", session_id="sess_abc")
    payload = decode_access_token(token)
    assert payload["sub"] == "user_123"
    assert payload["role"] == "researcher"
    assert payload["session_id"] == "sess_abc"
    assert payload["type"] == "access"

    # Expired token test
    expired_token = create_access_token(
        user_id="user_123",
        role="researcher",
        expires_delta=timedelta(seconds=-10),
    )
    with pytest.raises(AuthenticationError) as exc_info:
        decode_access_token(expired_token)
    assert exc_info.value.code == "TOKEN_EXPIRED"


def test_csrf_token_verification():
    csrf1 = generate_csrf_token()
    csrf2 = generate_csrf_token()

    assert len(csrf1) == 64
    assert csrf1 != csrf2
    assert verify_csrf_token(csrf1, csrf1) is True
    assert verify_csrf_token(csrf1, csrf2) is False
    assert verify_csrf_token(None, csrf1) is False
    assert verify_csrf_token(csrf1, None) is False


def test_rate_limiter_and_lockout_backoff():
    limiter = SecurityRateLimiter()
    key = "user:lockout_test@adaptive-path.local"

    # Initial attempts should decrement remaining
    rem4 = limiter.record_failed_login(key)
    assert rem4 == 4
    rem3 = limiter.record_failed_login(key)
    assert rem3 == 3
    rem2 = limiter.record_failed_login(key)
    assert rem2 == 2
    rem1 = limiter.record_failed_login(key)
    assert rem1 == 1

    # 5th attempt triggers lockout
    with pytest.raises(AccountLockedError):
        limiter.record_failed_login(key)

    # Check lockout active
    with pytest.raises(AccountLockedError):
        limiter.check_lockout(key)

    # Successful login clears lockout
    limiter.record_successful_login(key)
    limiter.check_lockout(key)  # Does not raise


def test_rate_limiter_sliding_window():
    limiter = SecurityRateLimiter()
    ip_key = "ip:192.168.1.50"

    # Up to limit
    for _ in range(5):
        limiter.check_rate_limit(ip_key, max_requests=5, window_seconds=60)

    # Exceed limit
    with pytest.raises(AppException) as exc_info:
        limiter.check_rate_limit(ip_key, max_requests=5, window_seconds=60)
    assert exc_info.value.status_code == 429
    assert exc_info.value.code == "RATE_LIMIT_EXCEEDED"


def test_python_engine_adapter_execution():
    adapter = PythonEngineAdapter()
    progress_reports = []

    def on_prog(f, msg, telem):
        progress_reports.append((f, msg))

    log = adapter.execute(
        scenario_id="SCENARIO_5_CATTLE_CROSSING",
        planner_id="P3",
        seed=1000,
        split="tune",
        on_progress=on_prog,
    )

    assert log.schema_version == "apath-log/v1"
    assert log.scenario.id == "SCENARIO_5_CATTLE_CROSSING"
    assert log.planner.id == "P3"
    assert len(log.frames) > 0
    assert log.metrics.duration_s > 0
    assert len(progress_reports) > 0


def test_python_engine_adapter_cancellation():
    adapter = PythonEngineAdapter()

    # Cancel immediately
    with pytest.raises(SimulationCancelledException):
        adapter.execute(
            scenario_id="SCENARIO_5_CATTLE_CROSSING",
            planner_id="P3",
            seed=1000,
            split="tune",
            is_cancelled=lambda: True,
        )


def test_matlab_adapter_fallback():
    adapter = MatlabRoadrunnerAdapter()
    assert adapter.adapter_name == "matlab_roadrunner"
    ctx = adapter.prepare(
        scenario_id="SCENARIO_5_CATTLE_CROSSING",
        planner_id="P3",
        seed=1000,
        split="tune",
    )
    handle = adapter.start(ctx)
    events = list(adapter.stream_progress(handle))
    assert len(events) > 0
    log = adapter.collect_logs(handle)
    assert log.engine.name in ["matlab_roadrunner", "matlab_roadrunner_batch"]
    assert len(log.frames) > 0
