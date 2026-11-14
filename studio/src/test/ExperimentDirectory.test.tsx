import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { ExperimentDirectory, ExperimentRunRecord } from '../components/runs/ExperimentDirectory';

const mockRuns: ExperimentRunRecord[] = [
  {
    id: 'run_scenario_1_village_road_b1_tune_s1000',
    scenario_id: 'SCENARIO_1_VILLAGE_ROAD',
    scenario_name: 'Unmarked Village Road',
    planner_id: 'B1',
    planner_name: 'Baseline 1: DWA + VO',
    seed: 1000,
    collision_occurred: true,
    completed_goal: false,
    min_clearance_m: 0.0,
    mean_speed_m_s: 3.46,
    max_jerk_m_s3: 30.0,
    mean_jerk_m_s3: 2.18,
    replan_count: 59,
    p95_latency_ms: 6.14,
    duration_s: 5.8,
    path_length_m: 20.24,
    frame_count: 59,
  },
  {
    id: 'run_scenario_5_cattle_crossing_p3_tune_s1000',
    scenario_id: 'SCENARIO_5_CATTLE_CROSSING',
    scenario_name: 'Sudden Cattle Crossing',
    planner_id: 'P3',
    planner_name: 'Planner 3: Risk-Adaptive',
    seed: 1000,
    collision_occurred: false,
    completed_goal: false,
    min_clearance_m: 3.99,
    mean_speed_m_s: 3.98,
    max_jerk_m_s3: 11.67,
    mean_jerk_m_s3: 0.94,
    replan_count: 23,
    p95_latency_ms: 7.32,
    duration_s: 15.9,
    path_length_m: 62.83,
    frame_count: 160,
  },
];

describe('ExperimentDirectory Component', () => {
  it('renders experiment analysis banner and scenario sections', () => {
    render(
      <MemoryRouter>
        <ExperimentDirectory runs={mockRuns} />
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { level: 1, name: /Experiment Runs Directory/i })).toBeInTheDocument();
    expect(screen.getByText(/Total Recorded Runs/i)).toBeInTheDocument();
    expect(screen.getByText(/Unique Road Scenarios/i)).toBeInTheDocument();
    expect(screen.getByText(/Safe \/ Non-Collision Runs/i)).toBeInTheDocument();

    // Verify Scenario 1 and Scenario 5 headings exist via role
    expect(screen.getByRole('heading', { level: 2, name: /Scenario 1: Unmarked Village Road/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: /Scenario 5: Sudden Cattle Crossing/i })).toBeInTheDocument();

    // Verify authentic clearance metrics rendered
    expect(screen.getByText(/3\.99 m/i)).toBeInTheDocument();
    expect(screen.getByText(/0\.00 m/i)).toBeInTheDocument();

    // Verify inspect buttons exist
    const inspectButtons = screen.getAllByRole('button', { name: /Inspect Run/i });
    expect(inspectButtons.length).toBe(2);
  });

  it('filters runs by outcome (Safe vs Collision)', () => {
    render(
      <MemoryRouter>
        <ExperimentDirectory runs={mockRuns} />
      </MemoryRouter>
    );

    // Initial state has both
    expect(screen.getByText('run_scenario_1_village_road_b1_tune_s1000')).toBeInTheDocument();
    expect(screen.getByText('run_scenario_5_cattle_crossing_p3_tune_s1000')).toBeInTheDocument();

    // Filter by Outcome: SAFE
    const outcomeSelect = screen.getByDisplayValue(/All Outcomes/i);
    fireEvent.change(outcomeSelect, { target: { value: 'SAFE' } });

    // Only P3 should be visible
    expect(screen.queryByText('run_scenario_1_village_road_b1_tune_s1000')).not.toBeInTheDocument();
    expect(screen.getByText('run_scenario_5_cattle_crossing_p3_tune_s1000')).toBeInTheDocument();
  });
});
