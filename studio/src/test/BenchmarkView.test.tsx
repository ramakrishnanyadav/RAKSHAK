import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BenchmarkView } from '../pages/BenchmarkView';
import { apiClient } from '../api/client';
import { ValidationBManifest } from '../types/api';

const mockManifest: ValidationBManifest = {
  metadata: {
    title: 'Phase 1 Step 3B - Validation B Benchmark Manifest',
    git_commit: '07fa1ff019aa09c852a8efb3f77867ea1d0c8eef',
    timestamp: '2026-11-03T14:17:05.120041+00:00',
    split: 'val_b',
    seeds: [2005, 2006, 2007, 2008, 2009],
    scenarios: [
      'SCENARIO_1_VILLAGE_ROAD',
      'SCENARIO_2_URBAN_INTERSECTION',
      'SCENARIO_3_HIGHWAY_MERGE',
      'SCENARIO_4_DENSE_MARKET',
      'SCENARIO_5_CATTLE_CROSSING',
    ],
    total_episodes_per_planner: 25,
  },
  configurations: {
    P3_Corrected: {
      description: 'P3 Adaptive Planner with F3 stationary persistence penalty.',
      planner_id: 'P3',
      params: { w_stall: 4.0, w_prog: 2.2 },
      aggregate: {
        episode_count: 25,
        safe_progress_rate: 0.56,
        collision_rate: 0.20,
        goal_completion_rate: 0.56,
        total_near_misses: 235,
        min_clearance_overall_m: 0.0,
        mean_min_clearance_m: 2.95,
        mean_jerk_m_s3: 1.254,
        max_jerk_m_s3: 18.733,
        mean_stopped_duration_s: 0.0,
        total_mrm_activations: 19,
        total_mrm_recoveries: 17,
        mean_p95_latency_ms: 37.79,
        mean_latency_ms: 6.32,
      },
      scenario_breakdown: {
        SCENARIO_5_CATTLE_CROSSING: {
          aggregate: {
            episode_count: 5,
            safe_progress_rate: 1.0,
            collision_rate: 0.0,
            goal_completion_rate: 1.0,
            total_near_misses: 12,
            min_clearance_overall_m: 0.69,
            mean_min_clearance_m: 0.69,
            mean_jerk_m_s3: 1.643,
            max_jerk_m_s3: 14.2,
            mean_stopped_duration_s: 0.0,
            total_mrm_activations: 2,
            total_mrm_recoveries: 2,
            mean_p95_latency_ms: 51.44,
            mean_latency_ms: 8.1,
          },
          episodes: [],
        },
      },
    },
    B1_Baseline: {
      description: 'B1 DWA-VO Planner baseline.',
      planner_id: 'B1',
      params: {},
      aggregate: {
        episode_count: 25,
        safe_progress_rate: 0.40,
        collision_rate: 0.60,
        goal_completion_rate: 0.40,
        total_near_misses: 81,
        min_clearance_overall_m: 0.0,
        mean_min_clearance_m: 2.72,
        mean_jerk_m_s3: 1.564,
        max_jerk_m_s3: 17.333,
        mean_stopped_duration_s: 0.0,
        total_mrm_activations: 26,
        total_mrm_recoveries: 20,
        mean_p95_latency_ms: 22.34,
        mean_latency_ms: 4.12,
      },
      scenario_breakdown: {
        SCENARIO_5_CATTLE_CROSSING: {
          aggregate: {
            episode_count: 5,
            safe_progress_rate: 0.0,
            collision_rate: 1.0,
            goal_completion_rate: 0.0,
            total_near_misses: 20,
            min_clearance_overall_m: 0.0,
            mean_min_clearance_m: 0.0,
            mean_jerk_m_s3: 3.252,
            max_jerk_m_s3: 16.5,
            mean_stopped_duration_s: 0.0,
            total_mrm_activations: 5,
            total_mrm_recoveries: 3,
            mean_p95_latency_ms: 62.67,
            mean_latency_ms: 9.3,
          },
          episodes: [],
        },
      },
    },
  },
};

