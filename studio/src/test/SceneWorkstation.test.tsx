import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SceneWorkstation } from '../components/scene/SceneWorkstation';

describe('SceneWorkstation Component', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string) => {
        if (url.includes('run_scenario_5_cattle_crossing') || url.includes('cattle.json')) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                schema_version: 'apath-log/v1',
                run_id: 'mock_cattle_run',
                world: {
                  bounds: { x_min: -10, x_max: 90, y_min: -6, y_max: 6 },
                  road_boundaries: [
                    { side: 'left', points: [[-10, 4.8], [90, 4.8]] },
                    { side: 'right', points: [[-10, -4.8], [90, -4.8]] },
                  ],
                  static_obstacles: [],
                },
                metrics: {
                  completed_goal: true,
                  collision_occurred: false,
                  min_clearance_m: 0.78,
                  duration_s: 12.6,
                  replan_count: 3,
                  p95_latency_ms: 12.4,
                },
                frames: [
                  {
                    step: 0,
                    t: 0.0,
                    ego: {
                      x: 0.0,
                      y: 0.0,
                      yaw: 0.0,
                      v: 6.0,
                      steering: 0.0,
                      acceleration: 0.0,
                      jerk: 0.0,
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
                      latency_ms: 8.0,
                      planned_trajectory: [{ x: 0, y: 0, v: 6 }],
                    },
                    decision_trace: '[FOLLOW] Nominal tracking',
                  },
                ],
              }),
          });
        }
        return Promise.reject(new Error('Not found'));
      })
    );
  });

  it('renders top status bar with strictly REPLAY ONLY badge and tuning split label', async () => {
    render(<SceneWorkstation initialScenarioId="SCENARIO_5_CATTLE_CROSSING" />);
    expect(screen.getByText(/REPLAY ONLY/i)).toBeInTheDocument();
    expect(screen.getByText(/Validation B \(Tuning Split/i)).toBeInTheDocument();
  });

  it('renders 5-seed validation table with Village Road seed 2008 note', async () => {
    render(<SceneWorkstation initialScenarioId="SCENARIO_1_VILLAGE_ROAD" />);
    await waitFor(() => {
      expect(screen.getByText(/VALIDATION B 5-SEED BENCHMARK TABLE/i)).toBeInTheDocument();
    });
    // Check note on seed 2008
    expect(screen.getByText(/the only P3 success of 5 seeds/i)).toBeInTheDocument();
  });

  it('renders Ego Risk (scalar, logged) telemetry card and unavailable sensor dashes', async () => {
    render(<SceneWorkstation initialScenarioId="SCENARIO_5_CATTLE_CROSSING" />);
    expect(screen.getByText(/EGO RISK \(SCALAR, LOGGED\)/i)).toBeInTheDocument();
    expect(screen.getByText(/UNAVAILABLE SENSORS/i)).toBeInTheDocument();
  });
});

