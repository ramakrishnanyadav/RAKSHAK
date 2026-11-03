"""
Flaky Test Quarantine Framework.
Rule: Flaky tests are NEVER retried silently. They must be explicitly quarantined
with a tracked ticket, an owner, and a documented root-cause hypothesis.
Quarantined tests are skipped in standard CI blocking gates and executed in a dedicated
quarantine inspection job to prevent pipeline disruption while ensuring visibility.
"""

import functools
import os
import pytest
from typing import Dict, Any, List


class QuarantineRegistry:
    """Audit log of quarantined tests across the test automation suite."""
    _quarantined_tests: List[Dict[str, str]] = []

    @classmethod
    def register(cls, test_name: str, ticket: str, owner: str, reason: str):
        cls._quarantined_tests.append({
            "test_name": test_name,
            "ticket": ticket,
            "owner": owner,
            "reason": reason,
        })

    @classmethod
    def get_all(cls) -> List[Dict[str, str]]:
        return list(cls._quarantined_tests)


def quarantined(ticket: str, owner: str, reason: str):
    """
    Decorator to quarantine a test without silent retries.
    Requires ticket ID (e.g. APATH-404), assigned owner, and reason.
    """
    if not ticket or not owner or not reason:
        raise ValueError("Quarantine requires non-empty ticket, owner, and reason.")

    def decorator(fn):
        test_path = f"{fn.__module__}.{fn.__name__}"
        QuarantineRegistry.register(test_path, ticket, owner, reason)

        # In CI, if RUN_QUARANTINE_SUITE is not set, skip with full defect attribution
        is_quarantine_run = os.environ.get("RUN_QUARANTINE_SUITE", "0") == "1"

        if not is_quarantine_run:
            return pytest.mark.skip(
                reason=f"QUARANTINED [Ticket: {ticket} | Owner: {owner}]: {reason}"
            )(fn)

        @functools.wraps(fn)
        def wrapper(*args, **kwargs):
            return fn(*args, **kwargs)

        return wrapper

    return decorator
