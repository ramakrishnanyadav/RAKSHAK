"""
SQLAlchemy ORM Models for ADAPTIVE-PATH Studio.
Covers Users, Sessions, Quotas, Scenarios, Runs, Audit Logs, and Reports.
"""

from datetime import datetime, timezone
from sqlalchemy import (
    Column,
    String,
    Integer,
    Float,
    Boolean,
    DateTime,
    Text,
    JSON,
    ForeignKey,
    Index,
)
from sqlalchemy.orm import relationship
from .database import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


class UserRecord(Base):
    __tablename__ = "users"

    id = Column(String(64), primary_key=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    role = Column(String(32), default="researcher", index=True, nullable=False)  # guest, researcher, designer, admin
    is_active = Column(Boolean, default=True, nullable=False)
    is_verified = Column(Boolean, default=False, nullable=False)
    verification_token = Column(String(255), nullable=True)
    password_reset_token = Column(String(255), nullable=True)
    reset_token_expires_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=utcnow, nullable=False)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow, nullable=False)

    # Relationships
    sessions = relationship("SessionRecord", back_populates="user", cascade="all, delete-orphan")
    settings = relationship("UserSettingsRecord", back_populates="user", uselist=False, cascade="all, delete-orphan")
    quota = relationship("QuotaRecord", back_populates="user", uselist=False, cascade="all, delete-orphan")
    runs = relationship("RunRecord", back_populates="owner")


class SessionRecord(Base):
    __tablename__ = "sessions"

    id = Column(String(64), primary_key=True)
    user_id = Column(String(64), ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    refresh_token_hash = Column(String(128), index=True, nullable=False)
    user_agent = Column(String(512), nullable=True)
    ip_address = Column(String(64), nullable=True)
    expires_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime, default=utcnow, nullable=False)
    revoked_at = Column(DateTime, nullable=True)

    user = relationship("UserRecord", back_populates="sessions")


class UserSettingsRecord(Base):
    __tablename__ = "user_settings"

    user_id = Column(String(64), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    preferences = Column(JSON, default=dict, nullable=False)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow, nullable=False)

    user = relationship("UserRecord", back_populates="settings")


class QuotaRecord(Base):
    __tablename__ = "quotas"

    user_id = Column(String(64), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    max_concurrent_runs = Column(Integer, default=3, nullable=False)
    daily_run_limit = Column(Integer, default=100, nullable=False)
    runs_today = Column(Integer, default=0, nullable=False)
    last_reset_date = Column(String(10), default=lambda: utcnow().strftime("%Y-%m-%d"), nullable=False)

    user = relationship("UserRecord", back_populates="quota")


class ScenarioRecord(Base):
    __tablename__ = "scenarios"

    id = Column(String(128), primary_key=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, default="", nullable=False)
    is_variant = Column(Boolean, default=False, index=True, nullable=False)
    base_scenario_id = Column(String(128), nullable=True, index=True)
    config_json = Column(JSON, default=dict, nullable=False)
    created_by = Column(String(64), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, default=utcnow, nullable=False)


class RunRecord(Base):
    __tablename__ = "runs"

    id = Column(String(128), primary_key=True, index=True)
    idempotency_key = Column(String(128), unique=True, index=True, nullable=True)
    owner_id = Column(String(64), ForeignKey("users.id", ondelete="SET NULL"), index=True, nullable=True)
    scenario_id = Column(String(128), index=True, nullable=False)
    planner_id = Column(String(32), index=True, nullable=False)
    split = Column(String(32), index=True, default="tune", nullable=False)
    seed = Column(Integer, nullable=False)
    engine_adapter = Column(String(32), default="python", nullable=False)
    status = Column(String(32), default="queued", index=True, nullable=False)  # queued, running, completed, failed, cancelled
    retry_count = Column(Integer, default=0, nullable=False)
    max_retries = Column(Integer, default=2, nullable=False)
    cancel_requested = Column(Boolean, default=False, nullable=False)
    config_hash = Column(String(128), index=True, nullable=True)
    is_shipped = Column(Boolean, default=False, index=True, nullable=False)
    created_at = Column(DateTime, default=utcnow, index=True, nullable=False)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow, nullable=False)

    # Metrics summary
    duration_s = Column(Float, default=0.0, nullable=False)
    completed_goal = Column(Boolean, default=False, nullable=False)
    collision_occurred = Column(Boolean, default=False, nullable=False)
    min_clearance_m = Column(Float, default=0.0, nullable=False)
    mean_speed_m_s = Column(Float, default=0.0, nullable=False)
    max_jerk_m_s3 = Column(Float, default=0.0, nullable=False)
    replan_count = Column(Integer, default=0, nullable=False)
    p95_latency_ms = Column(Float, default=0.0, nullable=False)
    failure_tag = Column(String(128), nullable=True, index=True)

    log_path = Column(String(512), nullable=True)

    owner = relationship("UserRecord", back_populates="runs")


# Composite index for lightning-fast benchmark aggregation queries (avoids table scans)
Index("ix_runs_benchmark_lookup", RunRecord.scenario_id, RunRecord.planner_id, RunRecord.split, RunRecord.status)


class AuditLogRecord(Base):
    __tablename__ = "audit_logs"

    id = Column(String(64), primary_key=True)
    user_id = Column(String(64), ForeignKey("users.id", ondelete="SET NULL"), index=True, nullable=True)
    action = Column(String(64), index=True, nullable=False)  # auth.login, run.launch, run.cancel, admin.role_update
    resource_type = Column(String(64), index=True, nullable=False)  # user, run, scenario, quota
    resource_id = Column(String(128), nullable=True)
    details = Column(JSON, default=dict, nullable=False)
    ip_address = Column(String(64), nullable=True)
    timestamp = Column(DateTime, default=utcnow, index=True, nullable=False)


class ReportRecord(Base):
    __tablename__ = "reports"

    id = Column(String(64), primary_key=True)
    title = Column(String(255), nullable=False)
    author_id = Column(String(64), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    scenario_ids = Column(JSON, default=list, nullable=False)
    planner_ids = Column(JSON, default=list, nullable=False)
    summary_markdown = Column(Text, default="", nullable=False)
    data_json = Column(JSON, default=dict, nullable=False)
    created_at = Column(DateTime, default=utcnow, index=True, nullable=False)
