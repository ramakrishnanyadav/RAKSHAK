"""
Pytest Test Fixtures and Application Context.
Provides isolated test database, seeded users across all roles, and authenticated HTTP clients.
"""

import os
import pytest
from pathlib import Path
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

# Force testing configuration
os.environ["APATH_ENVIRONMENT"] = "testing"
os.environ["APATH_STORAGE_DIR"] = "./storage"

from backend.app.config import settings
from backend.app.database import Base, get_db
from backend.app.main import app
from backend.app.models import UserRecord, QuotaRecord, RunRecord, utcnow
from backend.app.core.security import hash_password, create_access_token
from backend.app.core.rate_limit import limiter

TEST_DATABASE_URL = "sqlite:///:memory:"

test_engine = create_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)


@pytest.fixture(scope="session", autouse=True)
def setup_test_db():
    Base.metadata.create_all(bind=test_engine)
    db = TestingSessionLocal()

    # Seed test users
    users = [
        ("test_admin_id", "admin_test@adaptive-path.local", "AdminPass1234!", "admin"),
        ("test_researcher_id", "researcher_test@adaptive-path.local", "ResearchPass1234!", "researcher"),
        ("test_other_researcher_id", "other_test@adaptive-path.local", "OtherPass1234!", "researcher"),
        ("test_designer_id", "designer_test@adaptive-path.local", "DesignPass1234!", "designer"),
    ]

    for uid, email, pw, role in users:
        u = UserRecord(
            id=uid,
            email=email,
            hashed_password=hash_password(pw),
            role=role,
            is_active=True,
            is_verified=True,
        )
        db.add(u)
        db.add(
            QuotaRecord(
                user_id=uid,
                max_concurrent_runs=10,
                daily_run_limit=100,
                runs_today=0,
                last_reset_date=utcnow().strftime("%Y-%m-%d"),
            )
        )

    # Seed one shipped baseline run
    shipped_run = RunRecord(
        id="run_shipped_sample",
        scenario_id="SCENARIO_5_CATTLE_CROSSING",
        planner_id="P3",
        split="tune",
        seed=1000,
        engine_adapter="python",
        status="completed",
        is_shipped=True,
        owner_id="test_researcher_id",
        duration_s=10.5,
        completed_goal=True,
        collision_occurred=False,
        min_clearance_m=1.2,
        mean_speed_m_s=6.8,
        max_jerk_m_s3=1.1,
        replan_count=4,
        p95_latency_ms=12.5,
    )
    db.add(shipped_run)

    # Seed one private run owned by researcher
    private_run = RunRecord(
        id="run_private_sample",
        scenario_id="SCENARIO_1_VILLAGE_ROAD",
        planner_id="B1",
        split="tune",
        seed=1000,
        engine_adapter="python",
        status="completed",
        is_shipped=False,
        owner_id="test_researcher_id",
        duration_s=12.0,
        completed_goal=True,
        collision_occurred=False,
        min_clearance_m=0.8,
        mean_speed_m_s=5.5,
        max_jerk_m_s3=2.1,
        replan_count=0,
        p95_latency_ms=8.0,
    )
    db.add(private_run)
    db.commit()
    db.close()

    yield

    Base.metadata.drop_all(bind=test_engine)


@pytest.fixture
def db_session():
    connection = test_engine.connect()
    transaction = connection.begin()
    session = TestingSessionLocal(bind=connection)

    yield session

    session.close()
    transaction.rollback()
    connection.close()


@pytest.fixture(autouse=True)
def reset_rate_limiter():
    limiter.clear()
    yield
    limiter.clear()


@pytest.fixture
def client(db_session):
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture
def admin_headers():
    token = create_access_token(user_id="test_admin_id", role="admin")
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def researcher_headers():
    token = create_access_token(user_id="test_researcher_id", role="researcher")
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def other_researcher_headers():
    token = create_access_token(user_id="test_other_researcher_id", role="researcher")
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def designer_headers():
    token = create_access_token(user_id="test_designer_id", role="designer")
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def guest_headers():
    token = create_access_token(user_id="guest_user", role="guest")
    return {"Authorization": f"Bearer {token}"}
