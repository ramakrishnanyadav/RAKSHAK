import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MatlabValidationView } from '../pages/MatlabValidationView';

describe('MatlabValidationView Component (Stage 4G.4 Engineering Studio)', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.restoreAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
  });

  const renderComponent = () =>
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <MatlabValidationView />
        </MemoryRouter>
      </QueryClientProvider>
    );

  it('renders clean validation header, subtitle, MathWorks logo, and service indicator', () => {
    renderComponent();

    // Primary Header & Subtitle
    expect(screen.getByRole('heading', { level: 1, name: /MATLAB Vehicle Engineering Studio/i })).toBeInTheDocument();
    expect(screen.getByText(/Simulink vehicle dynamics SIL validation\./i)).toBeInTheDocument();
    expect(screen.getByText(/ADR-004E Option C/i)).toBeInTheDocument();

    // Honest Service Status
    expect(screen.getByText(/Service:/i)).toBeInTheDocument();
    expect(screen.getByText(/Standby/i)).toBeInTheDocument();
  });

  it('renders scenario selector defaulting to Scenario J', () => {
    renderComponent();

    // Check selector defaults to J
    const selector = screen.getByLabelText(/Select Test Scenario/i) as HTMLSelectElement;
    expect(selector.value).toBe('J');
  });

  it('renders 3D simulation replay viewport and control bar', () => {
    renderComponent();

    expect(screen.getByText(/Python Ref Track/i)).toBeInTheDocument();
    expect(screen.getByText(/Simulink SIL Plant/i)).toBeInTheDocument();

    // Controls for replay
    expect(screen.getByRole('button', { name: /Pause Simulation|Play Simulation/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Reset Simulation to Step 0/i })).toBeInTheDocument();
  });

  it('switches between 1. Model View, 2. Signal Analysis, and 3. Validation Results', () => {
    renderComponent();

    // Default tab is 1. Model View
    expect(screen.getByText(/adaptive_path_controller_wp_a\.slx/i)).toBeInTheDocument();

    // Switch to 2. Signal Analysis Workspace
    const signalTab = screen.getByRole('button', { name: /2\. Signal Analysis/i });
    fireEvent.click(signalTab);
    expect(screen.getByText(/Synchronized comparison of production Python command/i)).toBeInTheDocument();

    // Switch to 3. Validation Results
    const resultsTab = screen.getByRole('button', { name: /3\. Validation Results/i });
    fireEvent.click(resultsTab);
    expect(screen.getByText(/Divergence Mechanism & Physical Grounding:/i)).toBeInTheDocument();
  });

  it('switches to Scenario H and discloses rate-limited steering reversal divergence in Validation Results', () => {
    renderComponent();

    const selector = screen.getByLabelText(/Select Test Scenario/i);
    fireEvent.change(selector, { target: { value: 'H' } });

    // Open Validation Results tab
    const resultsTab = screen.getByRole('button', { name: /3\. Validation Results/i });
    fireEvent.click(resultsTab);

    // Scenario H is CONDITIONAL with authentic 11.122 m drift
    expect(screen.getAllByText(/CONDITIONAL/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/11\.122 m/i)).toBeInTheDocument();

    // Explains rate-limiter slew saturation
    expect(screen.getByText(/Physical Slew Rate Saturation/i)).toBeInTheDocument();
  });

  it('toggles Advanced Evidence drawer and Fault 32 disclosure within Validation Results', () => {
    renderComponent();

    // Switch to 3. Validation Results
    const resultsTab = screen.getByRole('button', { name: /3\. Validation Results/i });
    fireEvent.click(resultsTab);

    const drawerToggle = screen.getByRole('button', { name: /Advanced Evidence & Detailed Traces/i });
    fireEvent.click(drawerToggle);

    expect(screen.getByRole('button', { name: /1\. 10-Scenario Parity Matrix/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /3\. Fault 32 Safety & Latency Stats/i })).toBeInTheDocument();

    // Click Fault 32 tab
    const faultTab = screen.getByRole('button', { name: /3\. Fault 32 Safety & Latency Stats/i });
    fireEvent.click(faultTab);

    expect(screen.getByText(/Fault 32: In-Flight Step Timeout/i)).toBeInTheDocument();
    expect(screen.getByText(/Soft Real-Time Performance Disclosure/i)).toBeInTheDocument();
  });
});
