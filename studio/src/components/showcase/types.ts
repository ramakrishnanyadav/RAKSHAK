/**
 * Showcase Types for ADAPTIVE-PATH Demo-First Experience.
 * Aligned with runs/val_b_manifest.json and authentic simulation log schemas.
 */

export type StateflowState = 'FOLLOW' | 'SLOW' | 'BYPASS' | 'STOP' | 'EMERGENCY_BRAKE';

export interface AgentPredictionHypothesis {
  weight: number;
  intent: string;
  trajectory: Array<{ x: number; y: number; t_rel: number }>;
}

export interface AgentConformalEnvelope {
  t_rel: number;
  radius_m: number;
  coverage_p: number;
}

export interface ShowcaseAgent {
  id: string;
  class_name: 'cattle' | 'auto_rickshaw' | 'handcart' | 'pedestrian' | 'truck' | 'motorcycle' | string;
  x: number;
  y: number;
  yaw: number;
  v_x?: number;
  v_y?: number;
  length: number;
  width: number;
  is_occluded?: boolean;
  confidence?: number;
  prediction_hypotheses?: AgentPredictionHypothesis[];
  conformal_envelope?: AgentConformalEnvelope[];
}

export interface ShowcaseEgo {
  x: number;
  y: number;
  yaw: number;
  v: number;
  steering: number;
  acceleration?: number;
  jerk?: number;
  length: number;
  width: number;
  active_state: StateflowState;
}

export interface ShowcaseFrame {
  step: number;
  t: number;
  ego: ShowcaseEgo;
  agents: ShowcaseAgent[];
  caption: string;
  min_clearance_m: number;
  planner_output?: {
    replan_triggered?: boolean;
    trigger_reason?: string;
    planned_trajectory?: Array<{ x: number; y: number; v?: number }>;
  };
}

export interface ShowcaseRunMetrics {
  duration_s: number;
  completed_goal: boolean;
  collision_occurred: boolean;
  min_clearance_m: number;
  mean_jerk_m_s3: number;
  replan_count: number;
  p95_latency_ms: number;
  mean_speed_m_s: number;
  source?: string;
}

export interface ShowcaseRunData {
  scenario_id: string;
  planner_id: string;
  source_file?: string;
  metrics: ShowcaseRunMetrics;
  frames: ShowcaseFrame[];
}

export interface ShowcaseScenarioFile {
  key: 'cattle' | 'village' | 'intersection' | 'highway' | 'market';
  scenario_id: string;
  name: string;
  description: string;
  built_from: string;
  source_file: string;
  road_users: string[];
  seed: number;
  tested_on: string;
  adaptive: ShowcaseRunData;
  standard: ShowcaseRunData;
}

export interface HeadlineMetric {
  label: string;
  adaptive: number;
  standard: number;
  unit: string;
  delta: string;
  delta_label: string;
  higher_is_better: boolean;
  source_file: string;
}

export interface ScenarioBenchmarkSummary {
  key: string;
  scenario_id: string;
  name: string;
  flagship?: boolean;
  is_weak_spot?: boolean;
  built_from: string;
  source_file: string;
  description: string;
  tested_on: string;
  adaptive: {
    completion_rate: number;
    collision_rate: number;
    jerk_m_s3: number;
    latency_ms: number;
  };
  standard: {
    completion_rate: number;
    collision_rate: number;
    jerk_m_s3: number;
    latency_ms: number;
  };
}

export interface ShowcaseSummary {
  metadata: {
    title: string;
    provenance: string;
    git_commit: string;
    timestamp: string;
    split: string;
    seeds: number[];
    total_episodes_per_planner: number;
    source_file: string;
    disclaimer: string;
  };
  headline_metrics: {
    completion_rate: HeadlineMetric;
    collision_rate: HeadlineMetric;
    smoothness_jerk: HeadlineMetric;
    think_time_ms: HeadlineMetric;
  };
  scenarios: ScenarioBenchmarkSummary[];
  weak_spot_analysis: {
    scenario: string;
    why: string;
    future_work: string;
    source_file: string;
  };
}

export interface DatasetItem {
  id: string;
  name: string;
  url: string;
  status: 'In use' | 'Adapter only (no data loaded)' | 'Not yet ingested' | string;
  badge_tone: 'teal' | 'amber' | 'slate';
  summary: string;
  used_for: string;
  item_count: number;
  unit: string;
  licence: string;
  attribution: string;
  adapter_file?: string | null;
  mapped_classes?: string[];
  steps_to_add?: string[];
  loaded_by?: string[];
  scenarios?: string[];
  audit_note: string;
}

export interface ProvenancePayload {
  generated_at: string;
  scan_summary: {
    real_trajectories_count: number;
    simulated_trajectories_count: number;
    real_share_pct: number;
    simulated_share_pct: number;
    accounting_note: string;
  };
  datasets: DatasetItem[];
  split_protocol: {
    strategy: string;
    splits: Array<{ name: string; share_pct: number; purpose: string }>;
  };
  reconciliation: {
    title: string;
    frozen_test_p3_completion: number;
    frozen_test_reason: string;
    val_b_p3_completion: number;
    val_b_reason: string;
    source_files: string[];
  };
}
