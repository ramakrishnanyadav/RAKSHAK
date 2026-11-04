/**
 * OutcomeBanner - Clear Simulation Outcome Summary
 * Communicates Goal Completion vs Collision, closest gap, replan count, and latency.
 */

import React from 'react';
import { ShowcaseRunMetrics } from './types';
import { CheckCircle2, AlertOctagon, RefreshCw, Zap } from 'lucide-react';

interface OutcomeBannerProps {
  metrics: ShowcaseRunMetrics | undefined;
  variant: 'adaptive' | 'standard';
}

export const OutcomeBanner: React.FC<OutcomeBannerProps> = ({ metrics, variant }) => {
  if (!metrics) {
    return (
      <div
        style={{
          padding: '0.625rem 0.85rem',
          borderRadius: '6px',
          background: 'rgba(255, 255, 255, 0.02)',
          border: '1px solid rgba(255, 255, 255, 0.05)',
          color: '#64748B',
          fontSize: '0.8rem',
        }}
      >
        Calculating outcome...
      </div>
    );
  }

  const isSuccess = metrics.completed_goal && !metrics.collision_occurred;
  const isCollision = metrics.collision_occurred;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '0.625rem',
        padding: '0.65rem 1rem',
        borderRadius: '6px',
        background: isSuccess
          ? 'rgba(45, 212, 191, 0.08)'
          : isCollision
          ? 'rgba(239, 68, 68, 0.1)'
          : 'rgba(255, 255, 255, 0.04)',
        border: `1px solid ${
          isSuccess
            ? 'rgba(45, 212, 191, 0.25)'
            : isCollision
            ? 'rgba(239, 68, 68, 0.3)'
            : 'rgba(255, 255, 255, 0.08)'
        }`,
      }}
    >
      {/* Primary status badge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        {isSuccess ? (
          <CheckCircle2 size={16} color="#2DD4BF" />
        ) : isCollision ? (
          <AlertOctagon size={16} color="#F87171" />
        ) : (
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#FBBF24' }} />
        )}

        <span
          style={{
            fontSize: '0.85rem',
            fontWeight: 700,
            color: isSuccess ? '#2DD4BF' : isCollision ? '#F87171' : '#FBBF24',
          }}
        >
          {isSuccess ? 'Reached Goal Safely' : isCollision ? 'Collision Occurred' : 'Safely Stopped'}
        </span>
      </div>

      {/* Outcome statistics */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', fontSize: '0.75rem', color: '#94A3B8' }}>
        <div>
          Closest Gap: <strong style={{ color: '#E2E8F0', fontFamily: 'monospace' }}>{metrics.min_clearance_m.toFixed(1)}m</strong>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
          <RefreshCw size={11} /> Replans: <strong style={{ color: '#E2E8F0', fontFamily: 'monospace' }}>{metrics.replan_count}</strong>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
          <Zap size={11} /> Think: <strong style={{ color: '#E2E8F0', fontFamily: 'monospace' }}>{metrics.p95_latency_ms.toFixed(1)}ms</strong>
        </div>
      </div>
    </div>
  );
};
