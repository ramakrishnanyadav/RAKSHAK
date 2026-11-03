/**
 * Component Tests for AccessibleTable and AccessibleRiskBadge.
 * Validates WCAG 2.2 AA table accessibility, column sorting, and non-color risk encoding.
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AccessibleTable, AccessibleRiskBadge, ColumnDef } from '../components/AccessibleTable';

interface TestItem {
  id: string;
  name: string;
  speed: number;
}

const mockData: TestItem[] = [
  { id: '1', name: 'Auto-Rickshaw', speed: 25 },
  { id: '2', name: 'Two-Wheeler', speed: 45 },
  { id: '3', name: 'Cattle', speed: 5 },
];

const mockColumns: ColumnDef<TestItem>[] = [
  { key: 'name', header: 'Agent Type', sortable: true },
  { key: 'speed', header: 'Velocity (km/h)', sortable: true, align: 'right' },
];

describe('AccessibleTable', () => {
  it('renders semantic table with explicit caption and headers', () => {
    render(
      <AccessibleTable
        caption="Active Traffic Agents"
        summary="Test summary of dynamic agents"
        columns={mockColumns}
        data={mockData}
        keyField="id"
      />
    );

    const caption = screen.getByText('Active Traffic Agents');
    expect(caption).toBeDefined();

    const colHeaders = screen.getAllByRole('columnheader');
    expect(colHeaders.length).toBe(2);
    expect(colHeaders[0].getAttribute('scope')).toBe('col');
  });

  it('sorts records when clicking sortable column header', () => {
    render(
      <AccessibleTable
        caption="Sorted Traffic Agents"
        columns={mockColumns}
        data={mockData}
        keyField="id"
      />
    );

    const sortButton = screen.getByLabelText(/Sort by Velocity/i);
    expect(sortButton).toBeDefined();

    // Click to sort ascending (Cattle: 5, Auto: 25, Two-Wheeler: 45)
    fireEvent.click(sortButton);

    const rows = screen.getAllByRole('row');
    // First row is header, second row should be Cattle (speed 5)
    expect(rows[1].textContent).toContain('Cattle');
  });
});

describe('AccessibleRiskBadge', () => {
  it('renders critical hazard with both numerical percentage, semantic label, and pattern class', () => {
    const { container } = render(<AccessibleRiskBadge score={0.85} label="CRITICAL HAZARD" />);

    // Must disclose numerical value
    expect(screen.getByText(/85%/)).toBeDefined();
    // Must disclose textual label
    expect(screen.getByText(/CRITICAL HAZARD/)).toBeDefined();

    // Must contain non-color hazard pattern overlay (WCAG 2.2 non-color alone rule)
    const pattern = container.querySelector('.pattern-hazard-striped');
    expect(pattern).not.toBeNull();
  });
});
