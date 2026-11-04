import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { SettingsProvider } from '../context/SettingsContext';
import { NewRun } from '../pages/NewRun';
import { apiClient } from '../api/client';

const renderWithProviders = (ui: React.ReactElement) => {
  return render(
    <SettingsProvider>
      {ui}
    </SettingsProvider>
  );
};

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('NewRun Guided Three-Step Simulation Experience', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders Step 1 with all 5 canonical scenarios and navigates to Step 2', async () => {
    renderWithProviders(
      <MemoryRouter initialEntries={['/app/runs/new']}>
        <NewRun />
      </MemoryRouter>
    );

    // Verify Step 1 header and progress
    expect(screen.getByText('Step 1: Choose a Road Environment')).not.toBeNull();
    expect(screen.getByText('5 Canonical Indian Road Scenarios')).not.toBeNull();

    // Verify all 5 canonical scenarios from engine/scenarios/registry.py are present
    expect(screen.getByText(/1\. Unmarked Village Road/)).not.toBeNull();
    expect(screen.getByText(/2\. Busy Unsignalized Urban Intersection/)).not.toBeNull();
    expect(screen.getByText(/3\. Highway Merge with Slow Vehicles/)).not.toBeNull();
    expect(screen.getByText(/4\. Dense Market with Occluded Emergence/)).not.toBeNull();
    expect(screen.getByText(/5\. Sudden Cattle Crossing/)).not.toBeNull();

    // Click Continue to Driving Strategy
    const continueBtn = screen.getByRole('button', { name: /Continue to Driving Strategy/i });
    fireEvent.click(continueBtn);

    // Verify navigated to Step 2
    expect(screen.getByText('Step 2: Choose a Driving Strategy')).not.toBeNull();
  });

  it('displays P3 and B0 in Simple Mode with plain-language explanations', async () => {
    renderWithProviders(
      <MemoryRouter initialEntries={['/app/runs/new']}>
        <NewRun />
      </MemoryRouter>
    );

    // Navigate to Step 2
    fireEvent.click(screen.getByRole('button', { name: /Continue to Driving Strategy/i }));

    // In Simple Mode: P3 and B0 should be rendered
    expect(screen.getByText('P3: Adaptive Strategy')).not.toBeNull();
    expect(screen.getByText(/RECOMMENDED ADAPTIVE AI/i)).not.toBeNull();
    expect(screen.getByText(/Our smart driving system/i)).not.toBeNull();

    expect(screen.getByText('B0: Direct Path Baseline')).not.toBeNull();
    expect(screen.getByText(/IDENTIFIED NON-ADAPTIVE BASELINE/i)).not.toBeNull();
    expect(screen.getByText(/A simple baseline car that drives straight along the road center/i)).not.toBeNull();
  });

  it('exposes all six canonical planners (B0, B1, B2, P1, P2, P3) in Research Mode', async () => {
    renderWithProviders(
      <MemoryRouter initialEntries={['/app/runs/new']}>
        <NewRun />
      </MemoryRouter>
    );

    // Navigate to Step 2
    fireEvent.click(screen.getByRole('button', { name: /Continue to Driving Strategy/i }));

    // Toggle to Research Mode
    const researchModeBtn = screen.getByRole('button', { name: /Research Mode \(All 6 Planners\)/i });
    fireEvent.click(researchModeBtn);

    // Verify all 6 actual planners are rendered with actual names and experimental purpose
    expect(screen.getByText('P3: Adaptive Multi-Path Replanner')).not.toBeNull();
    expect(screen.getByText('P2: Risk-Field Optimal Trajectory Planner')).not.toBeNull();
    expect(screen.getByText('P1: Spatiotemporal Predictive Lattice Planner')).not.toBeNull();
    expect(screen.getByText('B2: Kinematic Hybrid A* Search')).not.toBeNull();
    expect(screen.getByText('B1: Dynamic Window Approach + Velocity Obstacles (DWA-VO)')).not.toBeNull();
    expect(screen.getByText('B0: Shortest Path / Constant Speed Baseline')).not.toBeNull();

    // Select B2 Kinematic Hybrid A*
    const b2Option = screen.getByLabelText('B2: Kinematic Hybrid A* Search');
    fireEvent.click(b2Option);

    // Navigate to Step 3
    fireEvent.click(screen.getByRole('button', { name: /Continue to Review & Start/i }));

    // Verify Step 3 shows selected planner B2
    expect(screen.getByText('Step 3: Review Configuration & Launch')).not.toBeNull();
    expect(screen.getByText('B2: Kinematic Hybrid A* Search')).not.toBeNull();
  });

  it('validates invalid seed and shows error', async () => {
    const { container } = renderWithProviders(
      <MemoryRouter initialEntries={['/app/runs/new']}>
        <NewRun />
      </MemoryRouter>
    );

    // Step 1 -> Step 2 -> Step 3
    fireEvent.click(screen.getByRole('button', { name: /Continue to Driving Strategy/i }));
    fireEvent.click(screen.getByRole('button', { name: /Continue to Review & Start/i }));

    // Set invalid seed
    const seedInput = screen.getByLabelText(/RANDOM SEED/i);
    fireEvent.change(seedInput, { target: { value: '0' } });

    // Submit form directly to trigger handleLaunch
    const form = container.querySelector('form');
    expect(form).not.toBeNull();
    if (form) {
      fireEvent.submit(form);
    }

    // Expect validation error
    expect(screen.getByText(/Random seed must be a positive integer/i)).not.toBeNull();
  });

  it('handles API errors authentically without fake mock data', async () => {
    vi.spyOn(apiClient, 'createRun').mockRejectedValueOnce(new Error('Connection refused to simulation worker:5000'));

    const { container } = renderWithProviders(
      <MemoryRouter initialEntries={['/app/runs/new']}>
        <NewRun />
      </MemoryRouter>
    );

    // Step 1 -> Step 2 -> Step 3
    fireEvent.click(screen.getByRole('button', { name: /Continue to Driving Strategy/i }));
    fireEvent.click(screen.getByRole('button', { name: /Continue to Review & Start/i }));

    // Submit form
    const form = container.querySelector('form');
    expect(form).not.toBeNull();
    if (form) {
      fireEvent.submit(form);
    }

    // Expect authentic error message
    await waitFor(() => {
      expect(screen.getByRole('alert')).not.toBeNull();
      expect(screen.getByText(/Simulation Launch Failed: Connection refused to simulation worker:5000/i)).not.toBeNull();
    });
  });

  it('dispatches real simulation run and navigates on success', async () => {
    vi.spyOn(apiClient, 'createRun').mockResolvedValueOnce({
      id: 'run_test_launch_success_999',
      status: 'queued',
    });

    const { container } = renderWithProviders(
      <MemoryRouter initialEntries={['/app/runs/new']}>
        <NewRun />
      </MemoryRouter>
    );

    // Step 1 -> Step 2 -> Step 3
    fireEvent.click(screen.getByRole('button', { name: /Continue to Driving Strategy/i }));
    fireEvent.click(screen.getByRole('button', { name: /Continue to Review & Start/i }));

    // Submit form
    const form = container.querySelector('form');
    expect(form).not.toBeNull();
    if (form) {
      fireEvent.submit(form);
    }

    await waitFor(() => {
      expect(apiClient.createRun).toHaveBeenCalledWith({
        scenario_id: 'SCENARIO_5_CATTLE_CROSSING',
        planner_id: 'P3',
        engine_adapter: 'python_inprocess',
        split: 'test',
        seed: 1000,
        scenario_params: {
          conformal_coverage_alpha: 0.05,
          risk_threshold: 0.65,
        },
      });
    });

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/app/runs/run_test_launch_success_999');
    });
  });
});
