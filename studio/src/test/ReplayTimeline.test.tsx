/**
 * Component Tests for ReplayTimeline.
 * Verifies timeline playback controls, speed switching, frame scrubbing,
 * and replan event indicators.
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ReplayTimeline } from '../components/ReplayTimeline';
import { AnnouncerProvider } from '../components/LiveAnnouncer';
import { SettingsProvider } from '../context/SettingsContext';
import { I18nProvider } from '../context/I18nContext';
import { RunLog } from '../types/apath_log';

const mockRunLog: RunLog = {
  schema_version: 'apath-log/v1',
  run_id: 'test_run_1',
  timestamp_iso: '2026-10-14T00:00:00Z',
  config_hash: 'abc',
  git_commit: 'main',
  engine: { name: 'python_inprocess', version: '1.0.0' },
  scenario: {
    id: 'SCENARIO_5_CATTLE_CROSSING',
    name: 'Sudden Cattle Crossing',
    split: 'tune',
    seed: 1000,
    params: {},
  },
  planner: {
    id: 'P3',
    name: 'Risk-Adaptive Planner',
    config: {},
  },
  world: {
    bounds: { x_min: 0, x_max: 100, y_min: -10, y_max: 10 },
    road_boundaries: [],
    static_obstacles: [],
  },
  metrics: {
    duration_s: 1.0,
    completed_goal: true,
    collision_occurred: false,
    near_miss_count: 0,
    min_clearance_m: 3.5,
    mean_speed_m_s: 6.0,
    max_jerk_m_s3: 1.2,
    mean_jerk_m_s3: 0.8,
    replan_count: 1,
    p95_latency_ms: 18.0,
    failure_tag: null,
  },
  frames: [
    {
      step: 0,
      t: 0.0,
      ego: {
        x: 10,
        y: 0,
        yaw: 0,
        v: 6.0,
        steering: 0,
        acceleration: 0,
        jerk: 0,
        length: 4.5,
        width: 1.8,
        active_state: 'FOLLOW',
      },
      agents: [],
      risk_field: {
        max_risk: 0.1,
        ego_risk: 0.05,
        critical_agent_id: null,
        risk_level: 'LOW',
      },
      planner_output: {
        replan_triggered: false,
        trigger_reason: null,
        cost_breakdown: { collision_cost: 0, progress_cost: 0, smoothness_cost: 0, risk_field_cost: 0, total_cost: 0 },
        latency_ms: 15,
        planned_trajectory: [],
      },
      decision_trace: 'Nominal corridor following',
    },
    {
      step: 1,
      t: 0.1,
      ego: {
        x: 10.6,
        y: 0,
        yaw: 0,
        v: 6.0,
        steering: 0,
        acceleration: 0,
        jerk: 0,
        length: 4.5,
        width: 1.8,
        active_state: 'BYPASS',
      },
      agents: [],
      risk_field: {
        max_risk: 0.82,
        ego_risk: 0.82,
        critical_agent_id: 'cattle_1',
        risk_level: 'CRITICAL',
      },
      planner_output: {
        replan_triggered: true,
        trigger_reason: 'RISK_THRESHOLD_EXCEEDED',
        cost_breakdown: { collision_cost: 0, progress_cost: 0, smoothness_cost: 0, risk_field_cost: 0, total_cost: 0 },
        latency_ms: 18,
        planned_trajectory: [],
      },
      decision_trace: 'Cattle crossed corridor',
    },
  ],
};

describe('ReplayTimeline', () => {
  it('triggers onPlayPause callback when Play button is clicked', () => {
    const handlePlayPause = vi.fn();
    render(
      <SettingsProvider>
        <I18nProvider>
          <AnnouncerProvider>
            <ReplayTimeline
              runLog={mockRunLog}
              currentFrameIndex={0}
              isPlaying={false}
              speed={1.0}
              onPlayPause={handlePlayPause}
              onStepFrame={() => {}}
              onSeekFrame={() => {}}
              onSetSpeed={() => {}}
              onReset={() => {}}
            />
          </AnnouncerProvider>
        </I18nProvider>
      </SettingsProvider>
    );

    const playBtn = screen.getByLabelText(/Play replay simulation/i);
    fireEvent.click(playBtn);
    expect(handlePlayPause).toHaveBeenCalledTimes(1);
  });

  it('triggers onSetSpeed callback when speed selector button is clicked', () => {
    const handleSetSpeed = vi.fn();
    render(
      <SettingsProvider>
        <I18nProvider>
          <AnnouncerProvider>
            <ReplayTimeline
              runLog={mockRunLog}
              currentFrameIndex={0}
              isPlaying={false}
              speed={1.0}
              onPlayPause={() => {}}
              onStepFrame={() => {}}
              onSeekFrame={() => {}}
              onSetSpeed={handleSetSpeed}
              onReset={() => {}}
            />
          </AnnouncerProvider>
        </I18nProvider>
      </SettingsProvider>
    );

    const speed2xBtn = screen.getByLabelText('Playback speed 2x');
    fireEvent.click(speed2xBtn);
    expect(handleSetSpeed).toHaveBeenCalledWith(2.0);
  });

  it('discloses adaptive replan trigger status banner when current frame triggered replan', () => {
    render(
      <SettingsProvider>
        <I18nProvider>
          <AnnouncerProvider>
            <ReplayTimeline
              runLog={mockRunLog}
              currentFrameIndex={1} // Frame 1 has replan_triggered = true
              isPlaying={false}
              speed={1.0}
              onPlayPause={() => {}}
              onStepFrame={() => {}}
              onSeekFrame={() => {}}
              onSetSpeed={() => {}}
              onReset={() => {}}
            />
          </AnnouncerProvider>
        </I18nProvider>
      </SettingsProvider>
    );

    expect(screen.getByText('Adaptive Replan Triggered:')).toBeDefined();
    expect(screen.getByText('Cattle crossed corridor')).toBeDefined();
  });
});
