/**
 * Landing Page for ADAPTIVE-PATH Studio (Route: /).
 * Hero presentation, research overview, architecture pillars, and direct entry points.
 * Meets WCAG 2.2 AA accessibility with 200% scaling, reduced-motion, and keyboard flow.
 */

import React from 'react';
import { Link } from 'react-router-dom';
import {
  Compass,
  PlayCircle,
  ShieldCheck,
  Zap,
  Layers,
  ArrowRight,
  BarChart3,
  Sparkles,
  Cpu,
  FileCheck,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../context/I18nContext';

export const Landing: React.FC = () => {
  const { guestLogin } = useAuth();
  const { t } = useI18n();

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--bg-app)',
        color: 'var(--text-primary)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Hero Section */}
      <section
        aria-labelledby="landing-hero-heading"
        style={{
          padding: '4rem 1.5rem',
          maxWidth: '1200px',
          margin: '0 auto',
          width: '100%',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.35rem 0.85rem',
              background: 'rgba(59, 130, 246, 0.12)',
              border: '1px solid rgba(59, 130, 246, 0.3)',
              borderRadius: '9999px',
              fontSize: '0.8rem',
              fontWeight: 700,
              color: 'var(--accent-primary)',
              marginBottom: '1.25rem',
            }}
          >
            <Sparkles size={14} aria-hidden="true" />
            <span>SMART INDIA HACKATHON 2026 • PROBLEM SIH26037 • MATHWORKS</span>
          </div>

          <h1
            id="landing-hero-heading"
            style={{
              fontSize: 'clamp(2rem, 5vw, 3.25rem)',
              fontWeight: 900,
              lineHeight: 1.15,
              letterSpacing: '-0.03em',
              marginBottom: '1.25rem',
            }}
          >
            Risk-Aware Predictive Path Planning & Simulation
          </h1>

          <p
            style={{
              fontSize: 'clamp(1rem, 2.5vw, 1.25rem)',
              color: 'var(--text-secondary)',
              maxWidth: '820px',
              margin: '0 auto 2.5rem',
              lineHeight: 1.6,
            }}
          >
            A dedicated research platform evaluating non-lane-bound trajectory optimization,
            conformal uncertainty envelopes, calibrated continuous risk fields, and sub-50ms
            event-triggered replanning on unstructured Indian mixed-traffic roads.
          </p>

          {/* Action CTAs */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '1rem',
              flexWrap: 'wrap',
            }}
          >
            <Link
              to="/demo"
              onClick={guestLogin}
              className="btn-primary"
              style={{
                padding: '0.8rem 1.75rem',
                fontSize: '1rem',
                fontWeight: 700,
                textDecoration: 'none',
                minHeight: 'var(--touch-target-size)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                boxShadow: '0 4px 14px 0 rgba(59, 130, 246, 0.39)',
              }}
            >
              <PlayCircle size={20} aria-hidden="true" />
              <span>Explore Demo Mode (14 Verified Runs)</span>
            </Link>

            <Link
              to="/app"
              className="btn-secondary"
              style={{
                padding: '0.8rem 1.5rem',
                fontSize: '1rem',
                textDecoration: 'none',
                minHeight: 'var(--touch-target-size)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              <span>Launch Studio Console</span>
              <ArrowRight size={18} aria-hidden="true" />
            </Link>
          </div>
        </div>

        {/* Feature Cards Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '1.5rem',
            marginTop: '2rem',
          }}
        >
          <div className="glass-panel" style={{ padding: '1.75rem' }}>
            <div
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '10px',
                background: 'rgba(16, 185, 129, 0.15)',
                color: 'var(--accent-teal)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '1rem',
              }}
            >
              <ShieldCheck size={24} aria-hidden="true" />
            </div>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '0.5rem' }}>
              Non-Lane Driveable Space (G2)
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.6 }}>
              Bypasses Western HD lane assumptions. Optimizes continuous $G^2$ clothoid corridors
              over irregular road boundaries, encroaching stalls, and unpaved shoulders.
            </p>
          </div>

          <div className="glass-panel" style={{ padding: '1.75rem' }}>
            <div
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '10px',
                background: 'rgba(59, 130, 246, 0.15)',
                color: 'var(--accent-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '1rem',
              }}
            >
              <Zap size={24} aria-hidden="true" />
            </div>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '0.5rem' }}>
              Conformal Prediction Cones (G3)
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.6 }}>
              Multi-hypothesis motion forecasting for autos, two-wheelers, and cattle with
              distribution-free conformal prediction bounds guaranteeing 95% marginal coverage.
            </p>
          </div>

          <div className="glass-panel" style={{ padding: '1.75rem' }}>
            <div
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '10px',
                background: 'rgba(245, 158, 11, 0.15)',
                color: 'var(--risk-medium)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '1rem',
              }}
            >
              <Layers size={24} aria-hidden="true" />
            </div>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '0.5rem' }}>
              Event-Triggered Replanning (G4)
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.6 }}>
              Dynamically triggers sub-50ms trajectory updates when risk gradient spikes or
              uncertainty envelopes intersect the nominal path, eliminating unnecessary compute.
            </p>
          </div>
        </div>
      </section>

      {/* MathWorks Simulation Integration Callout */}
      <section
        style={{
          background: 'var(--bg-surface)',
          borderTop: '1px solid var(--border-default)',
          borderBottom: '1px solid var(--border-default)',
          padding: '3rem 1.5rem',
        }}
      >
        <div
          style={{
            maxWidth: '1200px',
            margin: '0 auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '2rem',
          }}
        >
          <div>
            <div
              style={{
                fontSize: '0.8rem',
                fontWeight: 700,
                color: 'var(--accent-teal)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                marginBottom: '0.4rem',
              }}
            >
              Dual Engine Architecture
            </div>
            <h2 style={{ fontSize: '1.75rem', fontWeight: 800, margin: 0, marginBottom: '0.5rem' }}>
              MATLAB/Simulink + RoadRunner Integration
            </h2>
            <p style={{ color: 'var(--text-secondary)', maxWidth: '650px', lineHeight: 1.6, margin: 0 }}>
              The Studio connects via standardized OpenAPI batch execution to both the official
              MathWorks RoadRunner cosimulation engine and an in-process Python reference engine.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '1rem' }}>
            <Link
              to="/app/benchmark"
              className="btn-secondary"
              style={{
                padding: '0.75rem 1.25rem',
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              <BarChart3 size={18} aria-hidden="true" />
              <span>Ablation Benchmarks</span>
            </Link>

            <Link
              to="/app/reports"
              className="btn-secondary"
              style={{
                padding: '0.75rem 1.25rem',
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              <FileCheck size={18} aria-hidden="true" />
              <span>Research Reports</span>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer
        style={{
          marginTop: 'auto',
          padding: '2rem 1.5rem',
          textAlign: 'center',
          color: 'var(--text-secondary)',
          fontSize: '0.85rem',
        }}
      >
        <div>ADAPTIVE-PATH Studio • Smart India Hackathon 2026 (SIH26037)</div>
        <div style={{ marginTop: '0.35rem', color: 'var(--text-muted)' }}>
          Research Prototype — Not certified for safety-critical physical road deployment.
        </div>
      </footer>
    </div>
  );
};