describe('BenchmarkView Authentic Research Validation Integration', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
  });

  it('renders research provenance banner and metadata', async () => {
    vi.spyOn(apiClient, 'getValidationBManifest').mockResolvedValueOnce(mockManifest);

    render(
      <QueryClientProvider client={queryClient}>
        <BenchmarkView />
      </QueryClientProvider>
    );

    // Verify explicit dataset isolation badge and provenance after query resolves
    expect(await screen.findByText('runs/val_b_manifest.json')).not.toBeNull();
    expect(screen.getByText('Validation B — Research Experiment')).not.toBeNull();
    expect(screen.getByText('07fa1ff019')).not.toBeNull();
    expect(screen.getByText(/2005, 2006, 2007, 2008, 2009/)).not.toBeNull();
    expect(screen.getByText(/25 episodes \(5 scenarios × 5 seeds\)/)).not.toBeNull();
  });

  it('renders authentic benchmark metrics from manifest', async () => {
    vi.spyOn(apiClient, 'getValidationBManifest').mockResolvedValueOnce(mockManifest);

    render(
      <QueryClientProvider client={queryClient}>
        <BenchmarkView />
      </QueryClientProvider>
    );

    await waitFor(() => {
      // P3 Corrected values
      expect(screen.getByText('P3: Adaptive Replanner (F3 Corrected)')).not.toBeNull();
      expect(screen.getByText('56.0%')).not.toBeNull(); // Goal completion
      expect(screen.getByText('20.0%')).not.toBeNull(); // Collision
      expect(screen.getByText('2.95 m')).not.toBeNull(); // Clearance
      expect(screen.getByText('1.254')).not.toBeNull(); // Jerk
      expect(screen.getByText('37.8 ms')).not.toBeNull(); // Latency
      expect(screen.getByText('235 frames')).not.toBeNull(); // Near miss frames
      expect(screen.getByText('(9.4 / ep)')).not.toBeNull(); // Per episode frames

      // B1 Baseline values
      expect(screen.getByText('B1: Dynamic Window Approach (DWA-VO)')).not.toBeNull();
      expect(screen.getByText('40.0%')).not.toBeNull();
      expect(screen.getByText('60.0%')).not.toBeNull();
      expect(screen.getByText('2.72 m')).not.toBeNull();
      expect(screen.getByText('1.564')).not.toBeNull();
      expect(screen.getByText('22.3 ms')).not.toBeNull();
      expect(screen.getByText('81 frames')).not.toBeNull();
      expect(screen.getByText('(3.2 / ep)')).not.toBeNull();
    });
  });

  it('allows filtering by scenario and displays scenario-specific aggregates', async () => {
    vi.spyOn(apiClient, 'getValidationBManifest').mockResolvedValueOnce(mockManifest);

    render(
      <QueryClientProvider client={queryClient}>
        <BenchmarkView />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Validation B — Research Experiment')).not.toBeNull();
    });

    // Select Scenario 5: Sudden Cattle Crossing
    const select = screen.getByLabelText(/Select scenario scope/i);
    fireEvent.change(select, { target: { value: 'SCENARIO_5_CATTLE_CROSSING' } });

    // Under Cattle Crossing: P3 achieved 100% completion & 0% collision; B1 had 0% completion & 100% collision
    await waitFor(() => {
      expect(screen.getAllByText('100.0%').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('0.0%').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('renders authentic error state when manifest fails to load', async () => {
    vi.spyOn(apiClient, 'getValidationBManifest').mockRejectedValueOnce(
      new Error('Manifest file not found on server')
    );

    render(
      <QueryClientProvider client={queryClient}>
        <BenchmarkView />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Validation Benchmark Data Unavailable')).not.toBeNull();
      expect(screen.getByText('Manifest file not found on server')).not.toBeNull();
    });
  });
});
