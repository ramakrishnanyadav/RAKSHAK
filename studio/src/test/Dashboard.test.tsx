import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { Dashboard } from '../pages/Dashboard';
import { I18nProvider } from '../context/I18nContext';
import { SettingsProvider } from '../context/SettingsContext';
import { apiClient } from '../api/client';

describe('Dashboard Component (Phase 1A Contract)', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
    vi.restoreAllMocks();
  });

  it('proves that manifest entries without completed_goal never default to true', async () => {
    // Force offline path by making apiClient.listRuns reject
    vi.spyOn(apiClient, 'listRuns').mockRejectedValue(new Error('Backend offline'));

    // Mock manifest with missing completed_goal and missing clearance
    const mockManifestWithoutCompleted = [
      {
        id: 'run_test_missing_goal',
        scenario_id: 'SCENARIO_1_VILLAGE_ROAD',
        planner_id: 'P3',
        split: 'test',
        seed: 1000,
        // Notice completed_goal is completely missing
        collision_occurred: false,
        // Notice min_clearance_m is completely missing
      },
      {
        id: 'run_test_completed_goal',
        scenario_id: 'SCENARIO_2_URBAN_INTERSECTION',
        planner_id: 'B1',
        split: 'test',
        seed: 1001,
        completed_goal: true,
        collision_occurred: false,
        min_clearance_m: 3.5,
        p95_latency_ms: 15.0,
      },
    ];

    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('manifest.json')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockManifestWithoutCompleted),
        });
      }
      return Promise.reject(new Error('Unknown url'));
    });

    render(
      <QueryClientProvider client={queryClient}>
        <I18nProvider>
          <SettingsProvider>
            <MemoryRouter>
              <Dashboard />
            </MemoryRouter>
          </SettingsProvider>
        </I18nProvider>
      </QueryClientProvider>
    );

    await waitFor(() => {
      // Completed trips should be 1 of 1 valid goal runs, not 2 of 2
      expect(screen.getByText('COMPLETED TRIPS')).not.toBeNull();
      expect(screen.getAllByText('100%').length).toBeGreaterThan(0);
      expect(screen.getByText('1 of 1 runs reached goal')).not.toBeNull();
    });

    // Check that MEAN P95 LATENCY card is present with correct title
    expect(screen.getByText('MEAN P95 LATENCY')).not.toBeNull();
    expect(screen.getByText(/15\.0\s*ms/)).not.toBeNull();
    expect(screen.getByText('Mean across 1 of 2 runs')).not.toBeNull();

    // Check that missing values render as dash (—)
    const dashes = screen.getAllByText('—');
    expect(dashes.length).toBeGreaterThan(0);
  });

  it('renders dashes for all metrics when manifest has zero outcome data', async () => {
    vi.spyOn(apiClient, 'listRuns').mockRejectedValue(new Error('Backend offline'));

    const mockEmptyMetricsManifest = [
      {
        id: 'run_incomplete',
        scenario_id: 'SCENARIO_5_CATTLE_CROSSING',
        planner_id: 'P3',
      },
    ];

    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('manifest.json')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockEmptyMetricsManifest),
        });
      }
      return Promise.reject(new Error('Unknown url'));
    });

    render(
      <QueryClientProvider client={queryClient}>
        <I18nProvider>
          <SettingsProvider>
            <MemoryRouter>
              <Dashboard />
            </MemoryRouter>
          </SettingsProvider>
        </I18nProvider>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('No outcome data recorded')).not.toBeNull();
      expect(screen.getByText('No collision data recorded')).not.toBeNull();
      expect(screen.getByText('No latency data recorded')).not.toBeNull();
    });
  });
});
