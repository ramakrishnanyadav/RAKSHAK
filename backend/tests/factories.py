"""
Backend Test Data Factories.
Generates database records, request schemas, and authorization payloads deterministically.
"""

import uuid
from typing import Dict, Any, Optional
from backend.app.models import UserRecord, QuotaRecord, RunRecord, utcnow
from backend.app.core.security import hash_password, create_access_token


class UserFactory:
    """Creates UserRecord instances with valid Argon2id hashes and quotas."""
    @staticmethod
    def create(
        user_id: Optional[str] = None,
        email: Optional[str] = None,
        password: str = "P@ssword2026!",
        role: str = "researcher",
        is_active: bool = True,
        is_verified: bool = True,
    ) -> UserRecord:
        uid = user_id or f"user_{uuid.uuid4().hex[:12]}"
        mail = email or f"{uid}@adaptive-path.local"
        return UserRecord(
            id=uid,
            email=mail,
            hashed_password=hash_password(password),
            role=role,
            is_active=is_active,
            is_verified=is_verified,
        )


class QuotaFactory:
    """Creates QuotaRecord instances."""
    @staticmethod
    def create(
        user_id: str,
        max_concurrent_runs: int = 5,
        daily_run_limit: int = 50,
        runs_today: int = 0,
    ) -> QuotaRecord:
        return QuotaRecord(
            user_id=user_id,
            max_concurrent_runs=max_concurrent_runs,
            daily_run_limit=daily_run_limit,
            runs_today=runs_today,
            last_reset_date=utcnow().strftime("%Y-%m-%d"),
        )


class RunRecordFactory:
    """Creates database RunRecord rows."""
    @staticmethod
    def create(
        run_id: Optional[str] = None,
        owner_id: str = "test_researcher_id",
        scenario_id: str = "SCENARIO_5_CATTLE_CROSSING",
        planner_id: str = "P3",
        seed: int = 1000,
        split: str = "tune",
        engine_adapter: str = "python",
        status: str = "completed",
        is_shipped: bool = False,
        collision_occurred: bool = False,
        min_clearance_m: float = 1.25,
    ) -> RunRecord:
        rid = run_id or f"run_{uuid.uuid4().hex[:12]}"
        return RunRecord(
            id=rid,
            scenario_id=scenario_id,
            planner_id=planner_id,
            split=split,
            seed=seed,
            engine_adapter=engine_adapter,
            status=status,
            is_shipped=is_shipped,
            owner_id=owner_id,
            duration_s=12.0,
            completed_goal=True,
            collision_occurred=collision_occurred,
            min_clearance_m=min_clearance_m,
            mean_speed_m_s=6.5,
            max_jerk_m_s3=1.1,
            replan_count=3,
            p95_latency_ms=13.5,
        )


class RunRequestFactory:
    """Creates valid simulation submission JSON payloads."""
    @staticmethod
    def create(
        scenario_id: str = "SCENARIO_5_CATTLE_CROSSING",
        planner_id: str = "P3",
        seed: int = 1000,
        split: str = "tune",
        engine_adapter: str = "python",
        custom_params: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        return {
            "scenario_id": scenario_id,
            "planner_id": planner_id,
            "seed": seed,
            "split": split,
            "engine_adapter": engine_adapter,
            "custom_params": custom_params or {},
        }
