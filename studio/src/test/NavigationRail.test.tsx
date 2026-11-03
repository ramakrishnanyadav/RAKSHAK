import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { NavigationRail } from '../components/NavigationRail';
import { I18nProvider } from '../context/I18nContext';
import { AuthProvider } from '../context/AuthContext';

describe('NavigationRail Unified Four-Workspace Architecture', () => {
  it('renders all four primary workspaces: Home, Simulate, Results, and Research', () => {
    render(
      <MemoryRouter initialEntries={['/app']}>
        <AuthProvider>
          <I18nProvider>
            <NavigationRail />
          </I18nProvider>
        </AuthProvider>
      </MemoryRouter>
    );

    // Verify 4 Primary Workspace Headings
    expect(screen.getByText('Home')).not.toBeNull();
    expect(screen.getByText('Simulate')).not.toBeNull();
    expect(screen.getByText('Results')).not.toBeNull();
    expect(screen.getByText('Research')).not.toBeNull();

    // Verify workspace sub-text descriptions
    expect(screen.getByText('Overview & Activity')).not.toBeNull();
    expect(screen.getByText('Scenarios & Preparation')).not.toBeNull();
    expect(screen.getByText('Replay & Comparison')).not.toBeNull();
    expect(screen.getByText('Benchmarks & Safety')).not.toBeNull();
  });

  it('houses Compare Runs inside the Results workspace', () => {
    render(
      <MemoryRouter initialEntries={['/app/compare']}>
        <AuthProvider>
          <I18nProvider>
            <NavigationRail />
          </I18nProvider>
        </AuthProvider>
      </MemoryRouter>
    );

    // Verify Compare Runs is rendered as a sub-item
    const compareLink = screen.getByRole('menuitem', { name: /Compare/i });
    expect(compareLink).not.toBeNull();
    expect(compareLink.getAttribute('href')).toBe('/app/compare');

    // Verify Results Workspace header is active
    const resultsHeader = screen.getByLabelText(/Results Workspace: Replay & Comparison/i);
    expect(resultsHeader).not.toBeNull();
    expect(resultsHeader.style.borderLeft).toContain('solid');
  });

  it('preserves all sub-routes across all four workspaces without broken links', () => {
    render(
      <MemoryRouter initialEntries={['/app']}>
        <AuthProvider>
          <I18nProvider>
            <NavigationRail />
          </I18nProvider>
        </AuthProvider>
      </MemoryRouter>
    );

    // Simulate Sub-Items
    const scenariosLink = screen.getByRole('menuitem', { name: /Scenarios/i });
    expect(scenariosLink.getAttribute('href')).toBe('/app/scenarios');

    const newRunLink = screen.getByRole('menuitem', { name: /Start Simulation/i });
    expect(newRunLink.getAttribute('href')).toBe('/app/runs/new');

    // Results Sub-Items
    const replayLink = screen.getByRole('menuitem', { name: /Replay/i });
    expect(replayLink.getAttribute('href')).toBe('/app/runs');

    const reportsLink = screen.getByRole('menuitem', { name: /Reports/i });
    expect(reportsLink.getAttribute('href')).toBe('/app/reports');

    // Research Sub-Items
    const benchmarkLink = screen.getByRole('menuitem', { name: /Benchmark/i });
    expect(benchmarkLink.getAttribute('href')).toBe('/app/benchmark');

    const failuresLink = screen.getByRole('menuitem', { name: /Failure/i });
    expect(failuresLink.getAttribute('href')).toBe('/app/failures');

    // Secondary Utility Settings Link
    const settingsLink = screen.getByLabelText(/User Settings and Preferences/i);
    expect(settingsLink.getAttribute('href')).toBe('/app/settings/profile');
  });

  it('highlights the Simulate workspace when at /app/runs/new', () => {
    render(
      <MemoryRouter initialEntries={['/app/runs/new']}>
        <AuthProvider>
          <I18nProvider>
            <NavigationRail />
          </I18nProvider>
        </AuthProvider>
      </MemoryRouter>
    );

    const simulateHeader = screen.getByLabelText(/Simulate Workspace: Scenarios & Preparation/i);
    expect(simulateHeader).not.toBeNull();
    expect(simulateHeader.style.borderLeft).toContain('solid');
  });

  it('highlights the Research workspace when at /app/benchmark', () => {
    render(
      <MemoryRouter initialEntries={['/app/benchmark']}>
        <AuthProvider>
          <I18nProvider>
            <NavigationRail />
          </I18nProvider>
        </AuthProvider>
      </MemoryRouter>
    );

    const researchHeader = screen.getByLabelText(/Research Workspace: Benchmarks & Safety/i);
    expect(researchHeader).not.toBeNull();
    expect(researchHeader.style.borderLeft).toContain('solid');
  });
});
