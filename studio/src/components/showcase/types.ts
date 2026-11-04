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
}

export interface ShowcaseRunData {
  scenario_id: string;
  planner_id: string;
  metrics: ShowcaseRunMetrics;
  frames: ShowcaseFrame[];
}

export interface ShowcaseScenarioFile {
  key: 'cattle' | 'village' | 'intersection' | 'highway' | 'market';
  scenario_id: string;
  name: string;
  description: string;
  road_users: string[];
  seed: number;
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
}

export interface ScenarioBenchmarkSummary {
  key: string;
  scenario_id: string;
  name: string;
  flagship?: boolean;
  is_weak_spot?: boolean;
  description: string;
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
  };
}
