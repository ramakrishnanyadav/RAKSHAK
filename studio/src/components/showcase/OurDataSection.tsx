/**
 * OurDataSection - Transparent Dataset Provenance & Split Integrity
 * Renders 4 authentic dataset cards, training-to-test flow diagram,
 * sequence-level split visual, and computed real-vs-simulated ratio bar.
 */

import React from 'react';
import { ProvenancePayload } from './types';
import { DatasetCard } from './DatasetCard';
import { RealVsSimBar } from './RealVsSimBar';
import { ArrowRight, Layers, GitFork, ShieldAlert, Cpu } from 'lucide-react';

interface OurDataSectionProps {
  provenance: ProvenancePayload | null;
}

export const OurDataSection: React.FC<OurDataSectionProps> = ({ provenance }) => {
  if (!provenance || !provenance.scan_summary || !provenance.datasets) {
    return (
      <section id="our-data" style={{ padding: '3rem 0', textAlign: 'center', color: '#64748B' }}>
        Scanning repository data provenance...
      </section>
    );
  }

  const { datasets, scan_summary, split_protocol } = provenance;

  return (
    <section id="our-data" style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
      {/* Section Header */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span
            style={{
              fontSize: '0.75rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: '#2DD4BF',
              background: 'rgba(45, 212, 191, 0.1)',
              padding: '0.2rem 0.5rem',
              borderRadius: '4px',
            }}
          >
            Data Provenance
          </span>
          <span style={{ fontSize: '0.8rem', color: '#64748B' }}>
            Problem Statement Datasets Audit
          </span>
        </div>
        <h2 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#FFFFFF', margin: 0 }}>
          Which data was used, trained, and tested
        </h2>
        <p style={{ color: '#94A3B8', fontSize: '0.95rem', maxWidth: '720px', lineHeight: 1.5, margin: 0 }}>
          Every dataset mentioned in the problem statement is accounted for honestly.
          Statuses are computed from files that actually exist in this repository.
        </p>
      </div>

      {/* Real vs Simulated Share Bar */}
      <RealVsSimBar
        realCount={scan_summary.real_trajectories_count}
        simCount={scan_summary.simulated_trajectories_count}
        realSharePct={scan_summary.real_share_pct}
        simSharePct={scan_summary.simulated_share_pct}
        accountingNote={scan_summary.accounting_note}
      />

      {/* Grid of 4 Problem Statement Dataset Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '1.25rem',
        }}
      >
        {datasets.map((ds) => (
          <DatasetCard key={ds.id} dataset={ds} />
        ))}
      </div>

      {/* Flow Diagram: Data -> Train -> Calibrate -> Test */}
      <div
        style={{
          background: '#111318',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '8px',
          padding: '1.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.25rem',
        }}
      >
        <div>
          <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#FFFFFF' }}>
            Data to Closed-Loop Planning Pipeline
          </h3>
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.825rem', color: '#94A3B8' }}>
            Strict sequence-level isolation prevents temporal data leakage between training and evaluation.
          </p>
        </div>

        {/* 4-Step Flow Steps */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '1rem',
          }}
        >
          <div
            style={{
              background: '#14161C',
              border: '1px solid rgba(255, 255, 255, 0.06)',
              borderRadius: '6px',
              padding: '1rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.4rem',
            }}
          >
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748B' }}>STEP 01</div>
            <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#FFFFFF' }}>Ingest Data</div>
            <div style={{ fontSize: '0.8rem', color: '#94A3B8', lineHeight: 1.4 }}>
              Extract heterogeneous road user trajectories across 6 canonical vehicle classes.
            </div>
          </div>

          <div
            style={{
              background: '#14161C',
              border: '1px solid rgba(255, 255, 255, 0.06)',
              borderRadius: '6px',
              padding: '1rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.4rem',
            }}
          >
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#2DD4BF' }}>STEP 02</div>
            <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#FFFFFF' }}>Train Predictor</div>
            <div style={{ fontSize: '0.8rem', color: '#94A3B8', lineHeight: 1.4 }}>
              Fit multi-hypothesis motion models using the 60% training sequence partition.
            </div>
          </div>

          <div
            style={{
              background: '#14161C',
              border: '1px solid rgba(255, 255, 255, 0.06)',
              borderRadius: '6px',
              padding: '1rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.4rem',
            }}
          >
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#FBBF24' }}>STEP 03</div>
            <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#FFFFFF' }}>Calibrate Margin</div>
            <div style={{ fontSize: '0.8rem', color: '#94A3B8', lineHeight: 1.4 }}>
              Calibrate conformal safety bounds on the 20% disjoint calibration partition.
            </div>
          </div>

          <div
            style={{
              background: '#14161C',
              border: '1px solid rgba(255, 255, 255, 0.06)',
              borderRadius: '6px',
              padding: '1rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.4rem',
            }}
          >
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#38BDF8' }}>STEP 04</div>
            <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#FFFFFF' }}>Closed-Loop Test</div>
            <div style={{ fontSize: '0.8rem', color: '#94A3B8', lineHeight: 1.4 }}>
              Run full closed-loop collision avoidance across the 20% frozen test partition.
            </div>
          </div>
        </div>

        {/* Split Protocol Visual */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid rgba(255, 255, 255, 0.06)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#94A3B8' }}>
            <span>
              <strong>Partition Rule:</strong> {split_protocol.strategy}
            </span>
            <span style={{ color: '#2DD4BF', fontFamily: 'monospace' }}>No temporal frame leakage</span>
          </div>

          <div
            style={{
              height: '8px',
              background: 'rgba(255, 255, 255, 0.05)',
              borderRadius: '4px',
              overflow: 'hidden',
              display: 'flex',
            }}
          >
            <div style={{ width: '60%', background: '#2DD4BF', height: '100%' }} title="Train Split: 60%" />
            <div style={{ width: '20%', background: '#FBBF24', height: '100%' }} title="Calib Split: 20%" />
            <div style={{ width: '20%', background: '#38BDF8', height: '100%' }} title="Frozen Test Split: 20%" />
          </div>

          <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.75rem', color: '#94A3B8' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#2DD4BF' }} />
              <span>Train (60%)</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#FBBF24' }} />
              <span>Calib (20%)</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#38BDF8' }} />
              <span>Frozen Test (20%)</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
