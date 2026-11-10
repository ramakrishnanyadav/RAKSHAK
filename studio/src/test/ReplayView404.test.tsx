import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ReplayView } from '../pages/ReplayView';
import { I18nProvider } from '../context/I18nContext';
import { SettingsProvider } from '../context/SettingsContext';
import { apiClient } from '../api/client';

describe('ReplayView 404 Contract Test', () => {
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

  it('renders "Run Not Found (404)" when the requested run returns 404 / does not exist', async () => {
    // 1. Mock apiClient.getRunManifest to fail with 404
    vi.spyOn(apiClient, 'getRunManifest').mockRejectedValue(new Error('Run not found (404)'));

    // 2. Mock fetch for sample_runs offline fallback to also return 404
    globalThis.fetch = vi.fn().mockImplementation(() =>
      Promise.resolve({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: () => Promise.reject(new Error('Not found')),
      })
    );

    render(
      <QueryClientProvider client={queryClient}>
        <I18nProvider>
          <SettingsProvider>
            <MemoryRouter initialEntries={['/app/runs/non_existent_run_404']}>
              <Routes>
                <Route path="/app/runs/:id" element={<ReplayView />} />
              </Routes>
            </MemoryRouter>
          </SettingsProvider>
        </I18nProvider>
      </QueryClientProvider>
    );

    // Verify 404 screen appears
    const titleElement = await screen.findByText('Run Not Found (404)');
    expect(titleElement).not.toBeNull();

    const descElement = await screen.findByText(/Simulation run "non_existent_run_404" could not be found/i);
    expect(descElement).not.toBeNull();

    const retryBtn = screen.getByText('Retry Request');
    expect(retryBtn).not.toBeNull();
  });

  it('renders "Failed to load simulation run" on 500 server error or network failure, NOT "Run Not Found (404)"', async () => {
    // 1. Mock apiClient.getRunManifest to reject with a 500 internal server error
    vi.spyOn(apiClient, 'getRunManifest').mockRejectedValue(new Error('Internal Server Error 500'));

    // 2. Mock fetch for sample_runs offline fallback to reject with network failure
    globalThis.fetch = vi.fn().mockImplementation(() =>
      Promise.reject(new TypeError('Failed to fetch (Network connection refused)'))
    );

    render(
      <QueryClientProvider client={queryClient}>
        <I18nProvider>
          <SettingsProvider>
            <MemoryRouter initialEntries={['/app/runs/run_with_server_error_500']}>
              <Routes>
                <Route path="/app/runs/:id" element={<ReplayView />} />
              </Routes>
            </MemoryRouter>
          </SettingsProvider>
        </I18nProvider>
      </QueryClientProvider>
    );

    // Verify "Failed to load simulation run" appears
    const genericErrorTitle = await screen.findByText('Failed to load simulation run');
    expect(genericErrorTitle).not.toBeNull();

    // Verify "Run Not Found (404)" NEVER appears
    expect(screen.queryByText('Run Not Found (404)')).toBeNull();
  });
});
