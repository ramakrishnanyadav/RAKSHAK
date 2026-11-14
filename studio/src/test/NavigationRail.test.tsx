import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { NavigationRail } from '../components/NavigationRail';
import { I18nProvider } from '../context/I18nContext';
import { AuthProvider } from '../context/AuthContext';

describe('NavigationRail Five-Destination Architecture (Stage 4G.7)', () => {
  it('renders all five primary destinations: Home, Scenarios, Live Simulation, Results, and MATLAB Studio', () => {
    render(
      <MemoryRouter initialEntries={['/app']}>
        <AuthProvider>
          <I18nProvider>
            <NavigationRail />
          </I18nProvider>
        </AuthProvider>
      </MemoryRouter>
    );

    // Verify 5 Primary Destinations
    expect(screen.getByText('Home')).not.toBeNull();
    expect(screen.getByText('Scenarios')).not.toBeNull();
    expect(screen.getByText('Live Simulation')).not.toBeNull();
    expect(screen.getByText('Results')).not.toBeNull();
    expect(screen.getByText('MATLAB Studio')).not.toBeNull();

    // Verify sub-text descriptions
    expect(screen.getByText('Overview & Activity')).not.toBeNull();
    expect(screen.getByText('Indian Road Library')).not.toBeNull();
    expect(screen.getByText('3D Workstation')).not.toBeNull();
    expect(screen.getByText('Replay & Test History')).not.toBeNull();
    expect(screen.getByText('Simulink SIL Plant')).not.toBeNull();
  });

  it('renders the Advanced Research section with Compare, What Went Wrong, Benchmark, and Reports', () => {
    render(
      <MemoryRouter initialEntries={['/app']}>
        <AuthProvider>
          <I18nProvider>
            <NavigationRail />
          </I18nProvider>
        </AuthProvider>
      </MemoryRouter>
    );

    expect(screen.getByText('Advanced Research')).not.toBeNull();
    expect(screen.getByText('Compare Runs')).not.toBeNull();
    expect(screen.getByText('What Went Wrong')).not.toBeNull();
    expect(screen.getByText('Ablation Benchmark')).not.toBeNull();
    expect(screen.getByText('Validation Reports')).not.toBeNull();
  });

  it('preserves all primary links without broken routes', () => {
    render(
      <MemoryRouter initialEntries={['/app']}>
        <AuthProvider>
          <I18nProvider>
            <NavigationRail />
          </I18nProvider>
        </AuthProvider>
      </MemoryRouter>
    );

    const homeLink = screen.getByLabelText(/Home: Overview & Activity/i);
    expect(homeLink.getAttribute('href')).toBe('/app');

    const scenariosLink = screen.getByLabelText(/Scenarios: Indian Road Library/i);
    expect(scenariosLink.getAttribute('href')).toBe('/app/scenarios');

    const liveLink = screen.getByLabelText(/Live Simulation: 3D Workstation/i);
    expect(liveLink.getAttribute('href')).toBe('/app/workstation');

    const resultsLink = screen.getByLabelText(/Results: Replay & Test History/i);
    expect(resultsLink.getAttribute('href')).toBe('/app/runs');

    const matlabLink = screen.getByLabelText(/MATLAB Studio: Simulink SIL Plant/i);
    expect(matlabLink.getAttribute('href')).toBe('/app/matlab');

    const settingsLink = screen.getByLabelText(/User Settings and Preferences/i);
    expect(settingsLink.getAttribute('href')).toBe('/app/settings/profile');
  });
});
