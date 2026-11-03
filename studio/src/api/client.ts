/**
 * Typed API Client for ADAPTIVE-PATH Studio.
 * Handles JWT token injection, CSRF double-submit headers, consistent error formats,
 * and automatic fallback to offline bundled runs if backend is offline.
 */

import {
  UserProfile,
  TokenResponse,
  RunSummary,
  RunListResponse,
  RunManifest,
  FramesChunk,
  ScenarioDetail,
  ScenarioBenchmarkSummary,
  BenchmarkCompare,
  ReportItem,
  UserSettings,
  AdminUserItem,
  AuditLogEntry,
  SystemStats,
  ApiErrorFormat,
  ValidationBManifest,
} from '../types/api';

class ApiClient {
  private token: string | null = null;
  private csrfToken: string | null = null;

  constructor() {
    this.token = localStorage.getItem('apath_access_token');
    this.csrfToken = localStorage.getItem('apath_csrf_token');
  }

  public setTokens(accessToken: string | null, csrfToken: string | null) {
    this.token = accessToken;
    this.csrfToken = csrfToken;
    if (accessToken) localStorage.setItem('apath_access_token', accessToken);
    else localStorage.removeItem('apath_access_token');
    if (csrfToken) localStorage.setItem('apath_csrf_token', csrfToken);
    else localStorage.removeItem('apath_csrf_token');
  }

  public getAccessToken(): string | null {
    return this.token;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const headers = new Headers(options.headers || {});
    headers.set('Accept', 'application/json');

    if (this.token) {
      headers.set('Authorization', `Bearer ${this.token}`);
    }

    if (this.csrfToken && ['POST', 'PUT', 'DELETE', 'PATCH'].includes(options.method || 'GET')) {
      headers.set('X-CSRF-Token', this.csrfToken);
    }

    if (options.body && !(options.body instanceof FormData)) {
      headers.set('Content-Type', 'application/json');
    }

    try {
      const response = await fetch(endpoint, { ...options, headers });

      if (!response.ok) {
        let errJson: ApiErrorFormat;
        try {
          errJson = await response.json();
        } catch {
          errJson = {
            code: `HTTP_${response.status}`,
            message: response.statusText || 'Request failed',
            details: {},
            request_id: response.headers.get('X-Request-ID'),
          };
        }
        throw errJson;
      }

      if (response.status === 204) {
        return {} as T;
      }

      return (await response.json()) as T;
    } catch (err) {
      // If network unreachable, bubble up or let callers handle offline fallback
      throw err;
    }
  }

