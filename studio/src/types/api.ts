/**
 * Typed API Schemas for ADAPTIVE-PATH Studio Backend.
 * Strictly typed with zero 'any' types.
 */

export type UserRole = 'guest' | 'researcher' | 'designer' | 'admin';

export interface UserProfile {
  id: string;
  email: string;
  role: UserRole;
  is_active: boolean;
  is_verified: boolean;
  created_at: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in_minutes: number;
  csrf_token: string;
  user: UserProfile;
}

export interface SessionSummary {
  id: string;
  user_agent: string | null;
  ip_address: string | null;
  created_at: string;
  expires_at: string;
}

export interface RunSummary {
  id: string;
  scenario_id: string;
  planner_id: string;
  split: string;
  seed: number;
  engine_adapter: string;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  config_hash: string | null;
  is_shipped: boolean;
  owner_id: string | null;
  created_at: string;
  duration_s: number;
  completed_goal: boolean;
  collision_occurred: boolean;
  min_clearance_m: number;
  mean_speed_m_s: number;
  max_jerk_m_s3: number;
  replan_count: number;
  p95_latency_ms: number;
  failure_tag: string | null;
}

export interface RunListResponse {
  items: RunSummary[];
  total: number;
  limit: number;
  offset: number;
}

export interface RunManifest {
  schema_version: string;
  run_id: string;
  timestamp_iso: string;
  config_hash: string | null;
  engine: { name: string; version: string };
  scenario: { id: string; name: string; split: string; seed: number; params?: Record<string, number | string> };
  planner: { id: string; name: string; config?: Record<string, number | string> };
  world: {
    road_segments: Array<{
      s_start: number;
      s_end: number;
      width: number;
      left_shoulder_width: number;
      right_shoulder_width: number;
      left_boundary_type: string;
      right_boundary_type: string;
      surface_quality: string;
    }>;
    static_obstacles: Array<{
      id: string;
      class_name: string;
      x: number;
      y: number;
      yaw: number;
      length: number;
      width: number;
      is_driveable_over: boolean;
    }>;
  };
  metrics: {
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
    failure_tag: string | null;
  };
  total_frames: number;
}

export interface FramesChunk {
  run_id: string;
  start_time: number;
  end_time: number;
  frame_count: number;
  frames: Array<Record<string, unknown>>;
}

export interface ScenarioDetail {
  id: string;
  name: string;
  description: string;
  target_distance_m: number;
  timeout_s: number;
  nominal_speed_m_s: number;
  splits: {
    tune: number[];
    validate: number[];
    frozen_test: number[];
  };
  is_variant: boolean;
  base_scenario_id: string | null;
}

export interface MetricCI {
  mean: number;
  ci_lower: number;
  ci_upper: number;
}

export interface PlannerBenchmarkRow {
  planner_id: string;
  planner_name: string;
  run_count: number;
  collision_rate: MetricCI;
  min_clearance: MetricCI;
  mean_jerk: MetricCI;
  p95_latency_ms: MetricCI;
  mean_speed: MetricCI;
}

export interface ScenarioBenchmarkSummary {
  scenario_id: string;
  scenario_name: string;
  split: string;
  planners: PlannerBenchmarkRow[];
}

export interface BenchmarkCompare {
  baseline_planner: string;
  candidate_planner: string;
  scenario_id: string;
  split: string;
  collision_rate_diff_pct: number;
  clearance_improvement_m: number;
  jerk_reduction_pct: number;
  p95_latency_ratio: number;
}

export interface ReportItem {
  id: string;
  title: string;
  author_id: string | null;
  scenario_ids: string[];
  planner_ids: string[];
  summary_markdown: string;
  created_at: string;
}

export interface UserSettings {
  preferences: {
    theme?: 'dark' | 'light' | 'high-contrast';
    language?: 'en' | 'hi' | 'te';
    reduced_motion?: boolean;
    text_scaling?: 100 | 125 | 150 | 175 | 200;
    default_planner?: string;
    default_split?: string;
  };
  updated_at: string;
}

export interface AdminUserItem {
  id: string;
  email: string;
  role: UserRole;
  is_active: boolean;
  is_verified: boolean;
  created_at: string;
  run_count?: number;
  quota?: {
    max_concurrent_runs: number;
    daily_run_limit: number;
    runs_today: number;
  };
}

export interface AuditLogEntry {
  id: string;
  user_id: string | null;
  action: string;
  resource_type: string;
  resource_id: string | null;
  details: Record<string, unknown>;
  ip_address: string | null;
  timestamp: string;
}

export interface SystemStats {
  environment: string;
  active_worker_threads: number;
  total_runs_recorded: number;
  completed_runs: number;
  failed_runs: number;
  cancelled_runs: number;
  total_registered_users: number;
}

export interface ApiErrorFormat {
  code: string;
  message: string;
  details: Record<string, unknown>;
  request_id: string | null;
}
