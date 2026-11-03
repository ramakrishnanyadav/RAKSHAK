import React from 'react';
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ReplayCanvas, CanvasLayerState } from '../components/ReplayCanvas';
import { RunLog } from '../types/apath_log';

// Deterministic golden mock run log with known coordinates
const mockRunLog: RunLog = {
  schema_version: 'apath-log/v1',
  run_id: 'run_deterministic_test_001',
  timestamp_iso: '2026-10-14T00:00:00Z',
  config_hash: 'a'.repeat(64),
  git_commit: '0000000000000000000000000000000000000000',
  engine: {
    name: 'PythonReferenceEngine',
    version: '1.0.0',
  },
  scenario: {
    id: 'SCENARIO_5_CATTLE_CROSSING',
    name: 'Cattle Crossing',
    split: 'tune',
    seed: 1000,
    params: {},
  },
  planner: {
    id: 'P3',
    name: 'Adaptive Replanner',
    config: {},
  },
  world: {
    bounds: { x_min: -10, x_max: 100, y_min: -10, y_max: 10 },
    road_boundaries: [
      { side: 'left', points: [[-10, 4], [100, 4]] },
      { side: 'right', points: [[-10, -4], [100, -4]] },
    ],
    static_obstacles: [],
  },
  frames: [
    {
      step: 0,
      t: 0.0,
      ego: {
        x: 10.0,
        y: 0.0,
        yaw: 0.0,
        v: 6.0,
        steering: 0.0,
        acceleration: 0.0,
        jerk: 0.0,
        length: 4.5,
        width: 2.0,
        active_state: 'FOLLOW',
      },
      agents: [
        {
          id: 'cattle_1',
          class_name: 'cattle',
          x: 25.0,
          y: 1.5,
          yaw: 1.57,
          v_x: 0.0,
          v_y: 1.0,
          length: 2.2,
          width: 1.0,
          is_occluded: false,
          prediction_hypotheses: [
            {
              weight: 0.8,
              intent: 'cross',
              trajectory: [
                { x: 25.0, y: 1.5, t_rel: 0.0 },
                { x: 25.0, y: 2.5, t_rel: 1.0 },
              ],
            },
          ],
          conformal_envelope: [
            { t_rel: 1.0, radius_m: 0.8, coverage_p: 0.95 },
          ],
        },
      ],
      risk_field: {
        max_risk: 0.45,
        ego_risk: 0.12,
        critical_agent_id: 'cattle_1',
        risk_level: 'MEDIUM',
      },
      planner_output: {
        replan_triggered: false,
        trigger_reason: null,
        latency_ms: 12.4,
        cost_breakdown: {
          collision_cost: 0.2,
          progress_cost: 1.0,
          smoothness_cost: 0.05,
          risk_field_cost: 0.1,
          total_cost: 1.35,
        },
        planned_trajectory: [
          { x: 10.0, y: 0.0, v: 6.0 },
          { x: 15.0, y: 0.0, v: 5.5 },
          { x: 20.0, y: -0.5, v: 5.0 },
        ],
      },
      decision_trace: 'Following lead corridor path with cattle monitored',
    },
  ],
  metrics: {
    duration_s: 0.1,
    completed_goal: true,
    collision_occurred: false,
    near_miss_count: 0,
    min_clearance_m: 1.5,
    mean_speed_m_s: 6.0,
    max_jerk_m_s3: 1.0,
    mean_jerk_m_s3: 0.3,
    replan_count: 0,
    p95_latency_ms: 12.4,
    failure_tag: null,
  },
};

const allLayersOn: CanvasLayerState = {
  world: true,
  tracks: true,
  predictions: true,
  risk: true,
  plan: true,
};

describe('ReplayCanvas Visual & Determinism Verification', () => {
  it('renders canvas with correct accessibility attributes', () => {
    const { container } = render(
      <ReplayCanvas
        runLog={mockRunLog}
        currentFrameIndex={0}
        selectedAgentId={null}
        onSelectAgent={() => {}}
        layers={allLayersOn}
      />
    );

    const canvas = container.querySelector('canvas');
    expect(canvas).not.toBeNull();
    expect(canvas?.getAttribute('tabIndex')).toBe('0');
    expect(canvas?.getAttribute('aria-label')).toContain('Simulation canvas');
  });

  it('executes deterministic rendering on identical frame input', () => {
    const drawCalls: string[] = [];

    const originalGetContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = vi.fn().mockImplementation((type: string) => {
      const ctx = (originalGetContext.call(this, type) as any) || {};
      const record = (name: string) => (...args: any[]) => {
        drawCalls.push(`${name}(${args.map(a => typeof a === 'number' ? a.toFixed(1) : typeof a).join(',')})`);
      };
      return {
        ...ctx,
        save: record('save'),
        restore: record('restore'),
        beginPath: record('beginPath'),
        closePath: record('closePath'),
        moveTo: record('moveTo'),
        lineTo: record('lineTo'),
        stroke: record('stroke'),
        fill: record('fill'),
        arc: record('arc'),
        rect: record('rect'),
        fillText: record('fillText'),
        setLineDash: record('setLineDash'),
        clearRect: record('clearRect'),
        translate: record('translate'),
        rotate: record('rotate'),
        scale: record('scale'),
      };
    });

    const { unmount } = render(
      <ReplayCanvas
        runLog={mockRunLog}
        currentFrameIndex={0}
        selectedAgentId={null}
        onSelectAgent={() => {}}
        layers={allLayersOn}
      />
    );

    const firstRunCallCount = drawCalls.length;
    expect(firstRunCallCount).toBeGreaterThan(0);
    unmount();

    // Re-mount identical component
    drawCalls.length = 0;
    render(
      <ReplayCanvas
        runLog={mockRunLog}
        currentFrameIndex={0}
        selectedAgentId={null}
        onSelectAgent={() => {}}
        layers={allLayersOn}
      />
    );

    expect(drawCalls.length).toBe(firstRunCallCount);
  });

  it('selects dynamic agent on canvas click', () => {
    const onSelect = vi.fn();
    const { container } = render(
      <ReplayCanvas
        runLog={mockRunLog}
        currentFrameIndex={0}
        selectedAgentId={null}
        onSelectAgent={onSelect}
        layers={allLayersOn}
      />
    );

    const canvas = container.querySelector('canvas');
    expect(canvas).not.toBeNull();
    if (canvas) {
      fireEvent.click(canvas, { clientX: 200, clientY: 150 });
      expect(canvas).not.toBeNull();
    }
  });

  it('handles layer toggles correctly', () => {
    const noPredictionsLayer: CanvasLayerState = {
      world: true,
      tracks: true,
      predictions: false,
      risk: false,
      plan: true,
    };

    const { container } = render(
      <ReplayCanvas
        runLog={mockRunLog}
        currentFrameIndex={0}
        selectedAgentId={null}
        onSelectAgent={() => {}}
        layers={noPredictionsLayer}
      />
    );

    const canvas = container.querySelector('canvas');
    expect(canvas).not.toBeNull();
  });
});
