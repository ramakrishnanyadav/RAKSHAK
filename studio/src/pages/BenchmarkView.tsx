/**
 * Authentic Research Benchmark Integration (Route: /app/benchmark).
 * 
 * Exclusively consumes authentic validation data from runs/val_b_manifest.json
 * ("Validation B — Research Experiment").
 * 
 * Strict Scientific & Provenance Compliance:
 * 1. Explicitly isolated from user-created exploratory simulation runs.
 * 2. Displays Git commit, timestamp, seeds [2005..2009], scenarios, and sample size N.
 * 3. Uses exact metrics from authoritative engine/metrics.py definitions.
 * 4. Distinguishes temporal near-miss frame counts from discrete event encounters.
 * 5. Distinguishes missing/unavailable data ('—') from actual zeros.
 * 6. AccessibleTable with WCAG 2.2 AA table accessibility.
 */

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart3,
  Download,
  Filter,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  Cpu,
  GitBranch,
  Calendar,
  Layers,
  Database,
  RefreshCw,
  Info,
  Activity,
  Award,
} from 'lucide-react';
import { AccessibleTable, ColumnDef } from '../components/AccessibleTable';
import { SkeletonTable, ErrorState } from '../components/StatusState';
import { useI18n } from '../context/I18nContext';
import { apiClient } from '../api/client';
import { ValidationBManifest, ValidationBAggregate } from '../types/api';
import { BENCHMARK_SCENARIOS } from './Scenarios';

interface FormattedBenchmarkRow {
  config_key: string;
  config_name: string;
  planner_id: string;
  description: string;
  episode_count: number;
  goal_completion_rate: number | null;
  collision_rate: number | null;
  safe_progress_rate: number | null;
  mean_min_clearance_m: number | null;
  mean_jerk_m_s3: number | null;
  max_jerk_m_s3: number | null;
  mean_p95_latency_ms: number | null;
  total_near_miss_frames: number | null;
  near_miss_frames_per_ep: number | null;
  mrm_activations: number | null;
  mrm_recoveries: number | null;
  mrm_recovery_rate: number | null;
  candidate_rejections?: {
    physical_collision: number;
    predicted_occupancy: number;
    road_boundary: number;
  };
}

