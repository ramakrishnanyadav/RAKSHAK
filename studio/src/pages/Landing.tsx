/**
 * Landing Page for ADAPTIVE-PATH Studio (Route: /).
 * Professional product introduction explaining the simulation platform,
 * challenges of Indian mixed-traffic roads, core driving capabilities,
 * and clear starting points.
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
  Map,
  Eye,
  AlertTriangle,
  Info,
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
      {/* Top SIH & MathWorks Positioning Banner */}
      <div
        style={{
          background: 'rgba(59, 130, 246, 0.08)',
          borderBottom: '1px solid rgba(59, 130, 246, 0.2)',
          padding: '0.5rem 1rem',
          textAlign: 'center',
          fontSize: '0.8rem',
          fontWeight: 600,
          color: 'var(--accent-primary)',
        }}
      >
        <Sparkles size={13} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '6px' }} />
        <span>Smart India Hackathon 2026 • Problem SIH26037 • MathWorks Track</span>
      </div>

      {/* Hero Section */}
      <section
        aria-labelledby="landing-hero-heading"
        style={{
          padding: '3.5rem 1.5rem 2.5rem',
          maxWidth: '1200px',
          margin: '0 auto',
          width: '100%',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <h1
            id="landing-hero-heading"
            style={{
              fontSize: 'clamp(2.1rem, 5vw, 3.25rem)',
              fontWeight: 900,
              lineHeight: 1.15,
              letterSpacing: '-0.03em',
              marginBottom: '1.25rem',
              color: 'var(--text-primary)',
            }}
          >
            Smart Driving for India's Unpredictable Roads
          </h1>

          <p
            style={{
              fontSize: 'clamp(1.05rem, 2.2vw, 1.25rem)',
              color: 'var(--text-secondary)',
              maxWidth: '820px',
              margin: '0 auto 2.25rem',
              lineHeight: 1.6,
            }}
          >
            Explore how an intelligent driving system detects obstacles, predicts movement and finds safer paths through challenging Indian road environments.
          </p>

          {/* Primary Action Buttons */}
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
                padding: '0.85rem 1.75rem',
                fontSize: '1rem',
                fontWeight: 700,
                textDecoration: 'none',
                minHeight: 'var(--touch-target-size)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                boxShadow: '0 4px 14px 0 rgba(59, 130, 246, 0.35)',
              }}
            >
              <PlayCircle size={20} aria-hidden="true" />
              <span>Explore 14 Verified Test Drives</span>
            </Link>

            <Link
              to="/app/runs/new"
              className="btn-secondary"
              style={{
                padding: '0.85rem 1.5rem',
                fontSize: '1rem',
                textDecoration: 'none',
                minHeight: 'var(--touch-target-size)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              <span>Prepare Simulation Drive</span>
              <ArrowRight size={18} aria-hidden="true" />
            </Link>

            <Link
              to="/app/scenarios"
              className="btn-secondary"
              style={{
                padding: '0.85rem 1.25rem',
                fontSize: '0.95rem',
                textDecoration: 'none',
                minHeight: 'var(--touch-target-size)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              <Map size={18} aria-hidden="true" />
              <span>Browse 5 Scenarios</span>
            </Link>
          </div>
        </div>

        {/* 3 Core Driving Capabilities */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: '1.25rem',
            marginTop: '2rem',
          }}
        >
          <div className="glass-panel" style={{ padding: '1.75rem', border: '1px solid var(--border-default)' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '8px',
                background: 'rgba(16, 185, 129, 0.15)',
                color: 'var(--accent-teal)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '1rem',
              }}
            >
              <ShieldCheck size={22} aria-hidden="true" />
            </div>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '0.45rem' }}>
              Finding Paths Without Painted Lanes
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.6, margin: 0 }}>
              Real Indian roads frequently lack painted lane markings. The simulator identifies safe, continuous driving corridors across uneven surfaces, unpaved shoulders, and roadside obstacles.
            </p>
          </div>

          <div className="glass-panel" style={{ padding: '1.75rem', border: '1px solid var(--border-default)' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '8px',
                background: 'rgba(59, 130, 246, 0.15)',
                color: 'var(--accent-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '1rem',
              }}
            >
              <Zap size={22} aria-hidden="true" />
            </div>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '0.45rem' }}>
              Accounting for Movement Uncertainty
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.6, margin: 0 }}>
              Pedestrians, auto-rickshaws, and wandering cattle move unpredictably. The simulator calculates safety buffers that account for potential direction changes to prevent dangerous close calls.
            </p>
          </div>

          <div className="glass-panel" style={{ padding: '1.75rem', border: '1px solid var(--border-default)' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '8px',
                background: 'rgba(245, 158, 11, 0.15)',
                color: 'var(--risk-medium)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '1rem',
              }}
            >
              <Layers size={22} aria-hidden="true" />
            </div>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '0.45rem' }}>
              Rapid Path Recalculation
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.6, margin: 0 }}>
              When an oncoming vehicle cuts across or an animal stops mid-road, the vehicle immediately checks the driving path again, slowing down or finding a safe detour without hesitation.
            </p>
          </div>
        </div>
      </section>

      {/* Explanatory Product Walkthrough Section */}
      <section
        style={{
          background: 'var(--bg-surface)',
          borderTop: '1px solid var(--border-default)',
          borderBottom: '1px solid var(--border-default)',
          padding: '3rem 1.5rem',
        }}
      >
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
            <h2 style={{ fontSize: '1.65rem', fontWeight: 800, margin: '0 0 0.5rem' }}>
              How ADAPTIVE-PATH Simulates Real Indian Driving
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', maxWidth: '720px', margin: '0 auto' }}>
              A structured simulation platform designed to test autonomous driving decision-making against unstructured, real-world traffic behavior.
            </p>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
              gap: '1.5rem',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--accent-primary)', textTransform: 'uppercase' }}>
                1. Road Environments
              </div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>5 Indian Road Scenarios</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: 1.6, margin: 0 }}>
                Simulate unmarked village roads with potholes, busy unsignalized intersections, highway merges with slow auto-rickshaws, crowded market streets, and sudden cattle crossings.
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--accent-primary)', textTransform: 'uppercase' }}>
                2. Driving Algorithms
              </div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>6 Driving Strategies</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: 1.6, margin: 0 }}>
                Compare standard reactive driving algorithms (B0, B1, B2) against predictive, risk-aware path planners (P1, P2, P3) under identical traffic conditions and random seeds.
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--accent-primary)', textTransform: 'uppercase' }}>
                3. Evaluation Metrics
              </div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>Clear Safety & Comfort Scoring</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: 1.6, margin: 0 }}>
                Every drive is evaluated on trip completion, collision avoidance, closest hazard buffer, ride smoothness (jerk), and how quickly the vehicle calculates new paths.
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--accent-primary)', textTransform: 'uppercase' }}>
                4. Simulation Engine
              </div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>Dual Simulation Architecture</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: 1.6, margin: 0 }}>
                Runs through an in-process reference engine and connects with MathWorks RoadRunner for co-simulation, producing synchronized run logs and replays.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Research Disclaimer & Transparency Notice */}
      <section
        style={{
          padding: '2.5rem 1.5rem',
          maxWidth: '1200px',
          margin: '0 auto',
          width: '100%',
        }}
      >
        <div
          className="glass-panel"
          style={{
            padding: '1.25rem 1.5rem',
            border: '1px solid var(--border-default)',
            background: 'var(--bg-surface-elevated)',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '1rem',
          }}
        >
          <Info size={22} color="var(--accent-primary)" style={{ flexShrink: 0, marginTop: '2px' }} />
          <div>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: '0 0 0.35rem' }}>
              Research Prototype Notice
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
              ADAPTIVE-PATH is an engineering research and simulation platform developed for Smart India Hackathon 2026 (SIH26037). It is designed to evaluate intelligent path planning algorithms in simulation and is not certified for road deployment or commercial vehicle control.
            </p>
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
          borderTop: '1px solid var(--border-default)',
        }}
      >
        <div>ADAPTIVE-PATH Studio • Smart India Hackathon 2026 (SIH26037)</div>
        <div style={{ marginTop: '0.35rem', color: 'var(--text-muted)' }}>
          Research and Simulation Platform — For Algorithmic Benchmarking
        </div>
      </footer>
    </div>
  );
};
