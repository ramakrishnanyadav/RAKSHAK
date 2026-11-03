"""initial schema for adaptive-path studio

Revision ID: 0001_initial_schema
Revises: 
Create Date: 2026-10-14 00:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "0001_initial_schema"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.String(length=64), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("hashed_password", sa.String(length=255), nullable=False),
        sa.Column("role", sa.String(length=32), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("is_verified", sa.Boolean(), nullable=False),
        sa.Column("verification_token", sa.String(length=255), nullable=True),
        sa.Column("password_reset_token", sa.String(length=255), nullable=True),
        sa.Column("reset_token_expires_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=True)
    op.create_index("ix_users_role", "users", ["role"], unique=False)

    op.create_table(
        "sessions",
        sa.Column("id", sa.String(length=64), nullable=False),
        sa.Column("user_id", sa.String(length=64), nullable=False),
        sa.Column("refresh_token_hash", sa.String(length=128), nullable=False),
        sa.Column("user_agent", sa.String(length=512), nullable=True),
        sa.Column("ip_address", sa.String(length=64), nullable=True),
        sa.Column("expires_at", sa.DateTime(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("revoked_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_sessions_user_id", "sessions", ["user_id"], unique=False)
    op.create_index("ix_sessions_refresh_token_hash", "sessions", ["refresh_token_hash"], unique=False)

    op.create_table(
        "user_settings",
        sa.Column("user_id", sa.String(length=64), nullable=False),
        sa.Column("preferences", sa.JSON(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("user_id"),
    )

    op.create_table(
        "quotas",
        sa.Column("user_id", sa.String(length=64), nullable=False),
        sa.Column("max_concurrent_runs", sa.Integer(), nullable=False),
        sa.Column("daily_run_limit", sa.Integer(), nullable=False),
        sa.Column("runs_today", sa.Integer(), nullable=False),
        sa.Column("last_reset_date", sa.String(length=10), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("user_id"),
    )

    op.create_table(
        "scenarios",
        sa.Column("id", sa.String(length=128), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("is_variant", sa.Boolean(), nullable=False),
        sa.Column("base_scenario_id", sa.String(length=128), nullable=True),
        sa.Column("config_json", sa.JSON(), nullable=False),
        sa.Column("created_by", sa.String(length=64), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_scenarios_is_variant", "scenarios", ["is_variant"], unique=False)
    op.create_index("ix_scenarios_base_scenario_id", "scenarios", ["base_scenario_id"], unique=False)

    op.create_table(
        "runs",
        sa.Column("id", sa.String(length=128), nullable=False),
        sa.Column("idempotency_key", sa.String(length=128), nullable=True),
        sa.Column("owner_id", sa.String(length=64), nullable=True),
        sa.Column("scenario_id", sa.String(length=128), nullable=False),
        sa.Column("planner_id", sa.String(length=32), nullable=False),
        sa.Column("split", sa.String(length=32), nullable=False),
        sa.Column("seed", sa.Integer(), nullable=False),
        sa.Column("engine_adapter", sa.String(length=32), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("retry_count", sa.Integer(), nullable=False),
        sa.Column("max_retries", sa.Integer(), nullable=False),
        sa.Column("cancel_requested", sa.Boolean(), nullable=False),
        sa.Column("config_hash", sa.String(length=128), nullable=True),
        sa.Column("is_shipped", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.Column("duration_s", sa.Float(), nullable=False),
        sa.Column("completed_goal", sa.Boolean(), nullable=False),
        sa.Column("collision_occurred", sa.Boolean(), nullable=False),
        sa.Column("min_clearance_m", sa.Float(), nullable=False),
        sa.Column("mean_speed_m_s", sa.Float(), nullable=False),
        sa.Column("max_jerk_m_s3", sa.Float(), nullable=False),
        sa.Column("replan_count", sa.Integer(), nullable=False),
        sa.Column("p95_latency_ms", sa.Float(), nullable=False),
        sa.Column("failure_tag", sa.String(length=128), nullable=True),
        sa.Column("log_path", sa.String(length=512), nullable=True),
        sa.ForeignKeyConstraint(["owner_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_runs_id", "runs", ["id"], unique=False)
    op.create_index("ix_runs_idempotency_key", "runs", ["idempotency_key"], unique=True)
    op.create_index("ix_runs_owner_id", "runs", ["owner_id"], unique=False)
    op.create_index("ix_runs_scenario_id", "runs", ["scenario_id"], unique=False)
    op.create_index("ix_runs_planner_id", "runs", ["planner_id"], unique=False)
    op.create_index("ix_runs_split", "runs", ["split"], unique=False)
    op.create_index("ix_runs_status", "runs", ["status"], unique=False)
    op.create_index("ix_runs_is_shipped", "runs", ["is_shipped"], unique=False)
    op.create_index("ix_runs_config_hash", "runs", ["config_hash"], unique=False)
    op.create_index("ix_runs_failure_tag", "runs", ["failure_tag"], unique=False)
    op.create_index(
        "ix_runs_benchmark_lookup",
        "runs",
        ["scenario_id", "planner_id", "split", "status"],
        unique=False,
    )

    op.create_table(
        "audit_logs",
        sa.Column("id", sa.String(length=64), nullable=False),
        sa.Column("user_id", sa.String(length=64), nullable=True),
        sa.Column("action", sa.String(length=64), nullable=False),
        sa.Column("resource_type", sa.String(length=64), nullable=False),
        sa.Column("resource_id", sa.String(length=128), nullable=True),
        sa.Column("details", sa.JSON(), nullable=False),
        sa.Column("ip_address", sa.String(length=64), nullable=True),
        sa.Column("timestamp", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_audit_logs_user_id", "audit_logs", ["user_id"], unique=False)
    op.create_index("ix_audit_logs_action", "audit_logs", ["action"], unique=False)
    op.create_index("ix_audit_logs_resource_type", "audit_logs", ["resource_type"], unique=False)
    op.create_index("ix_audit_logs_timestamp", "audit_logs", ["timestamp"], unique=False)

    op.create_table(
        "reports",
        sa.Column("id", sa.String(length=64), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("author_id", sa.String(length=64), nullable=True),
        sa.Column("scenario_ids", sa.JSON(), nullable=False),
        sa.Column("planner_ids", sa.JSON(), nullable=False),
        sa.Column("summary_markdown", sa.Text(), nullable=False),
        sa.Column("data_json", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["author_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade() -> None:
    op.drop_table("reports")
    op.drop_table("audit_logs")
    op.drop_table("runs")
    op.drop_table("scenarios")
    op.drop_table("quotas")
    op.drop_table("user_settings")
    op.drop_table("sessions")
    op.drop_table("users")
