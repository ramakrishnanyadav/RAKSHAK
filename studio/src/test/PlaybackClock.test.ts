import { describe, it, expect, beforeEach } from 'vitest';
import { PlaybackClock, interpolateYaw } from '../sim3d/Playback';
import { RunLog, Frame } from '../types/apath_log';

describe('PlaybackClock (Phase 2 Master Clock Contract)', () => {
  const mockFrames = [
    {
      step: 0,
      t: 0.0,
      ego: { x: 0.0, y: 0.0, yaw: 0.0, v: 5.0, length: 4.2, width: 1.8, active_state: 'FOLLOW' },
      agents: [
        { id: 'cow_1', class_name: 'cattle', x: 20.0, y: 2.0, yaw: 0.0, length: 2.0, width: 1.0 },
      ],
      planner_output: { replan_triggered: false, latency_ms: 10.0 },
      risk_field: { ego_risk: 0.1, max_risk: 0.2, risk_level: 'LOW' },
    },
    {
      step: 1,
      t: 0.1,
      ego: { x: 1.0, y: 0.2, yaw: 0.1, v: 5.2, length: 4.2, width: 1.8, active_state: 'FOLLOW' },
      agents: [
        { id: 'cow_1', class_name: 'cattle', x: 19.8, y: 1.8, yaw: -0.1, length: 2.0, width: 1.0 },
      ],
      planner_output: { replan_triggered: false, latency_ms: 12.0 },
      risk_field: { ego_risk: 0.15, max_risk: 0.25, risk_level: 'LOW' },
    },
    {
      step: 2,
      t: 0.2,
      ego: { x: 2.0, y: 0.4, yaw: 0.2, v: 5.4, length: 4.2, width: 1.8, active_state: 'FOLLOW' },
      agents: [
        { id: 'cow_1', class_name: 'cattle', x: 19.6, y: 1.6, yaw: -0.2, length: 2.0, width: 1.0 },
      ],
      planner_output: { replan_triggered: true, latency_ms: 14.0 },
      risk_field: { ego_risk: 0.3, max_risk: 0.4, risk_level: 'MEDIUM' },
    },
  ] as unknown as Frame[];

  const mockRunLog = {
    schema_version: 'apath-log/v1',
    run_id: 'test_run',
    timestamp_iso: '2026-11-05T00:00:00Z',
    planner: { id: 'P3', name: 'Adaptive' },
    scenario: { id: 'SCENARIO_5_CATTLE_CROSSING', seed: 2005, split: 'val_b' },
    world: {
      bounds: { x_min: -10, x_max: 60, y_min: -5, y_max: 5 },
      road_boundaries: [
        { side: 'left', points: [[-10, 4], [60, 4]] },
        { side: 'right', points: [[-10, -4], [60, -4]] },
      ],
      static_obstacles: [],
    },
    frames: mockFrames,
    metrics: {
      duration_s: 0.2,
      completed_goal: true,
      collision_occurred: false,
      min_clearance_m: 1.5,
      p95_latency_ms: 14.0,
    },
  } as unknown as RunLog;

  it('interpolates yaw using the shortest angle across wrapping boundaries', () => {
    // 350 deg (approx 6.1086 rad) to 10 deg (approx 0.1745 rad)
    const yaw0 = 6.10865;
    const yaw1 = 0.17453;
    const midYaw = interpolateYaw(yaw0, yaw1, 0.5);

    // Midpoint should be approximately 0.0 (or 2pi / 0 deg), NOT 180 deg
    const normalized = Math.sin(midYaw);
    expect(Math.abs(normalized)).toBeLessThan(0.05);

    // Negative angle: -3.0 to +3.0 rad (shortest arc goes through +/- pi = 3.14159)
    const yawNeg = -3.0;
    const yawPos = 3.0;
    const midWrap = interpolateYaw(yawNeg, yawPos, 0.5);
    // Shortest distance is 2 * (pi - 3.0) = 0.283 rad, mid should cross boundary
    expect(Math.abs(midWrap)).toBeGreaterThan(3.1);
  });

  it('interpolates ego position linearly between 10 Hz keyframes at 60 FPS', () => {
    const clock = new PlaybackClock(mockRunLog);
    // Seek halfway between frame 0 (t=0.0, x=0.0) and frame 1 (t=0.1, x=1.0) -> t=0.05
    clock.seek(0.05);
    const pose = clock.getInterpolatedEgoPose();
    expect(pose).not.toBeNull();
    expect(pose!.x).toBeCloseTo(0.5, 2);
    expect(pose!.y).toBeCloseTo(0.1, 2);
    expect(pose!.v).toBeCloseTo(5.1, 2);
    expect(pose!.yaw).toBeCloseTo(0.05, 2);
  });

  it('strictly clamps playback and never extrapolates beyond the last frame', () => {
    const clock = new PlaybackClock(mockRunLog);
    // Attempt to seek beyond duration (0.2s)
    clock.seek(5.0);
    expect(clock.getState().currentTime).toBe(0.2);
    const pose = clock.getInterpolatedEgoPose();
    expect(pose!.x).toBe(2.0); // Exact coordinate of final frame, no overshoot
  });

  it('maps numeric telemetry strictly to the nearest logged 10 Hz frame', () => {
    const clock = new PlaybackClock(mockRunLog);
    // At t=0.04s, nearest frame is frame 0 (t=0.0s)
    clock.seek(0.04);
    expect(clock.getNearestFrameIndex()).toBe(0);
    expect(clock.getNearestFrame()!.step).toBe(0);

    // At t=0.08s, nearest frame is frame 1 (t=0.1s)
    clock.seek(0.08);
    expect(clock.getNearestFrameIndex()).toBe(1);
    expect(clock.getNearestFrame()!.step).toBe(1);
  });

  it('supports speed changes, playback pausing, and reset', () => {
    const clock = new PlaybackClock(mockRunLog);
    clock.setSpeed(2.0);
    expect(clock.getState().speed).toBe(2.0);

    clock.seek(0.15);
    expect(clock.getState().currentTime).toBe(0.15);

    clock.reset();
    expect(clock.getState().currentTime).toBe(0.0);
    expect(clock.getState().isPlaying).toBe(false);
  });
});
