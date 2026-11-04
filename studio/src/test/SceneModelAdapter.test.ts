import { describe, it, expect } from 'vitest';
import { extractSceneModel, extractSceneModelFromLog, SceneModel } from '../adapters/sceneModelAdapter';
import { RunLog, WorldMap, Frame } from '../types/apath_log';

describe('SceneModelAdapter (R1 Telemetry Truth Contract)', () => {
  const mockWorld: WorldMap = {
    bounds: { x_min: -10, x_max: 60, y_min: -5, y_max: 5 },
    road_boundaries: [
      { side: 'left', points: [[-10, 4], [60, 4]] },
      { side: 'right', points: [[-10, -4], [60, -4]] },
    ],
    static_obstacles: [
      { id: 'obs_1', kind: 'pothole', x: 25.0, y: 0.5, length: 1.2, width: 1.0, yaw: 0.0 },
    ],
  };

  const mockFrame: Frame = {
    step: 15,
    t: 1.5,
    ego: {
      x: 12.4,
      y: -0.2,
      yaw: 0.05,
      v: 5.5,
      steering: -0.02,
      acceleration: 0.8,
      jerk: 0.12,
      length: 4.2,
      width: 1.8,
      active_state: 'FOLLOW',
    },
    agents: [
      {
        id: 'cow_1',
        class_name: 'cattle',
        x: 28.0,
        y: 1.5,
        yaw: -1.57,
        v_x: 0.0,
        v_y: -0.8,
        length: 2.1,
        width: 1.0,
        is_occluded: false,
        prediction_hypotheses: [
          {
            weight: 0.85,
            intent: 'CROSS',
            trajectory: [{ x: 28.0, y: 0.5, t_rel: 1.0 }],
          },
        ],
        conformal_envelope: [
          { t_rel: 1.0, radius_m: 0.65, coverage_p: 0.95 },
        ],
      },
    ],
    risk_field: {
      max_risk: 0.68,
      ego_risk: 0.42,
      critical_agent_id: 'cow_1',
      risk_level: 'MEDIUM',
    },
    planner_output: {
      replan_triggered: true,
      trigger_reason: 'RISK_THRESHOLD_EXCEEDED',
      cost_breakdown: {
        collision_cost: 0.15,
        progress_cost: 0.05,
        smoothness_cost: 0.02,
        risk_field_cost: 0.42,
        total_cost: 0.64,
      },
      latency_ms: 14.8,
      planned_trajectory: [
        { x: 13.0, y: -0.2, v: 5.4 },
        { x: 14.5, y: -0.1, v: 5.2 },
      ],
    },
    decision_trace: 'P3 triggered replan: dynamic risk 0.42 exceeded baseline.',
  };

  it('maps strictly logged fields without modification or extrapolation', () => {
    const scene = extractSceneModel(mockWorld, mockFrame);

    // Verify ego mapping
    expect(scene.ego.x).toBe(12.4);
    expect(scene.ego.y).toBe(-0.2);
    expect(scene.ego.v).toBe(5.5);
    expect(scene.ego.active_state).toBe('FOLLOW');

    // Verify agents mapping
    expect(scene.agents).toHaveLength(1);
    expect(scene.agents[0].id).toBe('cow_1');
    expect(scene.agents[0].class_name).toBe('cattle');
    expect(scene.agents[0].is_occluded).toBe(false);
    expect(scene.agents[0].prediction_hypotheses).toHaveLength(1);
    expect(scene.agents[0].conformal_envelope).toHaveLength(1);

    // Verify static world
    expect(scene.bounds).toEqual(mockWorld.bounds);
    expect(scene.staticObstacles).toHaveLength(1);
    expect(scene.staticObstacles[0].id).toBe('obs_1');
    expect(scene.roadBoundaries).toHaveLength(2);

    // Verify trajectory
    expect(scene.plannedTrajectory).toHaveLength(2);
    expect(scene.plannedTrajectory[0]).toEqual({ x: 13.0, y: -0.2, v: 5.4 });

    // Verify scalar telemetry
    expect(scene.telemetry.step).toBe(15);
    expect(scene.telemetry.timeSeconds).toBe(1.5);
    expect(scene.telemetry.speedKmh).toBeCloseTo(19.8, 1);
    expect(scene.telemetry.egoRisk).toBe(0.42);
    expect(scene.telemetry.maxRisk).toBe(0.68);
    expect(scene.telemetry.riskLevel).toBe('MEDIUM');
    expect(scene.telemetry.criticalAgentId).toBe('cow_1');
    expect(scene.telemetry.replanTriggered).toBe(true);
    expect(scene.telemetry.triggerReason).toBe('RISK_THRESHOLD_EXCEEDED');
    expect(scene.telemetry.latencyMs).toBe(14.8);
    expect(scene.telemetry.decisionTrace).toBe(
      'P3 triggered replan: dynamic risk 0.42 exceeded baseline.'
    );
  });

  it('NEVER computes clearance or spatial risk grids (strictly logged data)', () => {
    const scene = extractSceneModel(mockWorld, mockFrame);

    // Check that sceneModel does NOT expose calculated distance or spatial heatmaps
    expect((scene as any).clearance).toBeUndefined();
    expect((scene as any).min_clearance).toBeUndefined();
    expect((scene as any).riskGrid).toBeUndefined();
    expect((scene as any).heatmapMatrix).toBeUndefined();
    expect((scene as any).spatial_heatmap).toBeUndefined();
  });

  it('handles empty agent lists and missing trajectory gracefully without hallucinating', () => {
    const frameSparse: Frame = {
      ...mockFrame,
      agents: [],
      planner_output: {
        ...mockFrame.planner_output,
        planned_trajectory: [],
      },
    };

    const scene = extractSceneModel(mockWorld, frameSparse);
    expect(scene.agents).toEqual([]);
    expect(scene.plannedTrajectory).toEqual([]);
  });

  it('extractSceneModelFromLog clamps frame indices safely', () => {
    const mockLog: RunLog = {
      schema_version: 'apath-log/v1',
      run_id: 'test_run_1',
      timestamp_iso: '2026-11-05T00:00:00Z',
      config_hash: 'abc',
      git_commit: '123',
      engine: { name: 'reference', version: '1.0' },
      scenario: { id: 'SCENARIO_1_VILLAGE_ROAD', name: 'Village', split: 'tune', seed: 1000, params: {} },
      planner: { id: 'P3', name: 'Planner 3', config: {} },
      world: mockWorld,
      frames: [mockFrame],
      metrics: {
        duration_s: 1.5,
        completed_goal: true,
        collision_occurred: false,
        near_miss_count: 0,
        min_clearance_m: 1.8,
        mean_speed_m_s: 5.5,
        max_jerk_m_s3: 0.12,
        mean_jerk_m_s3: 0.12,
        replan_count: 1,
        p95_latency_ms: 14.8,
        failure_tag: null,
      },
    };

    const scene = extractSceneModelFromLog(mockLog, 999);
    expect(scene.telemetry.step).toBe(15);
  });
});

