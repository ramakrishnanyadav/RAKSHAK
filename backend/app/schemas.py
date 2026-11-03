"""
Comprehensive Pydantic Schemas for ADAPTIVE-PATH Studio Backend.
Ensures strict validation on every incoming request and typed outgoing responses.
"""

from typing import List, Dict, Any, Optional, Literal
from pydantic import BaseModel, Field, EmailStr
from datetime import datetime


# =====================================================================
# Auth & User Schemas
# =====================================================================

class UserProfile(BaseModel):
    id: str
    email: str
    role: Literal["guest", "researcher", "designer", "admin"]
    is_active: bool
    is_verified: bool
    created_at: datetime


class UserRegisterRequest(BaseModel):
    email: str = Field(..., description="User email address")
    password: str = Field(..., min_length=8, description="Password with minimum 8 characters")
    role: Literal["researcher", "designer", "admin"] = Field("researcher", description="Desired user role")


class UserLoginRequest(BaseModel):
    email: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "Bearer"
    expires_in_minutes: int
    csrf_token: str
    user: UserProfile


class SessionSummary(BaseModel):
    id: str
    user_agent: Optional[str]
    ip_address: Optional[str]
    created_at: datetime
    expires_at: datetime


class VerifyEmailRequest(BaseModel):
    token: str = Field(..., description="Email verification token")


class ForgotPasswordRequest(BaseModel):
    email: str


class ResetPasswordRequest(BaseModel):
    token: str = Field(..., description="Password reset token")
    new_password: str = Field(..., min_length=8)


class DeleteAccountRequest(BaseModel):
    password: str = Field(..., description="Confirm password to delete account")


# =====================================================================
# Runs & Execution Schemas
# =====================================================================

class RunLaunchRequest(BaseModel):
    scenario_id: str = Field(..., description="Target scenario, e.g. SCENARIO_5_CATTLE_CROSSING")
    planner_id: Literal["B0", "B1", "B2", "P1", "P2", "P3"] = Field(..., description="Planner to evaluate")
    split: Literal["tune", "validate", "frozen_test"] = Field("tune", description="Dataset split")
    seed: int = Field(1000, description="Seed for deterministic generation")
    engine_adapter: Literal["python", "matlab"] = Field("python", description="Execution engine")
    custom_params: Dict[str, Any] = Field(default_factory=dict, description="Custom parameter overrides")
    idempotency_key: Optional[str] = Field(None, max_length=128, description="Optional client idempotency key")


class BatchLaunchRequest(BaseModel):
    scenario_ids: List[str] = Field(default_factory=lambda: ["SCENARIO_5_CATTLE_CROSSING"])
    planner_ids: List[str] = Field(default_factory=lambda: ["B1", "P1", "P2", "P3"])
    split: Literal["tune", "validate", "frozen_test"] = "tune"
    seeds: Optional[List[int]] = None
    engine_adapter: Literal["python", "matlab"] = "python"


class RunSummaryResponse(BaseModel):
    id: str
    scenario_id: str
    planner_id: str
    split: str
    seed: int
    engine_adapter: str
    status: str
    config_hash: Optional[str]
    is_shipped: bool
    owner_id: Optional[str]
    created_at: datetime
    duration_s: float
    completed_goal: bool
    collision_occurred: bool
    min_clearance_m: float
    mean_speed_m_s: float
    max_jerk_m_s3: float
    replan_count: int
    p95_latency_ms: float
    failure_tag: Optional[str]


class RunListResponse(BaseModel):
    items: List[RunSummaryResponse]
    total: int
    limit: int
    offset: int


class RunManifestResponse(BaseModel):
    schema_version: str
    run_id: str
    timestamp_iso: str
    config_hash: Optional[str]
    engine: Dict[str, Any]
    scenario: Dict[str, Any]
    planner: Dict[str, Any]
    world: Dict[str, Any]
    metrics: Dict[str, Any]
    total_frames: int


class FramesChunkResponse(BaseModel):
    run_id: str
    start_time: float
    end_time: float
    frame_count: int
    frames: List[Dict[str, Any]]