export const BenchmarkView: React.FC = () => {
  const { t } = useI18n();
  const [selectedScope, setSelectedScope] = useState<string>('ALL_SCENARIOS');

  // Query authentic Validation B benchmark manifest
  const {
    data: manifest,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<ValidationBManifest>({
    queryKey: ['val_b_manifest'],
    queryFn: () => apiClient.getValidationBManifest(),
    staleTime: 1000 * 60 * 30, // 30 minutes cache
  });

  // Format table rows based on active scope (Pooled Overall vs Individual Scenario)
  const rows: FormattedBenchmarkRow[] = React.useMemo(() => {
    if (!manifest || !manifest.configurations) return [];

    return Object.entries(manifest.configurations).map(([key, config]) => {
      let agg: ValidationBAggregate | undefined;

      if (selectedScope === 'ALL_SCENARIOS') {
        agg = config.aggregate;
      } else {
        agg = config.scenario_breakdown?.[selectedScope]?.aggregate;
      }

      if (!agg) {
        return {
          config_key: key,
          config_name: key === 'P3_Corrected' ? 'P3 (Corrected F3)' : key === 'P3_Baseline' ? 'P3 (Zero-Stall Baseline)' : 'B1 (DWA-VO Baseline)',
          planner_id: config.planner_id,
          description: config.description,
          episode_count: 0,
          goal_completion_rate: null,
          collision_rate: null,
          safe_progress_rate: null,
          mean_min_clearance_m: null,
          mean_jerk_m_s3: null,
          max_jerk_m_s3: null,
          mean_p95_latency_ms: null,
          total_near_miss_frames: null,
          near_miss_frames_per_ep: null,
          mrm_activations: null,
          mrm_recoveries: null,
          mrm_recovery_rate: null,
        };
      }

      const epCount = agg.episode_count || 0;
      const nearMissFramesPerEp = epCount > 0 && typeof agg.total_near_misses === 'number'
        ? agg.total_near_misses / epCount
        : null;

      const mrmRecoveryRate = agg.total_mrm_activations && agg.total_mrm_activations > 0
        ? (agg.total_mrm_recoveries / agg.total_mrm_activations) * 100
        : null;

      const niceName =
        key === 'P3_Corrected'
          ? 'P3: Adaptive Replanner (F3 Corrected)'
          : key === 'P3_Baseline'
          ? 'P3: Zero-Stall Penalty Baseline'
          : 'B1: Dynamic Window Approach (DWA-VO)';

      return {
        config_key: key,
        config_name: niceName,
        planner_id: config.planner_id,
        description: config.description,
        episode_count: epCount,
        goal_completion_rate: typeof agg.goal_completion_rate === 'number' ? agg.goal_completion_rate * 100 : null,
        collision_rate: typeof agg.collision_rate === 'number' ? agg.collision_rate * 100 : null,
        safe_progress_rate: typeof agg.safe_progress_rate === 'number' ? agg.safe_progress_rate * 100 : null,
        mean_min_clearance_m: typeof agg.mean_min_clearance_m === 'number' ? agg.mean_min_clearance_m : null,
        mean_jerk_m_s3: typeof agg.mean_jerk_m_s3 === 'number' ? agg.mean_jerk_m_s3 : null,
        max_jerk_m_s3: typeof agg.max_jerk_m_s3 === 'number' ? agg.max_jerk_m_s3 : null,
        mean_p95_latency_ms: typeof agg.mean_p95_latency_ms === 'number' ? agg.mean_p95_latency_ms : null,
        total_near_miss_frames: typeof agg.total_near_misses === 'number' ? agg.total_near_misses : null,
        near_miss_frames_per_ep: nearMissFramesPerEp,
        mrm_activations: typeof agg.total_mrm_activations === 'number' ? agg.total_mrm_activations : null,
        mrm_recoveries: typeof agg.total_mrm_recoveries === 'number' ? agg.total_mrm_recoveries : null,
        mrm_recovery_rate: mrmRecoveryRate,
        candidate_rejections: agg.total_candidate_rejections,
      };
    });
  }, [manifest, selectedScope]);

  // CSV Export with authentic provenance metadata
  const downloadCSV = () => {
    if (!manifest) return;

    const meta = manifest.metadata;
    const lines = [
      `# ADAPTIVE-PATH Validation B Benchmark Export`,
      `# Artifact: runs/val_b_manifest.json`,
      `# Git Commit: ${meta.git_commit}`,
      `# Timestamp: ${meta.timestamp}`,
      `# Scope: ${selectedScope}`,
      `# Seeds: ${meta.seeds.join(' ')}`,
      `Configuration,Planner ID,Episodes,Goal Completion Rate (%),Collision Rate (%),Safe Progress Rate (%),Mean Min Clearance (m),Mean Jerk (m/s3),Max Jerk (m/s3),P95 Latency (ms),Total Near-Miss Frames,Near-Miss Frames/Episode,MRM Activations,MRM Recoveries,MRM Recovery Rate (%)`,
      ...rows.map((r) =>
        [
          `"${r.config_name}"`,
          r.planner_id,
          r.episode_count,
          r.goal_completion_rate !== null ? r.goal_completion_rate.toFixed(1) : '—',
          r.collision_rate !== null ? r.collision_rate.toFixed(1) : '—',
          r.safe_progress_rate !== null ? r.safe_progress_rate.toFixed(1) : '—',
          r.mean_min_clearance_m !== null ? r.mean_min_clearance_m.toFixed(2) : '—',
          r.mean_jerk_m_s3 !== null ? r.mean_jerk_m_s3.toFixed(3) : '—',
          r.max_jerk_m_s3 !== null ? r.max_jerk_m_s3.toFixed(3) : '—',
          r.mean_p95_latency_ms !== null ? r.mean_p95_latency_ms.toFixed(2) : '—',
          r.total_near_miss_frames !== null ? r.total_near_miss_frames : '—',
          r.near_miss_frames_per_ep !== null ? r.near_miss_frames_per_ep.toFixed(1) : '—',
          r.mrm_activations !== null ? r.mrm_activations : '—',
          r.mrm_recoveries !== null ? r.mrm_recoveries : '—',
          r.mrm_recovery_rate !== null ? r.mrm_recovery_rate.toFixed(1) : '—',
        ].join(',')
      ),
    ];

    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `adaptive_path_val_b_${selectedScope.toLowerCase()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Accessible Table Columns Definition
  const columns: ColumnDef<FormattedBenchmarkRow>[] = [
    {
      key: 'config_name',
      header: 'Strategy Configuration',
      sortable: true,
      render: (r) => (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
            <strong style={{ color: 'var(--text-primary)', fontSize: '0.9rem' }}>{r.config_name}</strong>
            {r.config_key === 'P3_Corrected' && (
              <span
                style={{
                  fontSize: '0.7rem',
                  fontWeight: 800,
                  padding: '1px 6px',
                  borderRadius: '3px',
                  background: 'rgba(16, 185, 129, 0.15)',
                  color: 'var(--status-success)',
                  border: '1px solid var(--status-success)',
                }}
              >
                APPROVED
              </span>
            )}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px', maxWidth: '320px' }}>
            {r.description}
          </div>
        </div>
      ),
    },
    {
      key: 'episode_count',
      header: 'Sample (N)',
      sortable: true,
      render: (r) => (
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}>
          {r.episode_count > 0 ? `${r.episode_count} eps` : '—'}
        </span>
      ),
    },
    {
      key: 'goal_completion_rate',
      header: 'Goal Rate (%)',
      sortable: true,
      render: (r) => (
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontWeight: 700,
            fontSize: '0.85rem',
            color: r.goal_completion_rate !== null && r.goal_completion_rate >= 50 ? 'var(--status-success)' : 'var(--text-primary)',
          }}
        >
          {r.goal_completion_rate !== null ? `${r.goal_completion_rate.toFixed(1)}%` : '—'}
        </span>
      ),
    },
    {
      key: 'collision_rate',
      header: 'Collision Rate (%)',
      sortable: true,
      render: (r) => {
        if (r.collision_rate === null) return <span>—</span>;
        const isLow = r.collision_rate <= 20.0;
        return (
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontWeight: 700,
              fontSize: '0.85rem',
              color: isLow ? 'var(--status-success)' : 'var(--risk-critical)',
            }}
          >
            {r.collision_rate.toFixed(1)}%
          </span>
        );
      },
    },
    {
      key: 'mean_min_clearance_m',
      header: 'Mean Clearance (m)',
      sortable: true,
      render: (r) => (
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}>
          {r.mean_min_clearance_m !== null ? `${r.mean_min_clearance_m.toFixed(2)} m` : '—'}
        </span>
      ),
    },
    {
      key: 'mean_jerk_m_s3',
      header: 'Mean Jerk (m/s³)',
      sortable: true,
      render: (r) => (
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}>
          {r.mean_jerk_m_s3 !== null ? `${r.mean_jerk_m_s3.toFixed(3)}` : '—'}
        </span>
      ),
    },
    {
      key: 'mean_p95_latency_ms',
      header: 'P95 Latency (ms)',
      sortable: true,
      render: (r) => (
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}>
          {r.mean_p95_latency_ms !== null ? `${r.mean_p95_latency_ms.toFixed(1)} ms` : '—'}
        </span>
      ),
    },
    {
      key: 'near_miss_frames_per_ep',
      header: 'Near-Miss Frames',
      sortable: true,
      render: (r) => {
        if (r.total_near_miss_frames === null) return <span>—</span>;
        return (
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>
            <div>{r.total_near_miss_frames} frames</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
              ({r.near_miss_frames_per_ep !== null ? `${r.near_miss_frames_per_ep.toFixed(1)} / ep` : '—'})
            </div>
          </div>
        );
      },
    },
    {
      key: 'mrm_recovery_rate',
      header: 'MRM Recoveries',
      sortable: true,
      render: (r) => {
        if (r.mrm_activations === null) return <span>—</span>;
        return (
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>
            <div>
              {r.mrm_recoveries} / {r.mrm_activations} act
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--status-success)', fontWeight: 600 }}>
              {r.mrm_recovery_rate !== null ? `${r.mrm_recovery_rate.toFixed(1)}% recovery` : '—'}
            </div>
          </div>
        );
      },
    },
  ];

  return (
    <div style={{ padding: '1.5rem', maxWidth: '1360px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Page Title & Provenance Badge */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
            <span
              style={{
                fontSize: '0.75rem',
                fontWeight: 800,
                padding: '3px 8px',
                borderRadius: 'var(--radius-sm)',
                background: 'rgba(59, 130, 246, 0.15)',
                color: 'var(--accent-primary)',
                border: '1px solid rgba(59, 130, 246, 0.3)',
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
              }}
            >
              Validation B — Research Experiment
            </span>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Independent Verification Artifact (Gate G3)
            </span>
          </div>

          <h1 style={{ fontSize: '1.85rem', fontWeight: 800, margin: 0 }}>
            {t('nav_benchmark')}
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', margin: '0.25rem 0 0' }}>
            Empirical validation results comparing proposed P3 Adaptive Replanner against baseline ablation architectures.
          </p>
        </div>

        {/* Scope Selection & Export */}
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <select
            value={selectedScope}
            onChange={(e) => setSelectedScope(e.target.value)}
            style={{
              padding: '0.55rem 0.85rem',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-default)',
              background: 'var(--bg-surface)',
              color: 'var(--text-primary)',
              fontSize: '0.875rem',
              minHeight: 'var(--min-target-size)',
            }}
            aria-label="Select scenario scope for benchmark evaluation"
          >
            <option value="ALL_SCENARIOS">Overall Benchmark (All 5 Scenarios, N=25)</option>
            {BENCHMARK_SCENARIOS.map((sc) => (
              <option key={sc.id} value={sc.id}>
                {sc.name} (N=5)
              </option>
            ))}
          </select>

          <button
            onClick={downloadCSV}
            disabled={!manifest}
            className="btn-secondary"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem',
              padding: '0.55rem 0.95rem',
              fontSize: '0.875rem',
              minHeight: 'var(--min-target-size)',
              cursor: manifest ? 'pointer' : 'not-allowed',
              opacity: manifest ? 1 : 0.6,
            }}
          >
            <Download size={15} />
            <span>Export Verified CSV</span>
          </button>
        </div>
      </div>

      {/* Research Provenance & Dataset Metadata Card */}
      {manifest?.metadata && (
        <div
          className="glass-panel"
          style={{
            padding: '1.1rem 1.25rem',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '1rem',
            background: 'var(--bg-surface-elevated)',
            borderLeft: '4px solid var(--accent-primary)',
          }}
        >
          <div>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
              Artifact Source
            </div>
            <strong style={{ fontSize: '0.85rem', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
              runs/val_b_manifest.json
            </strong>
          </div>

          <div>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
              Engine Git Commit
            </div>
            <span style={{ fontSize: '0.85rem', fontFamily: 'var(--font-mono)', color: 'var(--accent-primary)' }}>
              {manifest.metadata.git_commit.slice(0, 10)}
            </span>
          </div>

          <div>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
              Evaluation Seeds
            </div>
            <span style={{ fontSize: '0.85rem', fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
              {manifest.metadata.seeds.join(', ')} ({manifest.metadata.seeds.length} seeds)
            </span>
          </div>

          <div>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
              Episodes Per Planner
            </div>
            <span style={{ fontSize: '0.85rem', fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
              {manifest.metadata.total_episodes_per_planner} episodes (5 scenarios × 5 seeds)
            </span>
          </div>
        </div>
      )}

      {/* Loading & Error States */}
      {isLoading && (
        <div className="glass-panel" style={{ padding: '2rem' }}>
          <SkeletonTable rows={4} cols={8} />
        </div>
      )}

      {isError && (
        <ErrorState
          title="Validation Benchmark Data Unavailable"
          message={
            error instanceof Error
              ? error.message
              : 'Failed to retrieve runs/val_b_manifest.json from the API endpoint or static data directory.'
          }
          onRetry={() => {
            refetch();
          }}
        />
      )}

      {/* Benchmark Data Table */}
      {!isLoading && !isError && manifest && (
        <div className="glass-panel" style={{ padding: '1.25rem' }}>
          <AccessibleTable
            caption={`Validation B benchmark empirical evaluation for ${
              selectedScope === 'ALL_SCENARIOS'
                ? 'All 5 Canonical Scenarios (Pooled N=25)'
                : selectedScope.replace(/_/g, ' ') + ' (N=5)'
            }`}
            summary="Empirical evaluation comparing P3 Corrected, P3 Zero-Stall Baseline, and B1 DWA-VO Baseline with completion, collision, clearance, comfort, latency, and near-miss metrics."
            columns={columns}
            data={rows}
            keyField="config_key"
          />
        </div>
      )}

      {/* Scientific Methodology & Metric Definitions */}
      <div className="glass-panel" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Info size={18} style={{ color: 'var(--accent-primary)' }} />
          <h2 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
            Authoritative Metric Definitions (engine/metrics.py & docs/METRICS.md)
          </h2>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', fontSize: '0.825rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          <div>
            <strong style={{ color: 'var(--text-primary)' }}>Goal Completion Rate:</strong>
            <p style={{ margin: '0.2rem 0 0' }}>
              Requires reaching terminal threshold (x ≥ 65.0m, |y| ≤ 4.70m) within duration t ≤ 20.0s, terminal velocity v ≥ 0.50 m/s, with zero physical collisions.
            </p>
          </div>

          <div>
            <strong style={{ color: 'var(--text-primary)' }}>Collision Detection (SAT):</strong>
            <p style={{ margin: '0.2rem 0 0' }}>
              Full oriented polygon intersection via Separating Axis Theorem (SAT) evaluated between the 4.20m × 1.80m ego vehicle and oriented obstacle footprints.
            </p>
          </div>

          <div>
            <strong style={{ color: 'var(--text-primary)' }}>Near-Miss Temporal Frames:</strong>
            <p style={{ margin: '0.2rem 0 0' }}>
              Number of 10Hz simulation frames where minimum clearance d_min &lt; 1.00m or Time-to-Collision TTC &lt; 1.20s. Reflects cumulative proximity duration rather than discrete event encounters.
            </p>
          </div>

          <div>
            <strong style={{ color: 'var(--text-primary)' }}>Causal Filtered Jerk:</strong>
            <p style={{ margin: '0.2rem 0 0' }}>
              Variable-timestep longitudinal jerk filtered via a 3-step causal moving average to eliminate discrete step artifacts while measuring authentic passenger ride comfort.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
