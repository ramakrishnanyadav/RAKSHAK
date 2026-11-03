/**
 * Failure Explorer & Attribution Taxonomy (Route: /app/failures).
 * Module attribution engine attributing failures and near-misses to:
 * - PERCEPTION (occlusion, sensor drop)
 * - PREDICTION (hypothesis miss, heading divergence)
 * - RISK (field miscalibration)
 * - PLANNING (optimization timeout, non-smooth path)
 * Features direct jump to failure timestamp in Replay Viewer.
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Play, ShieldAlert, Filter, Eye, ArrowRight } from 'lucide-react';
import { AccessibleTable, ColumnDef } from '../components/AccessibleTable';
import { useI18n } from '../context/I18nContext';

interface FailureRecord {
  runId: string;
  scenarioName: string;
  plannerId: string;
  seed: number;
  failureTag: 'PERCEPTION' | 'PREDICTION' | 'RISK' | 'PLANNING';
  causeSummary: string;
  failureTimeS: number;
  minClearance: number;
}

const FAILURE_RECORDS: FailureRecord[] = [
  {
    runId: 'run_scenario_5_cattle_crossing_p1_tune_s1000',
    scenarioName: 'Sudden Cattle Crossing',
    plannerId: 'P1',
    seed: 1000,
    failureTag: 'PREDICTION',
    causeSummary: 'Nominal linear CTRV prediction failed when cattle abruptly halted mid-lane; fixed 1.0s replan timer was too late.',
    failureTimeS: 2.1,
    minClearance: 0.12,
  },
  {
    runId: 'run_scenario_5_cattle_crossing_b0_tune_s1000',
    scenarioName: 'Sudden Cattle Crossing',
    plannerId: 'B0',
    seed: 1000,
    failureTag: 'PLANNING',
    causeSummary: 'Non-reactive baseline followed nominal centerline without any avoidance maneuver; direct rear impact with cattle.',
    failureTimeS: 3.2,
    minClearance: 0.0,
  },
  {
    runId: 'run_scenario_4_dense_market_b1_tune_s1000',
    scenarioName: 'Dense Market Street',
    plannerId: 'B1',
    seed: 1000,
    failureTag: 'PERCEPTION',
    causeSummary: 'Pedestrian emerged from behind parked auto stall; velocity obstacle reactive window was insufficient without foresight.',
    failureTimeS: 3.4,
    minClearance: 0.35,
  },
  {
    runId: 'run_scenario_2_urban_intersection_b1_tune_s1000',
    scenarioName: 'Busy Urban Intersection',
    plannerId: 'B1',
    seed: 1000,
    failureTag: 'RISK',
    causeSummary: 'Two-wheeler swerved into gap; reactive VO lacked continuous multi-hypothesis risk field, causing near-miss panic brake.',
    failureTimeS: 2.8,
    minClearance: 0.48,
  },
];

export const FailuresView: React.FC = () => {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [filterTag, setFilterTag] = useState<string>('ALL');

  const filtered =
    filterTag === 'ALL'
      ? FAILURE_RECORDS
      : FAILURE_RECORDS.filter((f) => f.failureTag === filterTag);

  const columns: ColumnDef<FailureRecord>[] = [
    {
      key: 'failureTag',
      header: 'Attributed Module',
      sortable: true,
      render: (r) => {
        let pattern = 'pattern-hazard-dots';
        let color = 'var(--risk-high)';
        if (r.failureTag === 'PLANNING') color = 'var(--risk-critical)';
        else if (r.failureTag === 'PERCEPTION') color = 'var(--accent-teal)';
        else if (r.failureTag === 'PREDICTION') color = 'var(--accent-primary)';

        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              fontFamily: 'var(--font-mono)',
              fontWeight: 700,
              fontSize: '0.75rem',
              padding: '2px 8px',
              borderRadius: '4px',
              background: 'var(--bg-surface-elevated)',
              color,
              border: '1px solid currentColor',
            }}
          >
            {r.failureTag}
          </span>
        );
      },
    },
    {
      key: 'scenarioName',
      header: 'Scenario & Seed',
      sortable: true,
      render: (r) => (
        <div>
          <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{r.scenarioName}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            Planner {r.plannerId} • Seed {r.seed}
          </div>
        </div>
      ),
    },
    {
      key: 'causeSummary',
      header: 'Root Cause Breakdown',
      render: (r) => <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{r.causeSummary}</span>,
    },
    {
      key: 'failureTimeS',
      header: 'Critical Time',
      sortable: true,
      render: (r) => `${r.failureTimeS.toFixed(1)}s`,
    },
    {
      key: 'minClearance',
      header: 'Min Clr',
      sortable: true,
      render: (r) => (
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontWeight: 700,
            color: r.minClearance === 0 ? 'var(--risk-critical)' : 'var(--risk-medium)',
          }}
        >
          {r.minClearance.toFixed(2)}m
        </span>
      ),
    },
    {
      key: 'action',
      header: 'Investigation',
      render: (r) => (
        <button
          onClick={() => navigate(`/app/runs/${r.runId}?t=${r.failureTimeS.toFixed(1)}`)}
          className="btn-primary"
          style={{
            padding: '0.35rem 0.65rem',
            fontSize: '0.75rem',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.35rem',
            minHeight: 'var(--min-target-size)',
          }}
        >
          <Play size={12} />
          <span>Inspect at {r.failureTimeS}s</span>
        </button>
      ),
    },
  ];

  return (
    <div style={{ padding: '1.5rem', maxWidth: '1280px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.85rem', fontWeight: 800, margin: '0 0 0.4rem', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <AlertTriangle size={24} color="var(--risk-medium)" />
            {t('nav_failures')}
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', margin: 0 }}>
            Systematic failure mode attribution across Perception, Motion Forecasting, Risk Field, and Path Optimization.
          </p>
        </div>

        {/* Filter Chips */}
        <div
          role="group"
          aria-label="Filter failures by attributed subsystem"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            background: 'var(--bg-surface-elevated)',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-md)',
            padding: '2px',
          }}
        >
          {['ALL', 'PERCEPTION', 'PREDICTION', 'RISK', 'PLANNING'].map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => setFilterTag(tag)}
              aria-pressed={filterTag === tag}
              style={{
                background: filterTag === tag ? 'var(--accent-primary)' : 'transparent',
                color: filterTag === tag ? '#ffffff' : 'var(--text-secondary)',
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                padding: '0.35rem 0.65rem',
                fontSize: '0.75rem',
                fontWeight: 700,
                cursor: 'pointer',
                minHeight: 'var(--min-target-size)',
              }}
            >
              {tag}
            </button>
          ))}
        </div>
      </div>

      <div className="glass-panel" style={{ padding: '1.25rem' }}>
        <AccessibleTable
          caption="Root cause failure attribution logs for benchmark simulation collisions"
          summary="Details the exact failure mechanism, timestamp, minimum clearance, and provides jump links to inspect the simulation"
          columns={columns}
          data={filtered}
          keyField="runId"
        />
      </div>
    </div>
  );
};