# =====================================================================
# Scenarios & Variants Schemas
# =====================================================================

class ScenarioDetailResponse(BaseModel):
    id: str
    name: str
    description: str
    target_distance_m: float
    timeout_s: float
    nominal_speed_m_s: float
    splits: Dict[str, List[int]]
    is_variant: bool = False
    base_scenario_id: Optional[str] = None


class ScenarioVariantCreateRequest(BaseModel):
    name: str = Field(..., max_length=128)
    description: str = Field(..., max_length=512)
    base_scenario_id: str = Field(...)
    config_overrides: Dict[str, Any] = Field(default_factory=dict)


# =====================================================================
# Benchmarks & Metrics Schemas
# =====================================================================

class MetricConfidenceInterval(BaseModel):
    mean: float
    ci_lower: float
    ci_upper: float


class PlannerBenchmarkRow(BaseModel):
    planner_id: str
    planner_name: str
    run_count: int
    collision_rate: MetricConfidenceInterval
    min_clearance: MetricConfidenceInterval
    mean_jerk: MetricConfidenceInterval
    p95_latency_ms: MetricConfidenceInterval
    mean_speed: MetricConfidenceInterval


class ScenarioBenchmarkSummary(BaseModel):
    scenario_id: str
    scenario_name: str
    split: str
    planners: List[PlannerBenchmarkRow]


class BenchmarkCompareResponse(BaseModel):
    baseline_planner: str
    candidate_planner: str
    scenario_id: str
    split: str
    collision_rate_diff_pct: float
    clearance_improvement_m: float
    jerk_reduction_pct: float
    p95_latency_ratio: float


# =====================================================================
# Failures Schemas
# =====================================================================

class FailureRecordResponse(BaseModel):
    run_id: str
    scenario_id: str
    planner_id: str
    split: str
    seed: int
    failure_tag: str
    min_clearance_m: float
    max_jerk_m_s3: float
    duration_s: float


# =====================================================================
# Reports Schemas
# =====================================================================

class ReportCreateRequest(BaseModel):
    title: str = Field(..., max_length=255)
    scenario_ids: List[str]
    planner_ids: List[str]


class ReportResponse(BaseModel):
    id: str
    title: str
    author_id: Optional[str]
    scenario_ids: List[str]
    planner_ids: List[str]
    summary_markdown: str
    created_at: datetime


# =====================================================================
# User Settings Schemas
# =====================================================================

class UserSettingsResponse(BaseModel):
    preferences: Dict[str, Any]
    updated_at: datetime


class UserSettingsUpdateRequest(BaseModel):
    preferences: Dict[str, Any]


# =====================================================================
# Admin & Audit Schemas
# =====================================================================

class QuotaInfo(BaseModel):
    max_concurrent_runs: int
    daily_run_limit: int
    runs_today: int


class AdminUserListItem(BaseModel):
    id: str
    email: str
    role: str
    is_active: bool
    is_verified: bool
    created_at: datetime
    quota: Optional[QuotaInfo] = None


class AdminUserRoleUpdateRequest(BaseModel):
    role: Literal["guest", "researcher", "designer", "admin"]


class AdminUserQuotaUpdateRequest(BaseModel):
    max_concurrent_runs: int = Field(..., ge=1, le=20)
    daily_run_limit: int = Field(..., ge=1, le=1000)


class AuditLogEntryResponse(BaseModel):
    id: str
    user_id: Optional[str]
    action: str
    resource_type: str
    resource_id: Optional[str]
    details: Dict[str, Any]
    ip_address: Optional[str]
    timestamp: datetime


class SystemStatsResponse(BaseModel):
    environment: str
    active_worker_threads: int
    total_runs_recorded: int
    completed_runs: int
    failed_runs: int
    cancelled_runs: int
    total_registered_users: int


# =====================================================================
# Observability & Health Schemas
# =====================================================================

class HealthCheckResponse(BaseModel):
    status: str
    service: str
    version: str
    engine_contract: str


class ReadinessResponse(BaseModel):
    status: str
    database_connected: bool
    storage_writable: bool
    worker_ready: bool
