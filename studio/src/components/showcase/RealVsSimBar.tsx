/**
 * RealVsSimBar - Computed Share of Real vs. Simulated Trajectories
 * Directly derived from provenance.json file scans. No hardcoded ratios.
 */

import React from 'react';
import { Database, ShieldCheck } from 'lucide-react';

interface RealVsSimBarProps {
  realCount: number;
  simCount: number;
  realSharePct: number;
  simSharePct: number;
  accountingNote: string;
}

export const RealVsSimBar: React.FC<RealVsSimBarProps> = ({
  realCount,
  simCount,
  realSharePct,
  simSharePct,
  accountingNote,
}) => {
  return (
    <div
      style={{
        background: '#111318',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '8px',
        padding: '1.25rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.85rem',
      }}
    >
      {/* Title & Source Tag */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Database size={16} color="#2DD4BF" />
          <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#FFFFFF' }}>
            Real vs. Simulated Trajectory Share
          </h4>
        </div>

        <span
          style={{
            fontSize: '0.7rem',
            color: '#94A3B8',
            background: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            padding: '0.15rem 0.45rem',
            borderRadius: '4px',
            fontFamily: 'monospace',
          }}
          title="Computed by scanning repository files on disk"
        >
          source: provenance.json
        </span>
      </div>

      {/* Ratios Display */}
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
        <div>
          <span style={{ color: '#94A3B8' }}>Real-World Data: </span>
          <strong style={{ color: realSharePct > 0 ? '#2DD4BF' : '#94A3B8', fontFamily: 'monospace' }}>
            {realSharePct.toFixed(1)}% ({realCount} tracks)
          </strong>
        </div>
        <div>
          <span style={{ color: '#94A3B8' }}>Simulated Data: </span>
          <strong style={{ color: '#2DD4BF', fontFamily: 'monospace' }}>
            {simSharePct.toFixed(1)}% ({simCount} episodes)
          </strong>
        </div>
      </div>

      {/* Visual Dual-Color Bar */}
      <div
        style={{
          height: '10px',
          background: 'rgba(255, 255, 255, 0.06)',
          borderRadius: '5px',
          overflow: 'hidden',
          display: 'flex',
          width: '100%',
        }}
      >
        {realSharePct > 0 && (
          <div
            style={{
              width: `${realSharePct}%`,
              background: '#38BDF8',
              height: '100%',
              transition: 'width 0.4s ease',
            }}
            title={`Real Trajectories: ${realSharePct}%`}
          />
        )}
        <div
          style={{
            width: `${simSharePct}%`,
            background: '#2DD4BF',
            height: '100%',
            transition: 'width 0.4s ease',
          }}
          title={`Simulated Trajectories: ${simSharePct}%`}
        />
      </div>

      {/* Explanation Note */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', fontSize: '0.75rem', color: '#94A3B8', lineHeight: 1.45 }}>
        <ShieldCheck size={14} color="#2DD4BF" style={{ flexShrink: 0, marginTop: '2px' }} />
        <span>
          <strong>Research Audit:</strong> {accountingNote} Real IDD adapter interface is fully functional, but raw sequences require direct user registration from IIIT Hyderabad and are not bundled in Git. All live test outcomes currently originate from authentic synthetic simulation runs.
        </span>
      </div>
    </div>
  );
};

