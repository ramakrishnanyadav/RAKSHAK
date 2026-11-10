import React from 'react';
import { ShieldAlert } from 'lucide-react';

export const EvidencePanel: React.FC = () => {
  return (
    <div
      role="region"
      aria-label="Permanent Research & Empirical Evidence Panel"
      style={{
        backgroundColor: 'rgba(16, 22, 35, 0.88)',
        border: '1px solid rgba(56, 189, 248, 0.22)',
        borderRadius: '8px',
        padding: '1.1rem 1.35rem',
        color: '#E2E8F0',
        boxShadow: '0 8px 30px rgba(0, 0, 0, 0.5), 0 0 20px rgba(56, 189, 248, 0.08)',
        margin: '1rem 0',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.5rem',
          borderBottom: '1px solid rgba(56, 189, 248, 0.15)',
          paddingBottom: '0.65rem',
          marginBottom: '0.85rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <ShieldAlert size={18} color="#F59E0B" aria-hidden="true" />
          <h3
            style={{
              margin: 0,
              fontSize: '0.85rem',
              fontWeight: 800,
              color: '#FFFFFF',
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
            }}
          >
            Empirical Evidence & Benchmark Reconciliation
          </h3>
        </div>
        <span
          style={{
            fontSize: '0.68rem',
            fontFamily: 'monospace',
            padding: '2px 8px',
            borderRadius: '4px',
            backgroundColor: 'rgba(56, 189, 248, 0.1)',
            color: '#38BDF8',
            border: '1px solid rgba(56, 189, 248, 0.25)',
            fontWeight: 800,
            letterSpacing: '0.04em',
          }}
        >
          RESEARCH TRUTH CONTRACT
        </span>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '0.75rem',
        }}
      >
        {/* 1. Flagship Replay Outcome */}
        <div
          style={{
            backgroundColor: 'rgba(11, 15, 23, 0.85)',
            border: '1px solid rgba(56, 189, 248, 0.18)',
            borderRadius: '6px',
            padding: '0.85rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.4rem',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: 'linear-gradient(90deg, #10b981, #34d399)' }} />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 700, color: '#34D399' }}>
            <span>Flagship Replay (Seed 2005)</span>
            <span style={{ fontSize: '0.65rem', fontFamily: 'monospace', padding: '1px 5px', borderRadius: '3px', backgroundColor: '#064E3B', border: '1px solid #047857' }}>
              val_b
            </span>
          </div>
          <p style={{ margin: 0, fontSize: '0.7rem', color: '#94A3B8' }}>
            Sudden Cattle Crossing (SCENARIO_5)
          </p>
          <div style={{ fontSize: '0.72rem', fontFamily: 'monospace', display: 'flex', flexDirection: 'column', gap: '0.2rem', paddingTop: '0.3rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#6EE7B7' }}>
              <span>P3 Adaptive:</span>
              <span style={{ fontWeight: 700 }}>Goal reached (t=12.6s)</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#CBD5E1' }}>
              <span>Collisions:</span>
              <span style={{ color: '#34D399' }}>0</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#CBD5E1' }}>
              <span>Min clearance:</span>
              <span>0.78 m <span style={{ fontSize: '0.65rem', color: '#38BDF8' }}>[DERIVED]</span></span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94A3B8', borderTop: '1px solid #1E293B', paddingTop: '0.25rem', marginTop: '0.15rem' }}>
              <span>B1 Standard:</span>
              <span style={{ color: '#FB7185' }}>Collision (t=7.3s, 0.0m)</span>
            </div>
          </div>
        </div>

        {/* 2. Validation B Aggregates */}
        <div
          style={{
            backgroundColor: 'rgba(11, 15, 23, 0.85)',
            border: '1px solid rgba(56, 189, 248, 0.18)',
            borderRadius: '6px',
            padding: '0.85rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.4rem',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: 'linear-gradient(90deg, #f59e0b, #fbbf24)' }} />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 700, color: '#FBBF24' }}>
            <span>Validation B Aggregates</span>
            <span style={{ fontSize: '0.65rem', fontFamily: 'monospace', padding: '1px 5px', borderRadius: '3px', backgroundColor: 'rgba(245, 158, 11, 0.2)', color: '#fbbf24', border: '1px solid rgba(245, 158, 11, 0.35)' }}>
              N=25
            </span>
          </div>
          <p style={{ margin: 0, fontSize: '0.7rem', color: '#FCD34D' }}>
            Post-tuning evidence (val_b, seeds 2005-2009)
          </p>
          <div style={{ fontSize: '0.72rem', fontFamily: 'monospace', display: 'flex', flexDirection: 'column', gap: '0.2rem', paddingTop: '0.3rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#CBD5E1' }}>
              <span>Goal completion:</span>
              <span style={{ fontWeight: 700, color: '#FBBF24' }}>56.0% (14/25)</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#CBD5E1' }}>
              <span>Collision rate:</span>
              <span style={{ fontWeight: 700, color: '#FB7185' }}>20.0% (5/25)</span>
            </div>
            <div style={{ fontSize: '0.65rem', color: '#94A3B8', fontStyle: 'italic', borderTop: '1px solid rgba(56, 189, 248, 0.12)', paddingTop: '0.25rem', marginTop: '0.15rem' }}>
              Note: Tuning split evidence, not a clean held-out test.
            </div>
          </div>
        </div>

        {/* 3. Frozen-Test P3 Benchmark */}
        <div
          style={{
            backgroundColor: 'rgba(11, 15, 23, 0.85)',
            border: '1px solid rgba(56, 189, 248, 0.18)',
            borderRadius: '6px',
            padding: '0.85rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.4rem',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: 'linear-gradient(90deg, #0ea5e9, #38bdf8)' }} />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 700, color: '#38BDF8' }}>
            <span>Frozen-Test Benchmark</span>
            <span style={{ fontSize: '0.65rem', fontFamily: 'monospace', padding: '1px 5px', borderRadius: '3px', backgroundColor: 'rgba(56, 189, 248, 0.2)', color: '#38bdf8', border: '1px solid rgba(56, 189, 248, 0.35)' }}>
              N=150
            </span>
          </div>
          <p style={{ margin: 0, fontSize: '0.7rem', color: '#94A3B8' }}>
            Held-out frozen benchmark (seeds 3000-3029)
          </p>
          <div style={{ fontSize: '0.72rem', fontFamily: 'monospace', display: 'flex', flexDirection: 'column', gap: '0.2rem', paddingTop: '0.3rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#CBD5E1' }}>
              <span>Collision rate:</span>
              <span style={{ color: '#34D399' }}>0.0% (0/150)</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#CBD5E1' }}>
              <span>Goal completion:</span>
              <span style={{ color: '#FB7185', fontWeight: 700 }}>0.0% (0/150)</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#CBD5E1' }}>
              <span>Mean speed:</span>
              <span style={{ color: '#FBBF24', fontWeight: 700 }}>1.24 m/s (Stall)</span>
            </div>
            <div style={{ fontSize: '0.65rem', color: '#94A3B8', borderTop: '1px solid rgba(56, 189, 248, 0.12)', paddingTop: '0.25rem', marginTop: '0.15rem' }}>
              Comparator B2: 99.3% completion, 0.67% collisions, 7.85 m/s.
            </div>
          </div>
        </div>

        {/* 4. Tuning Seed 1000 Collision */}
        <div
          style={{
            backgroundColor: 'rgba(11, 15, 23, 0.85)',
            border: '1px solid rgba(56, 189, 248, 0.18)',
            borderRadius: '6px',
            padding: '0.85rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.4rem',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: 'linear-gradient(90deg, #f43f5e, #fb7185)' }} />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 700, color: '#FB7185' }}>
            <span>Tuning Seed 1000 Run</span>
            <span style={{ fontSize: '0.65rem', fontFamily: 'monospace', padding: '1px 5px', borderRadius: '3px', backgroundColor: 'rgba(244, 63, 94, 0.2)', color: '#fb7185', border: '1px solid rgba(244, 63, 94, 0.35)' }}>
              tune_s1000
            </span>
          </div>
          <p style={{ margin: 0, fontSize: '0.7rem', color: '#94A3B8' }}>
            run_scenario_5_cattle_crossing_p3_tune_s1000
          </p>
          <div style={{ fontSize: '0.72rem', fontFamily: 'monospace', display: 'flex', flexDirection: 'column', gap: '0.2rem', paddingTop: '0.3rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#CBD5E1' }}>
              <span>Outcome:</span>
              <span style={{ color: '#FB7185', fontWeight: 700 }}>Collision (t=5.1s)</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#CBD5E1' }}>
              <span>Min clearance:</span>
              <span style={{ color: '#FB7185' }}>0.0 m</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#CBD5E1' }}>
              <span>Replans:</span>
              <span>25 replans</span>
            </div>
            <div style={{ fontSize: '0.65rem', color: '#94A3B8', borderTop: '1px solid rgba(56, 189, 248, 0.12)', paddingTop: '0.25rem', marginTop: '0.15rem' }}>
              docs/FREEZE.md claim of 0 collisions on s1000 was incorrect.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
