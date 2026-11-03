/**
 * apath-log v1 TypeScript Definitions.
 * Guarantees typed interoperability with the Python research engine and MATLAB adapter.
 */

export type SplitType = "tune" | "validate" | "frozen_test";
export type PlannerId = "B0" | "B1" | "B2" | "P1" | "P2" | "P3";

export type AgentClass =
  | "auto_rickshaw"
  | "two_wheeler"
  | "pedestrian"
  | "cattle"
  | "car"
  | "truck"
  | "handcart";

export type BehaviourState =
  | "FOLLOW"
  | "SLOW"
  | "YIELD"
  | "STOP"
  | "BYPASS"
  | "EMERGENCY_BRAKE";

export interface WorldBounds {
  x_min: number;
  x_max: number;
  y_min: number;
  y_max: number;
}

export interface RoadBoundary {
  side: "left" | "right" | "island";
  points: [number, number][];
}

export interface StaticObstacle {
  id: string;
  kind: string;
  x: number;
  y: number;
  length: number;
  width: number;
  yaw: number;
}

export interface WorldMap {
  bounds: WorldBounds;
  road_boundaries: RoadBoundary[];
  static_obstacles: StaticObstacle[];
}

export interface EgoState {
  x: number;
  y: number;
  yaw: number;
  v: number;
  steering: number;
  acceleration: number;
  jerk: number;
  length: number;
  width: number;
  active_state: BehaviourState;
}

export interface TrajectoryPoint {
  x: number;
  y: number;
  t_rel: number;
}

export interface PredictionHypothesis {
  weight: number;
  intent: string;
  trajectory: TrajectoryPoint[];
}

export interface ConformalConePoint {
  t_rel: number;
  radius_m: number;
  coverage_p: number;
}

export interface AgentTrack {
  id: string;
  class_name: AgentClass;
  x: number;
  y: number;
  yaw: number;
  v_x: number;
  v_y: number;
  length: number;
  width: number;
  is_occluded: boolean;
  prediction_hypotheses: PredictionHypothesis[];
  conformal_envelope: ConformalConePoint[];
}

export interface RiskFieldSummary {
  max_risk: number;
  ego_risk: number;
  critical_agent_id: string | null;
  risk_level: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
}

export interface CostBreakdown {
  collision_cost: number;
  progress_cost: number;
  smoothness_cost: number;
  risk_field_cost: number;
  total_cost: number;
}

export interface PlannedPose {
  x: number;
  y: number;
  v: number;
}

export interface PlannerOutput {
  replan_triggered: boolean;
  trigger_reason:
    | "PERIODIC"
    | "RISK_THRESHOLD_EXCEEDED"
    | "CONFORMAL_VIOLATION"
    | "OCCLUDED_EMERGENCE"
    | "PATH_BLOCKED"
    | "MANUAL"
    | null;
  cost_breakdown: CostBreakdown;
  latency_ms: number;
  planned_trajectory: PlannedPose[];
}

export interface Frame {
  step: number;
  t: number;
  ego: EgoState;
  agents: AgentTrack[];
  risk_field: RiskFieldSummary;
  planner_output: PlannerOutput;
  decision_trace: string;
}

export interface RunMetrics {
  duration_s: number;
  completed_goal: boolean;
  collision_occurred: boolean;
  near_miss_count: number;
  min_clearance_m: number;
  mean_speed_m_s: number;
  max_jerk_m_s3: number;
  mean_jerk_m_s3: number;
  replan_count: number;
  p95_latency_ms: number;
  failure_tag: "PERCEPTION" | "PREDICTION" | "RISK" | "PLANNING" | "DYNAMICS" | null;
}

export interface RunLog {
  schema_version: "apath-log/v1";
  run_id: string;
  timestamp_iso: string;
  config_hash: string;
  git_commit: string;
  engine: { name: string; version: string };
  scenario: {
    id: string;
    name: string;
    split: SplitType;
    seed: number;
    params: Record<string, any>;
  };
  planner: {
    id: PlannerId;
    name: string;
    config: Record<string, any>;
  };
  world: WorldMap;
  frames: Frame[];
  metrics: RunMetrics;
}
