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
        duration_s: m.duration_s != null ? Number(m.duration_s) : null,
        completed_goal: m.completed_goal != null ? Boolean(m.completed_goal) : null,
        collision_occurred: m.collision_occurred != null ? Boolean(m.collision_occurred) : null,
        min_clearance_m: m.min_clearance_m != null ? Number(m.min_clearance_m) : null,
        mean_speed_m_s: m.mean_speed_m_s != null ? Number(m.mean_speed_m_s) : null,
        max_jerk_m_s3: m.max_jerk_m_s3 != null ? Number(m.max_jerk_m_s3) : null,
        replan_count: m.replan_count != null ? Number(m.replan_count) : null,
        p95_latency_ms: m.p95_latency_ms != null ? Number(m.p95_latency_ms) : null,
        failure_tag: m.failure_tag || null,
      }));
      return { items: mapped, isOffline: true };
    },
  });

  const runs = runsData?.items || [];
  const isOffline = runsData?.isOffline ?? true;

  // Compute summary metrics with verified sources and calculations
  const totalRuns = runs.length;
  const validGoalRuns = runs.filter((r) => r.completed_goal !== null && r.completed_goal !== undefined);
  const completedCount = validGoalRuns.filter((r) => r.completed_goal === true).length;

  const validCollisionRuns = runs.filter((r) => r.collision_occurred !== null && r.collision_occurred !== undefined);
  const collisionCount = validCollisionRuns.filter((r) => r.collision_occurred === true).length;
  const collisionFreeCount = validCollisionRuns.length - collisionCount;

  const validLatencyRuns = runs.filter((r) => r.p95_latency_ms !== null && r.p95_latency_ms !== undefined && !isNaN(r.p95_latency_ms));
  const meanP95LatencyMs =
    validLatencyRuns.length > 0
      ? (validLatencyRuns.reduce((acc, r) => acc + (r.p95_latency_ms as number), 0) / validLatencyRuns.length).toFixed(1)
      : null;

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
      render: (r) => (r.min_clearance_m != null ? `${r.min_clearance_m.toFixed(2)} m` : '—'),
    },
    {
      key: 'mean_speed_m_s',
      header: 'Speed',
      sortable: true,
      render: (r) => (r.mean_speed_m_s != null ? `${(r.mean_speed_m_s * 3.6).toFixed(1)} km/h` : '—'),
    },
    {
      key: 'replan_count',
      header: 'Replans',
      sortable: true,
      render: (r) => (r.replan_count != null ? r.replan_count : '—'),
    },
    {
      key: 'p95_latency_ms',
      header: 'P95 Latency',
      sortable: true,
      render: (r) => (r.p95_latency_ms != null ? `${r.p95_latency_ms.toFixed(1)} ms` : '—'),
    },
    {
      key: 'status',
      header: 'Result',
      render: (r) => {
        if (r.collision_occurred === true) {
          return (
            <span style={{ color: 'var(--risk-critical)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '3px' }}>
              <AlertTriangle size={14} /> Collision
            </span>
          );
        }
        if (r.completed_goal === true) {
          return (
            <span style={{ color: 'var(--accent-teal)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '3px' }}>
              <CheckCircle2 size={14} /> Success
            </span>
          );
        }
        if (r.completed_goal === false) {
          return (
            <span style={{ color: 'var(--risk-medium)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '3px' }}>
              Incomplete
            </span>
          );
        }
        return <span style={{ color: 'var(--text-secondary)' }}>—</span>;
      },
    },
  ];

  return (
    <div style={{ padding: '1.5rem', maxWidth: '1280px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <OfflineBanner isOffline={isOffline} runCount={runs.length} />

      {/* Hero Presentation Header */}
      <div
        className="glass-panel"
        style={{
          background: 'linear-gradient(135deg, rgba(14, 165, 233, 0.12) 0%, rgba(99, 102, 241, 0.1) 50%, rgba(20, 184, 166, 0.08) 100%)',
          border: '1px solid rgba(56, 189, 248, 0.28)',
          padding: '2rem',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Decorative background glow */}
        <div style={{
          position: 'absolute', top: '-60px', right: '-60px', width: '240px', height: '240px',
          borderRadius: '50%', background: 'radial-gradient(circle, rgba(56, 189, 248, 0.08) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
          <div
            style={{
              display: 'inline-block',
              padding: '0.2rem 0.65rem',
              background: 'rgba(56, 189, 248, 0.15)',
              color: '#38bdf8',
              borderRadius: '4px',
              fontSize: '0.7rem',
              fontWeight: 800,
              letterSpacing: '0.06em',
              border: '1px solid rgba(56, 189, 248, 0.25)',
            }}
          >
            SMART INDIA HACKATHON 2026 · SIH26037 · MATHWORKS
          </div>
          <div
            style={{
              display: 'inline-block',
              padding: '0.2rem 0.65rem',
              background: isResearch ? 'rgba(99, 102, 241, 0.2)' : 'rgba(16, 185, 129, 0.15)',
              color: isResearch ? '#818cf8' : '#34d399',
              borderRadius: '4px',
              fontSize: '0.7rem',
              fontWeight: 800,
              letterSpacing: '0.04em',
              border: `1px solid ${isResearch ? 'rgba(99, 102, 241, 0.3)' : 'rgba(16, 185, 129, 0.25)'}`,
            }}
          >
            {isResearch ? '🔬 RESEARCH MODE' : '✨ SIMPLE MODE'}
          </div>
        </div>

        <h1 style={{
          fontSize: '2rem',
          fontWeight: 900,
          margin: '0 0 0.5rem',
          letterSpacing: '-0.03em',
          background: 'linear-gradient(135deg, #f8fafc 0%, #94a3b8 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
        }}>
          {t('app_title')}
        </h1>
        <p style={{ fontSize: '0.9rem', color: '#64748b', maxWidth: '800px', lineHeight: 1.65, margin: '0 0 1.5rem' }}>
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
              padding: '0.65rem 1.25rem',
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
              padding: '0.65rem 1.25rem',
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
              padding: '0.65rem 1.25rem',
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
        {/* Total Runs card */}
        <div className="glass-panel" style={{ padding: '1.35rem', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: 'linear-gradient(90deg, #38bdf8, #818cf8)' }} />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#64748b', fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase' }}>
            <span>TOTAL TEST RUNS</span>
            <PlayCircle size={16} color="#38bdf8" />
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 900, marginTop: '0.5rem', color: '#f8fafc', letterSpacing: '-0.03em' }}>
            {totalRuns}
          </div>
          <div style={{ fontSize: '0.72rem', color: '#475569', marginTop: '0.25rem' }}>
            Across 5 canonical Indian road scenarios
          </div>
        </div>

        {/* Goal Completion card */}
        <div className="glass-panel" style={{ padding: '1.35rem', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: 'linear-gradient(90deg, #10b981, #34d399)' }} />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#64748b', fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase' }}>
            <span>COMPLETED TRIPS</span>
            <CheckCircle2 size={16} color="#10b981" />
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 900, marginTop: '0.5rem', color: '#10b981', letterSpacing: '-0.03em' }}>
            {validGoalRuns.length > 0 ? `${((completedCount / validGoalRuns.length) * 100).toFixed(0)}%` : '—'}
          </div>
          <div style={{ fontSize: '0.72rem', color: '#475569', marginTop: '0.25rem' }}>
            {validGoalRuns.length > 0 ? `${completedCount} of ${validGoalRuns.length} runs reached goal` : 'No outcome data recorded'}
          </div>
        </div>

        {/* Collision-free card */}
        <div className="glass-panel" style={{ padding: '1.35rem', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: collisionCount > 0 ? 'linear-gradient(90deg, #ef4444, #f97316)' : 'linear-gradient(90deg, #10b981, #14b8a6)' }} />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#64748b', fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase' }}>
            <span>COLLISION-FREE RUNS</span>
            <ShieldCheck size={16} color={collisionCount > 0 ? '#ef4444' : '#10b981'} />
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 900, marginTop: '0.5rem', color: collisionCount > 0 ? '#ef4444' : '#10b981', letterSpacing: '-0.03em' }}>
            {validCollisionRuns.length > 0 ? `${((collisionFreeCount / validCollisionRuns.length) * 100).toFixed(0)}%` : '—'}
          </div>
          <div style={{ fontSize: '0.72rem', color: '#475569', marginTop: '0.25rem' }}>
            {validCollisionRuns.length > 0 ? `${collisionFreeCount} of ${validCollisionRuns.length} runs with zero collisions` : 'No collision data recorded'}
          </div>
        </div>

        {/* Latency card */}
        <div className="glass-panel" style={{ padding: '1.35rem', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: 'linear-gradient(90deg, #f59e0b, #fbbf24)' }} />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#64748b', fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase' }}>
            <span>MEAN P95 LATENCY</span>
            <Clock size={16} color="#f59e0b" />
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 900, marginTop: '0.5rem', color: '#f8fafc', letterSpacing: '-0.03em' }}>
            {meanP95LatencyMs !== null ? `${meanP95LatencyMs} ms` : '—'}
          </div>
          <div style={{ fontSize: '0.72rem', color: '#14b8a6', marginTop: '0.25rem' }}>
            {validLatencyRuns.length > 0 ? `Mean across ${validLatencyRuns.length} of ${totalRuns} runs [LOGGED: metrics.p95_latency_ms]` : 'No latency data recorded'}
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
            marginBottom: '1.25rem',
            flexWrap: 'wrap',
            gap: '0.75rem',
          }}
        >
          <div>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 800, margin: '0 0 0.25rem', letterSpacing: '-0.01em', color: '#f8fafc' }}>
              Experiment Runs Directory
            </h2>
            <p style={{ fontSize: '0.82rem', color: '#64748b', margin: 0 }}>
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
                  transition: 'all 0.18s ease',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  position: 'relative',
                  overflow: 'hidden',
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
                {/* Planner color accent strip */}
                <div style={{
                  position: 'absolute', top: 0, left: 0, right: 0, height: '2px',
                  background: run.planner_id === 'P3'
                    ? 'linear-gradient(90deg, #38bdf8, #818cf8)'
                    : run.planner_id.startsWith('B')
                    ? 'linear-gradient(90deg, #f59e0b, #f97316)'
                    : 'linear-gradient(90deg, #10b981, #14b8a6)',
                }} />
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <span
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '0.72rem',
                        fontWeight: 800,
                        padding: '2px 8px',
                        borderRadius: '4px',
                        background: run.planner_id === 'P3'
                          ? 'rgba(56, 189, 248, 0.15)'
                          : 'rgba(100, 116, 139, 0.15)',
                        color: run.planner_id === 'P3' ? '#38bdf8' : '#94a3b8',
                        letterSpacing: '0.06em',
                        border: `1px solid ${run.planner_id === 'P3' ? 'rgba(56, 189, 248, 0.25)' : 'rgba(100, 116, 139, 0.2)'}`,
                      }}
                    >
                      {run.planner_id}
                    </span>
                    <span style={{ fontSize: '0.7rem', color: '#475569', textTransform: 'capitalize' }}>
                      {run.split} · Seed {run.seed}
                    </span>
                  </div>

                  <h3 style={{ fontSize: '0.9rem', fontWeight: 700, margin: '0 0 0.5rem', color: '#e2e8f0', lineHeight: 1.3 }}>
                    {run.scenario_id.replace(/_/g, ' ')}
                  </h3>

                  <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.78rem', color: '#64748b', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
                    <span>Clr: <strong style={{ color: '#94a3b8' }}>{run.min_clearance_m != null ? `${run.min_clearance_m.toFixed(1)}m` : '—'}</strong></span>
                    <span>Speed: <strong style={{ color: '#94a3b8' }}>{run.mean_speed_m_s != null ? `${(run.mean_speed_m_s * 3.6).toFixed(1)} km/h` : '—'}</strong></span>
                    <span>Replans: <strong style={{ color: '#94a3b8' }}>{run.replan_count != null ? run.replan_count : '—'}</strong></span>
                  </div>
                </div>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    borderTop: '1px solid rgba(56, 189, 248, 0.08)',
                    paddingTop: '0.5rem',
                    fontSize: '0.78rem',
                  }}
                >
                  <span
                    style={{
                      color:
                        run.collision_occurred === true
                          ? '#ef4444'
                          : run.completed_goal === true
                          ? '#10b981'
                          : '#64748b',
                      fontWeight: 700,
                    }}
                  >
                    {run.collision_occurred === true
                      ? '⚠ Collision Occurred'
                      : run.completed_goal === true
                      ? '✓ Goal Completed'
                      : run.completed_goal === false
                      ? 'Incomplete'
                      : '—'}
                  </span>
                  <span style={{ color: '#38bdf8', display: 'inline-flex', alignItems: 'center', gap: '2px', fontWeight: 700, fontSize: '0.75rem' }}>
                    Replay <ArrowRight size={12} />
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
