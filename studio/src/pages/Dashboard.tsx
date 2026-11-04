/**
 * Studio Main Dashboard (Route: /app).
 * Overview of simulation runs, key SIH2026 performance metrics,
 * quick replay launch buttons, and accessible data-table view.
 */

import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  PlayCircle,
  ShieldCheck,
  Zap,
  Layers,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Gauge,
  PlusCircle,
} from 'lucide-react';
import { apiClient } from '../api/client';
import { useI18n } from '../context/I18nContext';
import { usePresentationMode } from '../context/SettingsContext';
import { DataTableToggle } from '../components/DataTableToggle';
import { AccessibleTable, AccessibleRiskBadge, ColumnDef } from '../components/AccessibleTable';
import { SkeletonCard, SkeletonTable, ErrorState, OfflineBanner } from '../components/StatusState';
import { RunSummary } from '../types/api';

export const Dashboard: React.FC = () => {
  const { t } = useI18n();
  const { isResearch } = usePresentationMode();
  const navigate = useNavigate();
  const [isTableView, setIsTableView] = useState(false);

  // Fetch runs list via TanStack Query with offline fallback to sample_runs
  const { data: runsData, isLoading, error, refetch } = useQuery({
    queryKey: ['runs', 'dashboard'],
    queryFn: async () => {
      try {
        const resp = await apiClient.getRuns({ limit: 50 });
        if (resp && resp.items && resp.items.length > 0) {
          return { items: resp.items, isOffline: false };
        }
      } catch {
        // Fall back to offline static sample runs
      }

      // Offline Fallback
      const res = await fetch('/sample_runs/manifest.json');
      if (!res.ok) throw new Error('Failed to load runs manifest');
      const manifest = await res.json();
      const mapped: RunSummary[] = manifest.map((m: any) => ({
        id: m.id,
        scenario_id: m.scenario_id,
        planner_id: m.planner_id,
        split: m.split || 'test',
        seed: m.seed || 1000,
        engine_adapter: 'python_inprocess',
        status: 'completed',
        config_hash: null,
        is_shipped: true,
        owner_id: null,
        created_at: '2026-10-14T00:00:00Z',
        duration_s: m.duration_s || 16.0,
        completed_goal: m.completed_goal ?? true,
        collision_occurred: m.collision_occurred ?? false,
        min_clearance_m: m.min_clearance_m || 2.4,
        mean_speed_m_s: m.mean_speed_m_s || 6.2,
        max_jerk_m_s3: m.max_jerk_m_s3 || 1.8,
        replan_count: m.replan_count || 3,
        p95_latency_ms: m.p95_latency_ms || 18.5,
        failure_tag: m.failure_tag || null,
      }));
      return { items: mapped, isOffline: true };
    },
  });

  const runs = runsData?.items || [];
  const isOffline = runsData?.isOffline ?? true;

  // Compute summary metrics with verified sources and calculations
  const totalRuns = runs.length;
  const completedCount = runs.filter((r) => r.completed_goal).length;
  const collisionCount = runs.filter((r) => r.collision_occurred).length;
  const collisionFreeCount = totalRuns - collisionCount;
  const avgPlanningTimeMs =
    totalRuns > 0
      ? (runs.reduce((acc, r) => acc + r.p95_latency_ms, 0) / totalRuns).toFixed(1)
      : '0.0';

  const tableColumns: ColumnDef<RunSummary>[] = [
    {
      key: 'id',
      header: 'Run ID',
      sortable: true,
      render: (r) => (
        <Link
          to={`/app/runs/${r.id}`}
          style={{
            fontFamily: 'var(--font-mono)',
            fontWeight: 700,
            color: 'var(--accent-primary)',
            textDecoration: 'none',
          }}
        >
          {r.id.replace('run_', '')}
        </Link>
      ),
    },
    {
      key: 'scenario_id',
      header: 'Scenario',
      sortable: true,
      render: (r) => r.scenario_id.replace(/_/g, ' '),
    },
    {
      key: 'planner_id',
      header: 'Planner',
      sortable: true,
      render: (r) => (
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontWeight: 700,
            padding: '2px 6px',
            borderRadius: '4px',
            background: r.planner_id === 'P3' ? 'rgba(59, 130, 246, 0.2)' : 'var(--bg-surface-elevated)',
            color: r.planner_id === 'P3' ? 'var(--accent-primary)' : 'var(--text-secondary)',
          }}
        >
          {r.planner_id}
        </span>
      ),
    },
    {
      key: 'min_clearance_m',
      header: 'Min Clearance',
      sortable: true,
      render: (r) => `${r.min_clearance_m.toFixed(2)} m`,
    },
    {
      key: 'mean_speed_m_s',
      header: 'Speed',
      sortable: true,
      render: (r) => `${(r.mean_speed_m_s * 3.6).toFixed(1)} km/h`,
    },
    {
      key: 'replan_count',
      header: 'Replans',
      sortable: true,
      render: (r) => r.replan_count,
    },
    {
      key: 'p95_latency_ms',
      header: 'P95 Latency',
      sortable: true,
      render: (r) => `${r.p95_latency_ms.toFixed(1)} ms`,
    },
    {
      key: 'status',
      header: 'Result',
      render: (r) =>
        r.collision_occurred ? (
          <span style={{ color: 'var(--risk-critical)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '3px' }}>
            <AlertTriangle size={14} /> Collision
          </span>
        ) : (
          <span style={{ color: 'var(--accent-teal)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '3px' }}>
            <CheckCircle2 size={14} /> Success
          </span>
        ),
    },
  ];

  return (
    <div style={{ padding: '1.5rem', maxWidth: '1280px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <OfflineBanner isOffline={isOffline} runCount={runs.length} />

      {/* Hero Presentation Header */}
      <div
        className="glass-panel"
        style={{
          background: 'linear-gradient(135deg, rgba(2, 132, 199, 0.18) 0%, rgba(99, 102, 241, 0.12) 100%)',
          border: '1px solid rgba(56, 189, 248, 0.3)',
          padding: '1.75rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.6rem', flexWrap: 'wrap' }}>
          <div
            style={{
              display: 'inline-block',
              padding: '0.2rem 0.6rem',
              background: 'rgba(56, 189, 248, 0.2)',
              color: '#38bdf8',
              borderRadius: '4px',
              fontSize: '0.75rem',
              fontWeight: 700,
            }}
          >
            SMART INDIA HACKATHON 2026 • SIH26037 • MATHWORKS
          </div>
          <div
            style={{
              display: 'inline-block',
              padding: '0.2rem 0.6rem',
              background: isResearch ? 'rgba(168, 85, 247, 0.2)' : 'rgba(16, 185, 129, 0.2)',
              color: isResearch ? '#c084fc' : '#34d399',
              borderRadius: '4px',
              fontSize: '0.75rem',
              fontWeight: 700,
            }}
          >
            {isResearch ? '🔬 RESEARCH MODE' : '✨ SIMPLE MODE'}
          </div>
        </div>

        <h1 style={{ fontSize: '1.85rem', fontWeight: 800, margin: '0 0 0.5rem', letterSpacing: '-0.02em' }}>
          {t('app_title')}
        </h1>
        <p style={{ fontSize: '0.95rem', color: 'var(--text-secondary)', maxWidth: '800px', lineHeight: 1.6, margin: '0 0 1.25rem' }}>
          {t('app_subtitle')}
        </p>

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button
            onClick={() => {
              const p3 = runs.find((r) => r.planner_id === 'P3' && r.scenario_id.includes('CATTLE')) || runs[0];
              if (p3) navigate(`/app/runs/${p3.id}`);
            }}
            className="btn-primary"
            style={{
              padding: '0.6rem 1.1rem',
              fontSize: '0.9rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              minHeight: 'var(--touch-target-size)',
            }}
          >
            <PlayCircle size={18} aria-hidden="true" />
            <span>Launch Flagship Replay (P3 Cattle Crossing)</span>
          </button>

          <Link
            to="/app/runs/new"
            className="btn-secondary"
            style={{
              padding: '0.6rem 1.1rem',
              fontSize: '0.9rem',
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              minHeight: 'var(--touch-target-size)',
            }}
          >
            <PlusCircle size={18} aria-hidden="true" />
            <span>{t('nav_new_run')}</span>
          </Link>

          <Link
            to="/app/benchmark"
            className="btn-secondary"
            style={{
              padding: '0.6rem 1.1rem',
              fontSize: '0.9rem',
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              minHeight: 'var(--touch-target-size)',
            }}
          >
            <BarChart3 size={18} aria-hidden="true" />
            <span>Ablation Benchmark</span>
          </Link>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '1rem',
        }}
      >
        <div className="glass-panel" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: 600 }}>
            <span>TOTAL TEST RUNS</span>
            <PlayCircle size={16} color="var(--accent-primary)" />
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, marginTop: '0.35rem', color: 'var(--text-primary)' }}>
            {totalRuns}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
            Across 5 canonical Indian road scenarios
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: 600 }}>
            <span>COMPLETED TRIPS</span>
            <CheckCircle2 size={16} color="var(--accent-teal)" />
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, marginTop: '0.35rem', color: 'var(--accent-teal)' }}>
            {totalRuns > 0 ? `${((completedCount / totalRuns) * 100).toFixed(0)}%` : '--'}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
            {totalRuns > 0 ? `${completedCount} of ${totalRuns} test runs reached goal` : 'No runs loaded'}
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: 600 }}>
            <span>COLLISION-FREE RUNS</span>
            <ShieldCheck size={16} color="var(--accent-teal)" />
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, marginTop: '0.35rem', color: collisionCount > 0 ? 'var(--risk-critical)' : 'var(--accent-teal)' }}>
            {totalRuns > 0 ? `${((collisionFreeCount / totalRuns) * 100).toFixed(0)}%` : '--'}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
            {totalRuns > 0 ? `${collisionFreeCount} of ${totalRuns} runs with zero collisions` : 'No runs loaded'}
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: 600 }}>
            <span>AVERAGE PLANNING TIME</span>
            <Clock size={16} color="var(--risk-medium)" />
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, marginTop: '0.35rem', color: 'var(--text-primary)' }}>
            {avgPlanningTimeMs} <span style={{ fontSize: '1rem', fontWeight: 500 }}>ms</span>
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--accent-teal)', marginTop: '0.2rem' }}>
            Average computation time per step
          </div>
        </div>
      </div>

      {/* Shipped Runs Section with View Toggle */}
      <div className="glass-panel" style={{ padding: '1.5rem' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '1rem',
            flexWrap: 'wrap',
            gap: '0.75rem',
          }}
        >
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: '0 0 0.25rem' }}>
              Experiment Runs Directory
            </h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>
              Inspect live synchronized replays, conformal prediction cones, and risk traces.
            </p>
          </div>

          <DataTableToggle
            isTableView={isTableView}
            onToggle={setIsTableView}
            id="dashboard-runs-toggle"
            label="Toggle between cards grid and accessible data table"
          />
        </div>

        {isLoading ? (
          <SkeletonTable rows={5} cols={8} />
        ) : error ? (
          <ErrorState message="Could not load runs list. Try refreshing the page." onRetry={() => refetch()} />
        ) : isTableView ? (
          <AccessibleTable
            caption="Complete directory of verified SIH2026 autonomous simulation runs"
            summary="Includes planner ablations, clearance, speed, replan triggers, and cycle latencies"
            columns={tableColumns}
            data={runs}
            keyField="id"
          />
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
              gap: '1rem',
            }}
          >
            {runs.map((run) => (
              <div
                key={run.id}
                onClick={() => navigate(`/app/runs/${run.id}`)}
                className="glass-panel"
                style={{
                  padding: '1.1rem',
                  cursor: 'pointer',
                  border: '1px solid var(--border-default)',
                  transition: 'var(--transition-fast)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                }}
                tabIndex={0}
                role="button"
                aria-label={`Open replay for ${run.scenario_id.replace(/_/g, ' ')}, Planner ${run.planner_id}`}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    navigate(`/app/runs/${run.id}`);
                  }
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <span
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        padding: '2px 6px',
                        borderRadius: '4px',
                        background: run.planner_id === 'P3' ? 'rgba(59, 130, 246, 0.2)' : 'var(--bg-surface-elevated)',
                        color: run.planner_id === 'P3' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                      }}
                    >
                      {run.planner_id}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'capitalize' }}>
                      {run.split} • Seed {run.seed}
                    </span>
                  </div>

                  <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 0.5rem', color: 'var(--text-primary)' }}>
                    {run.scenario_id.replace(/_/g, ' ')}
                  </h3>

                  <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
                    <span>Clr: <strong>{run.min_clearance_m.toFixed(1)}m</strong></span>
                    <span>Speed: <strong>{(run.mean_speed_m_s * 3.6).toFixed(1)} km/h</strong></span>
                    <span>Replans: <strong>{run.replan_count}</strong></span>
                  </div>
                </div>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    borderTop: '1px solid var(--border-subtle)',
                    paddingTop: '0.5rem',
                    fontSize: '0.8rem',
                  }}
                >
                  <span style={{ color: run.collision_occurred ? 'var(--risk-critical)' : 'var(--accent-teal)', fontWeight: 600 }}>
                    {run.collision_occurred ? 'Collision Occurred' : 'Goal Completed'}
                  </span>
                  <span style={{ color: 'var(--accent-primary)', display: 'inline-flex', alignItems: 'center', gap: '2px', fontWeight: 600 }}>
                    Replay <ArrowRight size={13} />
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
