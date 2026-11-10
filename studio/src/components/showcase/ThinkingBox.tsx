/**
 * ThinkingBox - Plain English Vehicle Reasoning & Stateflow Status
 * Displays "What the car is thinking", active Stateflow mode, and real-time kinematics.
 */

import React from 'react';
import { StateflowState, ShowcaseFrame } from './types';
import { Compass, Gauge, ShieldAlert } from 'lucide-react';

interface ThinkingBoxProps {
  frame: ShowcaseFrame | undefined;
  variant: 'adaptive' | 'standard';
  plannerName: string;
}

const STATE_COLORS: Record<StateflowState, { bg: string; text: string; border: string }> = {
  FOLLOW: {
    bg: 'rgba(56, 189, 248, 0.12)',
    text: '#38BDF8',
    border: 'rgba(56, 189, 248, 0.3)',
  },
  SLOW: {
    bg: 'rgba(251, 191, 36, 0.12)',
    text: '#FBBF24',
    border: 'rgba(251, 191, 36, 0.3)',
  },
  BYPASS: {
    bg: 'rgba(45, 212, 191, 0.14)',
    text: '#2DD4BF',
    border: 'rgba(45, 212, 191, 0.35)',
  },
  STOP: {
    bg: 'rgba(249, 115, 22, 0.12)',
    text: '#FB923C',
    border: 'rgba(249, 115, 22, 0.3)',
  },
  EMERGENCY_BRAKE: {
    bg: 'rgba(239, 68, 68, 0.18)',
    text: '#F87171',
    border: 'rgba(239, 68, 68, 0.4)',
  },
};

export const ThinkingBox: React.FC<ThinkingBoxProps> = ({ frame, variant, plannerName }) => {
  const ego = frame?.ego;
  const activeState: StateflowState = ego?.active_state || 'FOLLOW';
  const stateStyle = STATE_COLORS[activeState] || STATE_COLORS.FOLLOW;

  const speedKmh = ego ? (ego.v * 3.6).toFixed(1) : '0.0';
  const steeringDeg = ego ? ((ego.steering * 180) / Math.PI).toFixed(1) : '0.0';
  const minClearance = frame ? frame.min_clearance_m.toFixed(1) : '—';

  return (
    <div
      style={{
        background: '#111318',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '8px',
        padding: '1rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem',
      }}
    >
      {/* Header: Planner title + Stateflow chip */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: variant === 'adaptive' ? '#2DD4BF' : '#94A3B8',
            }}
          />
          <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#FFFFFF' }}>{plannerName}</span>
        </div>

        {/* Stateflow Supervisory State Chip */}
        <div
          style={{
            background: stateStyle.bg,
            color: stateStyle.text,
            border: `1px solid ${stateStyle.border}`,
            borderRadius: '4px',
            padding: '0.15rem 0.5rem',
            fontSize: '0.75rem',
            fontWeight: 700,
            fontFamily: 'monospace',
            letterSpacing: '0.04em',
          }}
          title="Stateflow supervisory state"
        >
          {activeState.replace('_', ' ')}
        </div>
      </div>

      {/* Plain-English Live Caption (Logged decision trace or active state only) */}
      <div
        style={{
          background: 'rgba(0, 0, 0, 0.25)',
          padding: '0.625rem 0.75rem',
          borderRadius: '6px',
          borderLeft: `3px solid ${variant === 'adaptive' ? '#2DD4BF' : '#64748B'}`,
        }}
      >
        <p
          style={{
            margin: 0,
            fontSize: '0.85rem',
            color: '#E2E8F0',
            lineHeight: 1.45,
            fontFamily: 'monospace',
          }}
        >
          {(frame as any)?.decision_trace || (frame?.ego ? `[${frame.ego.active_state}] Nominal tracking` : 'Not logged')}
        </p>
      </div>

      {/* Telemetry Row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '0.5rem',
          paddingTop: '0.25rem',
          borderTop: '1px solid rgba(255, 255, 255, 0.05)',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: '0.7rem', color: '#64748B', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <Gauge size={11} /> Speed
          </span>
          <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#CBD5E1', fontFamily: 'monospace' }}>
            {speedKmh} <span style={{ fontSize: '0.7rem', fontWeight: 400, color: '#64748B' }}>km/h</span>
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: '0.7rem', color: '#64748B', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <Compass size={11} /> Steering
          </span>
          <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#CBD5E1', fontFamily: 'monospace' }}>
            {steeringDeg}°
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: '0.7rem', color: '#64748B', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <ShieldAlert size={11} /> Clearance
          </span>
          <span
            style={{
              fontSize: '0.9rem',
              fontWeight: 600,
              fontFamily: 'monospace',
              color: parseFloat(minClearance) < 0.5 ? '#F87171' : '#CBD5E1',
            }}
          >
            {minClearance} <span style={{ fontSize: '0.7rem', fontWeight: 400, color: '#64748B' }}>m</span>
          </span>
        </div>
      </div>
    </div>
  );
};

