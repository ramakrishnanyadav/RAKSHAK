"""
Rate Limiting and Account Lockout Backoff Manager.
Provides thread-safe in-memory tracking of request rates and failed authentication attempts,
with exponential lockout penalties to defend against brute-force and credential stuffing.
"""

import time
from collections import defaultdict
from typing import Dict, Tuple, Optional
from threading import Lock

from backend.app.config import settings
from backend.app.core.errors import AccountLockedError, AppException


class SecurityRateLimiter:
    def __init__(self):
        self._lock = Lock()
        # Track failed logins: key -> [timestamp, timestamp, ...]
        self._failed_logins: Dict[str, list[float]] = defaultdict(list)
        # Track locked keys: key -> lock_until_timestamp
        self._lockouts: Dict[str, float] = {}
        # General sliding window rate limiter: key -> [timestamp, ...]
        self._requests: Dict[str, list[float]] = defaultdict(list)

    def check_lockout(self, key: str) -> None:
        """Raise AccountLockedError if key is currently locked out."""
        with self._lock:
            now = time.time()
            if key in self._lockouts:
                until = self._lockouts[key]
                if now < until:
                    remaining = int(until - now)
                    raise AccountLockedError(
                        message=f"Too many failed login attempts. Locked for another {remaining} seconds.",
                        lock_time_s=remaining,
                    )
                else:
                    # Lock expired
                    del self._lockouts[key]

    def record_failed_login(self, key: str) -> int:
        """
        Record failed attempt and trigger lockout if threshold is exceeded.
        Returns remaining attempts before lockout.
        """
        with self._lock:
            now = time.time()
            # Retain attempts within last 15 minutes
            cutoff = now - 900
            self._failed_logins[key] = [t for t in self._failed_logins[key] if t > cutoff]
            self._failed_logins[key].append(now)

            failures = len(self._failed_logins[key])
            if failures >= settings.max_login_attempts:
                # Exponential backoff: base lockout multiplied by escalation factor
                multiplier = 1 if failures == settings.max_login_attempts else 3
                lock_duration = settings.lockout_duration_seconds * multiplier
                self._lockouts[key] = now + lock_duration
                raise AccountLockedError(
                    message=f"Maximum login attempts exceeded ({failures}). Account locked for {lock_duration} seconds.",
                    lock_time_s=lock_duration,
                )
            return settings.max_login_attempts - failures

    def record_successful_login(self, key: str) -> None:
        """Clear failed attempts upon successful authentication."""
        with self._lock:
            self._failed_logins.pop(key, None)
            self._lockouts.pop(key, None)

    def check_rate_limit(self, key: str, max_requests: int = 120, window_seconds: int = 60) -> None:
        """Sliding-window request rate limiter."""
        with self._lock:
            now = time.time()
            cutoff = now - window_seconds
            self._requests[key] = [t for t in self._requests[key] if t > cutoff]

            if len(self._requests[key]) >= max_requests:
                raise AppException(
                    status_code=429,
                    code="RATE_LIMIT_EXCEEDED",
                    message="Request rate limit exceeded. Please throttle your requests.",
                    details={"limit": max_requests, "window_seconds": window_seconds},
                )
            self._requests[key].append(now)

    def clear(self) -> None:
        """Reset state (useful for tests)."""
        with self._lock:
            self._failed_logins.clear()
            self._lockouts.clear()
            self._requests.clear()


limiter = SecurityRateLimiter()
