/**
 * Tests for ADAPTIVE-PATH Showcase Landing Page & Components
 * Verifies rendering of Hero, dual SimCanvas views, Timeline, Results row, and Details Drawer.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { SettingsProvider } from '../context/SettingsContext';
import { I18nProvider } from '../context/I18nContext';
import { Landing } from '../pages/Landing';
import { SimCanvas } from '../components/showcase/SimCanvas';
import { ThinkingBox } from '../components/showcase/ThinkingBox';
import { OutcomeBanner } from '../components/showcase/OutcomeBanner';
import { ShowcaseFrame } from '../components/showcase/types';

const mockFrame: ShowcaseFrame = {
  step: 10,
  t: 1.0,
  ego: {
    x: 10.0,
    y: 0.0,
    yaw: 0.0,
    v: 5.5,
    steering: 0.02,
    length: 4.2,
    width: 1.8,
    active_state: 'SLOW',
  },
  agents: [
    {
      id: 'cow1',
      class_name: 'cattle',
      x: 18.0,
      y: 1.2,
      yaw: 1.5,
      length: 2.4,
      width: 1.1,
      is_occluded: false,
    },
  ],
  caption: 'Yielding to cow crossing road (19.8 km/h).',
  min_clearance_m: 5.9,
};

describe('Showcase Components Unit Tests', () => {
  it('renders SimCanvas without throwing errors', () => {
    const { container } = render(
      <SimCanvas
        frame={mockFrame}
        variant="adaptive"
        showSensors={true}
        showPredictions={true}
        showRiskField={true}
      />
    );
    const canvas = container.querySelector('canvas');
    expect(canvas).not.toBeNull();
  });

  it('renders ThinkingBox with Stateflow chip and kinematics', () => {
    render(<ThinkingBox frame={mockFrame} variant="adaptive" plannerName="P3 Adaptive Controller" />);
    expect(screen.getByText('P3 Adaptive Controller')).not.toBeNull();
    expect(screen.getByText('SLOW')).not.toBeNull();
    expect(screen.getByText('Yielding to cow crossing road (19.8 km/h).')).not.toBeNull();
    expect(screen.getByText('19.8')).not.toBeNull(); // 5.5 m/s * 3.6 = 19.8 km/h
  });

  it('renders OutcomeBanner correctly for successful vs collision states', () => {
    const { rerender } = render(
      <OutcomeBanner
        variant="adaptive"
        metrics={{
          duration_s: 12.0,
          completed_goal: true,
          collision_occurred: false,
          min_clearance_m: 2.8,
          mean_jerk_m_s3: 1.25,
          replan_count: 14,
          p95_latency_ms: 8.5,
          mean_speed_m_s: 5.2,
        }}
      />
    );
    expect(screen.getByText('Reached Goal Safely')).not.toBeNull();

    rerender(
      <OutcomeBanner
        variant="standard"
        metrics={{
          duration_s: 5.1,
          completed_goal: false,
          collision_occurred: true,
          min_clearance_m: 0.0,
          mean_jerk_m_s3: 3.2,
          replan_count: 52,
          p95_latency_ms: 18.2,
          mean_speed_m_s: 4.8,
        }}
      />
    );
    expect(screen.getByText('Collision Occurred')).not.toBeNull();
  });
});

describe('Showcase Landing Page Integration Test', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string) => {
        if (url.includes('summary.json')) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                metadata: {
                  title: 'ADAPTIVE-PATH Benchmark Validation Summary',
                  provenance: 'Validation B — Research Experiment',
                  git_commit: 'test_commit',
                  timestamp: '2026-11-04T00:00:00Z',
                  split: 'val_b',
                  seeds: [2005, 2006, 2007, 2008, 2009],
                  total_episodes_per_planner: 25,
                  disclaimer: 'Simulation only. Not road-ready.',
                },
                headline_metrics: {
                  completion_rate: {
                    label: 'Completion Rate',
                    adaptive: 56.0,
                    standard: 40.0,
                    unit: '%',
                    delta: '+16.0%',
                    delta_label: '1.4x higher goal completion',
                    higher_is_better: true,
                  },
                  collision_rate: {
                    label: 'Crash Rate',
                    adaptive: 20.0,
                    standard: 60.0,
                    unit: '%',
                    delta: '-40.0%',
                    delta_label: '3x fewer collisions',
                    higher_is_better: false,
                  },
                  smoothness_jerk: {
                    label: 'Smoothness (Jerk)',
                    adaptive: 1.25,
                    standard: 1.56,
                    unit: 'm/s³',
                    delta: '-20%',
                    delta_label: '20% smoother ride',
                    higher_is_better: false,
                  },
                  think_time_ms: {
                    label: 'Think Time',
                    adaptive: 6.3,
                    standard: 8.7,
                    unit: 'ms',
                    delta: '-27%',
                    delta_label: 'Sub-10ms real-time control',
                    higher_is_better: false,
                  },
                },
                scenarios: [
                  {
                    key: 'cattle',
                    scenario_id: 'SCENARIO_5_CATTLE_CROSSING',
                    name: 'Cattle Crossing',
                    flagship: true,
                    description: 'Livestock test',
                    adaptive: { completion_rate: 100, collision_rate: 0, jerk_m_s3: 1.64, latency_ms: 7.99 },
                    standard: { completion_rate: 0, collision_rate: 100, jerk_m_s3: 3.25, latency_ms: 23.12 },
                  },
                ],
                weak_spot_analysis: {
                  scenario: 'City Junction (SCENARIO_2_URBAN_INTERSECTION)',
                  why: 'High occlusion from turning vehicles.',
                  future_work: 'Radar Doppler velocity fusion.',
                },
              }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              key: 'cattle',
              scenario_id: 'SCENARIO_5_CATTLE_CROSSING',
              name: 'Cattle Crossing',
              description: 'Livestock wandering',
              road_users: ['cattle'],
              seed: 2005,
              adaptive: {
                scenario_id: 'SCENARIO_5_CATTLE_CROSSING',
                planner_id: 'P3',
                metrics: {
                  duration_s: 12.0,
                  completed_goal: true,
                  collision_occurred: false,
                  min_clearance_m: 2.8,
                  mean_jerk_m_s3: 1.25,
                  replan_count: 14,
                  p95_latency_ms: 8.5,
                  mean_speed_m_s: 5.2,
                },
                frames: [mockFrame],
              },
              standard: {
                scenario_id: 'SCENARIO_5_CATTLE_CROSSING',
                planner_id: 'B1',
                metrics: {
                  duration_s: 5.1,
                  completed_goal: false,
                  collision_occurred: true,
                  min_clearance_m: 0.0,
                  mean_jerk_m_s3: 3.2,
                  replan_count: 52,
                  p95_latency_ms: 18.2,
                  mean_speed_m_s: 4.8,
                },
                frames: [mockFrame],
              },
            }),
        });
      })
    );
  });

  it('renders headline, CTAs, and opens DetailsDrawer upon request', async () => {
    render(
      <BrowserRouter>
        <SettingsProvider>
          <I18nProvider>
            <Landing />
          </I18nProvider>
        </SettingsProvider>
      </BrowserRouter>
    );

    // Check Hero text
    expect(screen.getByText('Self-driving navigation built for Indian roads.')).not.toBeNull();
    expect(screen.getByText('Watch it drive')).not.toBeNull();
    expect(screen.getByText('Play full demo tour (3 min)')).not.toBeNull();

    // Check Results numbers from mock
    await waitFor(() => {
      expect(screen.getByText('56%')).not.toBeNull();
      expect(screen.getByText('20%')).not.toBeNull();
    });

    // Check Details & Code drawer toggle
    const detailsBtn = screen.getByText('Details & Code');
    fireEvent.click(detailsBtn);
    expect(screen.getByText('One-Command Benchmark Reproduction')).not.toBeNull();
    expect(screen.getByText('python scripts/reproduce_all.py')).not.toBeNull();
  });
});
