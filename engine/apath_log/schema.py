"""
apath-log v1: Official Versioned Run-Log Schema.
Guarantees engine-agnostic reproducibility between Python Reference Engine
and MATLAB / RoadRunner.
"""

from typing import List, Dict, Optional, Literal, Any
from pydantic import BaseModel, Field


class EngineInfo(BaseModel):
    name: str = Field(..., description="Engine name, e.g. python_reference or matlab_roadrunner")
    version: str = Field("1.0.0", description="Semantic engine version")


class ScenarioMetadata(BaseModel):
    id: str = Field(..., description="Unique scenario ID, e.g. SCENARIO_5_CATTLE_CROSSING")
    name: str = Field(..., description="Human-readable scenario title")
    split: Literal["tune", "validate", "frozen_test"] = Field(..., description="Dataset split")
    seed: int = Field(..., description="Random seed used for deterministic generation")
    params: Dict[str, Any] = Field(default_factory=dict, description="Scenario generation parameters")


class PlannerMetadata(BaseModel):
    id: str = Field(..., description="Planner ID (B0, B1, B2, P1, P2, P3, P2-ML, P3-ML)")
    name: str = Field(..., description="Planner display name")
    config: Dict[str, Any] = Field(default_factory=dict, description="Planner hyperparameters")


class WorldBounds(BaseModel):
    x_min: float = 0.0
    x_max: float = 120.0
    y_min: float = -15.0
    y_max: float = 15.0


class RoadBoundary(BaseModel):
    side: Literal["left", "right", "island"]
    points: List[List[float]] = Field(..., description="List of [x, y] coordinates")


class StaticObstacle(BaseModel):
    id: str
    kind: str = Field("barrier", description="Type: stall, pothole, divider, parked_vehicle, barrier")
    x: float
    y: float
    length: float
    width: float
    yaw: float = 0.0


class WorldMap(BaseModel):
    bounds: WorldBounds = Field(default_factory=WorldBounds)
    road_boundaries: List[RoadBoundary] = Field(default_factory=list)
    static_obstacles: List[StaticObstacle] = Field(default_factory=list)


class EgoState(BaseModel):
    x: float
    y: float
    yaw: float
    v: float
    steering: float
    acceleration: float
    jerk: float = 0.0
    length: float = 4.2
    width: float = 1.8
    active_state: Literal["FOLLOW", "SLOW", "YIELD", "STOP", "BYPASS", "EMERGENCY_BRAKE"] = "FOLLOW"


class TrajectoryPoint(BaseModel):
    x: float
    y: float
    t_rel: float


class PredictionHypothesis(BaseModel):
    weight: float = Field(..., ge=0.0, le=1.0)
    intent: str = Field("continue", description="Intent tag: continue, yield, deviate, stop")
    trajectory: List[TrajectoryPoint] = Field(default_factory=list)


class ConformalConePoint(BaseModel):
    t_rel: float
    radius_m: float
    coverage_p: float = 0.95


class AgentTrack(BaseModel):
    id: str
    class_name: Literal[
        "auto_rickshaw", "two_wheeler", "pedestrian", "cattle", "car", "truck", "handcart"
    ]
    x: float
    y: float
    yaw: float
    v_x: float
    v_y: float
    length: float
    width: float
    is_occluded: bool = False
    confidence: float = 1.0
    history_len: int = 1
    covariance: Optional[List[List[float]]] = None
    prediction_hypotheses: List[PredictionHypothesis] = Field(default_factory=list)
    conformal_envelope: List[ConformalConePoint] = Field(default_factory=list)


class RiskFieldSummary(BaseModel):
    max_risk: float = Field(0.0, ge=0.0, le=1.0)
    ego_risk: float = Field(0.0, ge=0.0, le=1.0)
    critical_agent_id: Optional[str] = None
    risk_level: Literal["LOW", "MEDIUM", "HIGH", "CRITICAL"] = "LOW"


class CostBreakdown(BaseModel):
    # Explicit 5 terms from formula: Cost = w1*Distance + w2*CollisionRisk + w3*Curvature + w4*Energy + w5*ReplanCost
    w1_distance: float = 0.0
    w2_collision_risk: float = 0.0
    w3_curvature: float = 0.0
    w4_energy: float = 0.0
    w5_replan_cost: float = 0.0
    # Legacy alias fields for backward compatibility
    collision_cost: float = 0.0
    progress_cost: float = 0.0
    smoothness_cost: float = 0.0
    risk_field_cost: float = 0.0
    total_cost: float = 0.0


class PlannedPose(BaseModel):
    x: float
    y: float
    v: float


class PlannerOutput(BaseModel):
    replan_triggered: bool = False
    trigger_reason: Optional[
        Literal[
            "PERIODIC",
            "RISK_THRESHOLD_EXCEEDED",
            "CONFORMAL_VIOLATION",
            "OCCLUDED_EMERGENCE",
            "PATH_BLOCKED",
            "UNCERTAINTY_EXCEEDED_MRM",
            "MANUAL",
        ]
    ] = None
    cost_breakdown: CostBreakdown = Field(default_factory=CostBreakdown)
    latency_ms: float = 0.0
    planned_trajectory: List[PlannedPose] = Field(default_factory=list)


class Frame(BaseModel):
    step: int
    t: float
    ego: EgoState
    agents: List[AgentTrack] = Field(default_factory=list)
    risk_field: RiskFieldSummary = Field(default_factory=RiskFieldSummary)
    planner_output: PlannerOutput = Field(default_factory=PlannerOutput)
    decision_trace: str = ""


class RunMetrics(BaseModel):
    duration_s: float
    completed_goal: bool
    collision_occurred: bool
    near_miss_count: int
    min_clearance_m: float
    mean_speed_m_s: float
    max_jerk_m_s3: float
    mean_jerk_m_s3: float
    replan_count: int
    p95_latency_ms: float
    failure_tag: Optional[
        Literal["PERCEPTION", "PREDICTION", "RISK", "PLANNING", "DYNAMICS", "NONE"]
    ] = None


class RunLog(BaseModel):
    schema_version: Literal["apath-log/v1"] = "apath-log/v1"
    run_id: str
    timestamp_iso: str
    config_hash: str
    git_commit: str = "main"
    engine: EngineInfo
    scenario: ScenarioMetadata
    planner: PlannerMetadata
    world: WorldMap
    frames: List[Frame]
    metrics: RunMetrics