  // Auth endpoints
  async register(email: string, password: string, role: string): Promise<UserProfile> {
    return this.request<UserProfile>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, role }),
    });
  }

  async login(email: string, password: string): Promise<TokenResponse> {
    const res = await this.request<TokenResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    this.setTokens(res.access_token, res.csrf_token);
    return res;
  }

  async guestLogin(): Promise<TokenResponse> {
    const res = await this.request<TokenResponse>('/api/auth/guest', { method: 'POST' });
    this.setTokens(res.access_token, res.csrf_token);
    return res;
  }

  async logout(): Promise<void> {
    try {
      await this.request('/api/auth/logout', { method: 'POST' });
    } finally {
      this.setTokens(null, null);
    }
  }

  async getMe(): Promise<UserProfile> {
    return this.request<UserProfile>('/api/auth/me');
  }

  async resetPassword(email: string): Promise<void> {
    try {
      await this.request('/api/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
    } catch {
      // Allow offline mock
    }
  }

  // Runs endpoints
  async getRuns(params: Parameters<ApiClient['listRuns']>[0] = {}): Promise<RunListResponse> {
    return this.listRuns(params);
  }

  async listRuns(params: {
    scenario_id?: string;
    planner_id?: string;
    split?: string;
    status?: string;
    shipped_only?: boolean;
    limit?: number;
    offset?: number;
  } = {}): Promise<RunListResponse> {
    const q = new URLSearchParams();
    if (params.scenario_id) q.set('scenario_id', params.scenario_id);
    if (params.planner_id) q.set('planner_id', params.planner_id);
    if (params.split) q.set('split', params.split);
    if (params.status) q.set('status', params.status);
    if (params.shipped_only) q.set('shipped_only', 'true');
    if (params.limit) q.set('limit', String(params.limit));
    if (params.offset) q.set('offset', String(params.offset));

    try {
      return await this.request<RunListResponse>(`/api/runs?${q.toString()}`);
    } catch (err) {
      // Offline fallback: load static sample runs manifest
      const fallbackRes = await fetch('/sample_runs/manifest.json');
      if (fallbackRes.ok) {
        const items = await fallbackRes.json();
        return { items, total: items.length, limit: 50, offset: 0 };
      }
      throw err;
    }
  }

  async getRun(runId: string): Promise<RunSummary> {
    return this.request<RunSummary>(`/api/runs/${runId}`);
  }

  async getRunManifest(runId: string): Promise<RunManifest> {
    try {
      return await this.request<RunManifest>(`/api/runs/${runId}/manifest`);
    } catch {
      // Fallback to static sample run json
      const res = await fetch(`/sample_runs/${runId}.json`);
      if (res.ok) {
        const data = await res.json();
        return {
          schema_version: data.schema_version,
          run_id: data.run_id,
          timestamp_iso: data.timestamp_iso,
          config_hash: data.config_hash,
          engine: data.engine,
          scenario: data.scenario,
          planner: data.planner,
          world: data.world,
          metrics: data.metrics,
          total_frames: data.frames?.length || 0,
        };
      }
      throw new Error(`Run ${runId} not found`);
    }
  }

  async getRunFrames(runId: string, startTime: number, endTime: number, limit: number = 100): Promise<FramesChunk> {
    try {
      return await this.request<FramesChunk>(
        `/api/runs/${runId}/frames?start_time=${startTime}&end_time=${endTime}&limit=${limit}`
      );
    } catch {
      // Offline fallback: load whole file and slice frames
      const res = await fetch(`/sample_runs/${runId}.json`);
      if (res.ok) {
        const data = await res.json();
        const allFrames = data.frames || [];
        const chunk = allFrames.filter((f: { t: number }) => f.t >= startTime && f.t <= endTime).slice(0, limit);
        return {
          run_id: runId,
          start_time: startTime,
          end_time: endTime,
          frame_count: chunk.length,
          frames: chunk,
        };
      }
      throw new Error(`Frames for ${runId} not found`);
    }
  }

  async getRunFramesChunk(runId: string, startTime: number, endTime: number, limit: number = 100): Promise<FramesChunk> {
    return this.getRunFrames(runId, startTime, endTime, limit);
  }

  async createRun(params: {
    scenario_id: string;
    planner_id: string;
    split?: string;
    seed?: number;
    engine_adapter?: string;
    scenario_params?: Record<string, unknown>;
  }): Promise<{ id: string; status: string }> {
    const resp = await this.launchRun({
      scenario_id: params.scenario_id,
      planner_id: params.planner_id,
      split: params.split || 'test',
      seed: params.seed || 1000,
      engine_adapter: params.engine_adapter || 'python_inprocess',
      custom_params: params.scenario_params,
    });
    return { id: resp.run_id, status: resp.status };
  }

  async launchRun(params: {
    scenario_id: string;
    planner_id: string;
    split: string;
    seed: number;
    engine_adapter: string;
    custom_params?: Record<string, unknown>;
  }): Promise<{ message: string; run_id: string; status: string }> {
    return this.request('/api/runs', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  async cancelRun(runId: string): Promise<{ message: string; status: string }> {
    return this.request(`/api/runs/${runId}/cancel`, { method: 'POST' });
  }

  async retryRun(runId: string): Promise<{ message: string; new_run_id: string; status: string }> {
    return this.request(`/api/runs/${runId}/retry`, { method: 'POST' });
  }

  // Scenarios endpoints
  async listScenarios(): Promise<ScenarioDetail[]> {
    return this.request<ScenarioDetail[]>('/api/scenarios');
  }

  async getScenario(id: string): Promise<ScenarioDetail> {
    return this.request<ScenarioDetail>(`/api/scenarios/${id}`);
  }

  // Benchmarks endpoints
  async getValidationBManifest(): Promise<ValidationBManifest> {
    try {
      return await this.request<ValidationBManifest>('/api/benchmarks/val_b');
    } catch {
      // Fallback to static public artifact
      const res = await fetch('/data/val_b_manifest.json');
      if (res.ok) {
        return await res.json();
      }
      throw new Error('Failed to load Validation B manifest from both API and static data path');
    }
  }

  async getBenchmarks(scenarioId?: string, split: string = 'tune'): Promise<ScenarioBenchmarkSummary[]> {
    const q = new URLSearchParams({ split });
    if (scenarioId) q.set('scenario_id', scenarioId);
    return this.request<ScenarioBenchmarkSummary[]>(`/api/benchmarks/summary?${q.toString()}`);
  }

  async comparePlanners(scenarioId: string, baseline: string, candidate: string, split: string = 'tune'): Promise<BenchmarkCompare> {
    return this.request<BenchmarkCompare>(
      `/api/benchmarks/compare?scenario_id=${scenarioId}&baseline=${baseline}&candidate=${candidate}&split=${split}`
    );
  }

  // Failures endpoints
  async listFailures(tag?: string, limit: number = 50, offset: number = 0): Promise<RunListResponse> {
    const q = new URLSearchParams({ limit: String(limit), offset: String(offset) });
    if (tag) q.set('tag', tag);
    return this.request<RunListResponse>(`/api/failures?${q.toString()}`);
  }

  // Reports endpoints
  async listReports(): Promise<ReportItem[]> {
    return this.request<ReportItem[]>('/api/reports');
  }

  async createReport(title: string, scenarioIds: string[], plannerIds: string[]): Promise<ReportItem> {
    return this.request<ReportItem>('/api/reports', {
      method: 'POST',
      body: JSON.stringify({ title, scenario_ids: scenarioIds, planner_ids: plannerIds }),
    });
  }

  // Settings endpoints
  async getUserSettings(): Promise<UserSettings> {
    return this.request<UserSettings>('/api/settings/me');
  }

  async updateUserSettings(preferences: UserSettings['preferences']): Promise<UserSettings> {
    return this.request<UserSettings>('/api/settings/me', {
      method: 'PUT',
      body: JSON.stringify({ preferences }),
    });
  }

  // Admin endpoints
  async listAdminUsers(): Promise<AdminUserItem[]> {
    return this.request<AdminUserItem[]>('/api/admin/users');
  }

  async updateAdminUserRole(userId: string, role: string): Promise<void> {
    return this.request(`/api/admin/users/${userId}/role`, {
      method: 'PUT',
      body: JSON.stringify({ role }),
    });
  }

  async updateAdminUserQuota(userId: string, maxConcurrent: number, dailyLimit: number): Promise<void> {
    return this.request(`/api/admin/users/${userId}/quota`, {
      method: 'PUT',
      body: JSON.stringify({ max_concurrent_runs: maxConcurrent, daily_run_limit: dailyLimit }),
    });
  }

  async getAuditLogs(): Promise<AuditLogEntry[]> {
    return this.request<AuditLogEntry[]>('/api/admin/audit-logs');
  }

  async getSystemStats(): Promise<SystemStats> {
    return this.request<SystemStats>('/api/admin/system-stats');
  }

  async adminUsers(): Promise<{ items: AdminUserItem[]; total: number }> {
    const items = await this.listAdminUsers();
    return { items, total: items.length };
  }

  async adminAuditLogs(): Promise<{ items: AuditLogEntry[]; total: number }> {
    const items = await this.getAuditLogs();
    return { items, total: items.length };
  }

  async adminStats(): Promise<SystemStats> {
    return this.getSystemStats();
  }
}

export const api = new ApiClient();
export const apiClient = api;

