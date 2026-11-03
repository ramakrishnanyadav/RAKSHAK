/**
 * Tests for Status and Feedback States.
 * Verifies Skeleton loaders, EmptyState, ErrorState, and OfflineBanner.
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  SkeletonLoader,
  SkeletonCard,
  SkeletonTable,
  EmptyState,
  ErrorState,
  OfflineBanner,
} from '../components/StatusState';
import { I18nProvider } from '../context/I18nContext';

describe('StatusState Components', () => {
  it('renders skeleton loader with accessible role="status" and sr-only label', () => {
    render(<SkeletonLoader label="Loading simulation runs" />);

    const skeleton = screen.getByRole('status');
    expect(skeleton).toBeDefined();
    expect(skeleton.getAttribute('aria-label')).toBe('Loading simulation runs');
  });

  it('renders empty state with title, description, and action button', () => {
    const handleAction = vi.fn();
    render(
      <EmptyState
        title="No Simulations Recorded"
        description="Launch your first run using the launch console"
        actionText="Create Run"
        onAction={handleAction}
      />
    );

    expect(screen.getByText('No Simulations Recorded')).toBeDefined();
    expect(screen.getByText('Launch your first run using the launch console')).toBeDefined();

    const btn = screen.getByText('Create Run');
    fireEvent.click(btn);
    expect(handleAction).toHaveBeenCalledTimes(1);
  });

  it('renders error state with role="alert" and retry button', () => {
    const handleRetry = vi.fn();
    render(
      <ErrorState
        title="Engine Disconnected"
        message="Could not reach RoadRunner cosimulation worker"
        onRetry={handleRetry}
      />
    );

    const alert = screen.getByRole('alert');
    expect(alert).toBeDefined();
    expect(screen.getByText('Engine Disconnected')).toBeDefined();
    expect(screen.getByText('Could not reach RoadRunner cosimulation worker')).toBeDefined();

    const retryBtn = screen.getByText('Retry Request');
    fireEvent.click(retryBtn);
    expect(handleRetry).toHaveBeenCalledTimes(1);
  });

  it('renders offline notice banner when offline is true', () => {
    render(
      <I18nProvider>
        <OfflineBanner isOffline={true} runCount={14} />
      </I18nProvider>
    );

    expect(screen.getByRole('status')).toBeDefined();
    expect(screen.getByText(/14 verified pre-bundled SIH2026 runs/i)).toBeDefined();
    expect(screen.getByText('STANDALONE CLIENT')).toBeDefined();
  });
});
