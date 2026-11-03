import React from 'react';
import { ArrowRight, ShieldCheck, Zap, Layers, PlayCircle, Eye, AlertOctagon } from 'lucide-react';
import { RunLog } from '../types/apath_log';

interface OverviewProps {
  onSelectRun: (runId: string) => void;
  availableRuns: { id: string; scenario_name: string; planner_id: string; planner_name: string }[];
}

export const Overview: React.FC<OverviewProps> = ({ onSelectRun, availableRuns }) => {
  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Hero Pitch Banner */}
      <div className="glass-panel" style={{ background: 'linear-gradient(135deg, rgba(2, 132, 199, 0.2) 0%, rgba(99, 102, 241, 0.15) 100%)', border: '1px solid rgba(56, 189, 248, 0.3)' }}>
        <div style={{ display: 'inline-block', padding: '0.2rem 0.6rem', background: 'rgba(56, 189, 248, 0.2)', color: '#38bdf8', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 700, marginBottom: '0.75rem' }}>
          SMART INDIA HACKATHON 2026 • PROBLEM SIH26037 • MATHWORKS
        </div>
        <h1 style={{ fontSize: '2.1rem', fontWeight: 800, marginBottom: '0.75rem', letterSpacing: '-0.02em' }}>
          Risk-Aware Predictive Path Planning & Adaptive Replanning
        </h1>
        <p style={{ fontSize: '1.05rem', color: 'var(--text-secondary)', maxWidth: '850px', lineHeight: 1.6, marginBottom: '1.5rem' }}>
          A simulation and research benchmarking platform designed specifically for unstructured, non-lane-bound Indian mixed traffic.
          Evaluates calibrated conformal prediction cones, continuous risk fields, and dynamic event-triggered replanning across 5 core scenarios.
        </p>

        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <button
            onClick={() => onSelectRun('run_scenario_5_cattle_crossing_p3_tune_s1000')}
            className="btn-primary"
            style={{ padding: '0.65rem 1.25rem', fontSize: '0.95rem' }}
          >
            <PlayCircle size={18} />
            <span>Launch Flagship Replay (P3 Cattle Crossing)</span>
          </button>
          <button
            onClick={() => onSelectRun('run_scenario_5_cattle_crossing_b1_tune_s1000')}
            className="btn-secondary"
            style={{ padding: '0.65rem 1.25rem', fontSize: '0.95rem' }}
          >
            <span>View Reactive Baseline (B1 DWA-VO)</span>
          </button>
        </div>
      </div>

      {/* Research Pillars Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
        <div className="glass-panel">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
            <div style={{ padding: '0.5rem', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', borderRadius: '8px' }}>
              <ShieldCheck size={22} />
            </div>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 700 }}>Non-Lane Driveable Space (G2)</h2>
          </div>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            Unlike Western simulators requiring HD lane maps, ADAPTIVE-PATH evaluates trajectories over unstructured road boundaries, potholes, and free-space polygons with unconstrained multi-modal traffic.
          </p>
        </div>

        <div className="glass-panel">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
            <div style={{ padding: '0.5rem', background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', borderRadius: '8px' }}>
              <Zap size={22} />
            </div>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 700 }}>Conformal Uncertainty & Risk (G3)</h2>
          </div>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            Multi-hypothesis motion forecasting with calibrated conformal uncertainty envelopes guaranteeing 95% marginal coverage, superimposed onto a continuous potential risk field R(x, y).
          </p>
        </div>

        <div className="glass-panel">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
            <div style={{ padding: '0.5rem', background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', borderRadius: '8px' }}>
              <Layers size={22} />
            </div>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 700 }}>Adaptive Trigger & MRM (G4, G5)</h2>
          </div>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            Event-triggered replanning dynamically responds within &lt;20ms when risk jumps or uncertainty cones are violated, backed by a Minimal-Risk Manoeuvre (MRM) fallback for conservative failure.
          </p>
        </div>
      </div>

      {/* Shipped Demonstrations Matrix */}
      <div className="glass-panel">
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem' }}>
          Curated Shipped Runs (Instant Offline Demonstration)
        </h2>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
          Select any shipped experiment below to immediately inspect the synchronized top-down replay, decision traces, and metric breakdown:
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
          {availableRuns.slice(0, 8).map((run) => (
            <button
              key={run.id}
              onClick={() => onSelectRun(run.id)}
              className="glass-panel"
              style={{
                textAlign: 'left',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                padding: '1rem',
                border: '1px solid var(--border-subtle)',
                transition: 'all 0.15s ease',
              }}
            >
              <div>
                <div style={{ fontSize: '0.75rem', color: '#38bdf8', fontWeight: 700, textTransform: 'uppercase' }}>
                  {run.planner_id} • {run.planner_name}
                </div>
                <div style={{ fontSize: '0.95rem', fontWeight: 600, marginTop: '0.25rem', color: 'var(--text-primary)' }}>
                  {run.scenario_name}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '1rem', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                <span>Seed 1000 • tune</span>
                <span style={{ color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '3px' }}>
                  Open Replay <ArrowRight size={14} />
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
