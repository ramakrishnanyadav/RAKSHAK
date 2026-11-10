import React from 'react';
import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { UPlotStrip } from '../components/scene/UPlotStrip';
import { RunLog } from '../types/apath_log';

const mockRunLog = {
  schema_version: 'apath-log/v1',
  run_id: 'test_uplot_run',
  timestamp_iso: '2026-11-05T00:00:00Z',
  config_hash: 'mock',
  git_commit: 'mock',
  engine: { python_version: '3.14', planner_id: 'P3' },
  scenario: { name: 'test', id: 'SCENARIO_5_CATTLE_CROSSING' },
  seed: 2005,
  world: {
    bounds: { x_min: -10, x_max: 90, y_min: -6, y_max: 6 },
    road_boundaries: [],
    static_obstacles: [],
  },
  metrics: {
    completed_goal: true,
    collision_occurred: false,
    min_clearance_m: 1.5,
    duration_s: 1.0,
    replan_count: 2,
    p95_latency_ms: 7.2,
    near_miss_count: 0,
    mean_speed_m_s: 5.0,
    max_jerk_m_s3: 0.5,
    mean_jerk_m_s3: 0.1,
    failure_tag: null,
  },
  frames: [
    {
      step: 0,
      t: 0.0,
      ego: {
        x: 0,
        y: 0,
        yaw: 0,
        v: 5.0,
        steering: 0,
        acceleration: 0.1,
        jerk: 0.02,
        length: 4.2,
        width: 1.8,
        active_state: 'FOLLOW',
      },
      agents: [],
      risk_field: { max_risk: 0.1, ego_risk: 0.05, critical_agent_id: null, risk_level: 'LOW' },
      planner_output: {
        replan_triggered: false,
        trigger_reason: 'PERIODIC',
        cost_breakdown: { collision_cost: 0, progress_cost: 0, smoothness_cost: 0, risk_field_cost: 0, total_cost: 0 },
        latency_ms: 6.5,
        planned_trajectory: [{ x: 0, y: 0, v: 5 }],
      },
      decision_trace: '[FOLLOW] Nominal',
    },
    {
      step: 1,
      t: 0.1,
      ego: {
        x: 0.5,
        y: 0,
        yaw: 0,
        v: 5.1,
        steering: 0.01,
        acceleration: 0.15,
        jerk: 0.03,
        length: 4.2,
        width: 1.8,
        active_state: 'FOLLOW',
      },
      agents: [],
      risk_field: { max_risk: 0.1, ego_risk: 0.05, critical_agent_id: null, risk_level: 'LOW' },
      planner_output: {
        replan_triggered: false,
        trigger_reason: 'PERIODIC',
        cost_breakdown: { collision_cost: 0, progress_cost: 0, smoothness_cost: 0, risk_field_cost: 0, total_cost: 0 },
        latency_ms: 6.5,
        planned_trajectory: [{ x: 0.5, y: 0, v: 5.1 }],
      },
      decision_trace: '[FOLLOW] Nominal',
    },
  ],
};

describe('UPlotStrip Component', () => {
  it('renders without crashing with valid runLog and clearance sidecar', () => {
    const handleScrub = vi.fn();
    const sidecar = { 0: 2.5, 1: 2.4 };

    const { container } = render(
      <UPlotStrip
        runLog={mockRunLog as unknown as RunLog}
        frameIndex={0}
        onScrub={handleScrub}
        clearanceSidecar={sidecar}
      />
    );

    expect(container.firstChild).not.toBeNull();
  });

  it('renders safely when runLog is null', () => {
    const { container } = render(
      <UPlotStrip
        runLog={null}
        frameIndex={0}
      />
    );
    expect(container.firstChild).not.toBeNull();
  });
});
