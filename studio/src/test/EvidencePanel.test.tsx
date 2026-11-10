import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EvidencePanel } from '../components/showcase/EvidencePanel';

describe('EvidencePanel (Truth & Empirical Reconciliation)', () => {
  it('renders flagship outcome with cattle crossing, seed 2005, and val_b', () => {
    render(<EvidencePanel />);
    expect(screen.getByText(/Flagship Replay \(Seed 2005\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Sudden Cattle Crossing \(SCENARIO_5\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Goal reached \(t=12.6s\)/i)).toBeInTheDocument();
    expect(screen.getByText(/0.78 m/i)).toBeInTheDocument();
  });

  it('renders Validation B aggregate statistics (56% completion, 20% collisions)', () => {
    render(<EvidencePanel />);
    expect(screen.getByText(/Validation B Aggregates/i)).toBeInTheDocument();
    expect(screen.getByText(/56.0% \(14\/25\)/i)).toBeInTheDocument();
    expect(screen.getByText(/20.0% \(5\/25\)/i)).toBeInTheDocument();
  });

  it('renders frozen-test P3 results with 0% completion and 1.24 m/s stall speed', () => {
    render(<EvidencePanel />);
    expect(screen.getByText(/Frozen-Test Benchmark/i)).toBeInTheDocument();
    expect(screen.getAllByText(/0.0% \(0\/150\)/i)).toHaveLength(2);
    expect(screen.getByText(/1.24 m\/s \(Stall\)/i)).toBeInTheDocument();
  });

  it('renders tuning seed 1000 collision outcome disclaiming freeze.md error', () => {
    render(<EvidencePanel />);
    expect(screen.getByText(/Tuning Seed 1000 Run/i)).toBeInTheDocument();
    expect(screen.getByText(/Collision \(t=5.1s\)/i)).toBeInTheDocument();
    expect(screen.getByText(/docs\/FREEZE.md claim of 0 collisions on s1000 was incorrect/i)).toBeInTheDocument();
  });
});
