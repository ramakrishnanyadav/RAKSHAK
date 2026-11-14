/**
 * Helpful 404 Not Found Page.
 * Discloses clear error message, accessible search/links directory,
 * and quick navigation back to key Studio workflows.
 */

import React from 'react';
import { Link } from 'react-router-dom';
import { Compass, Map, PlayCircle, BarChart3, AlertTriangle, ArrowLeft, Home, Cpu, Box, Columns } from 'lucide-react';
import { useI18n } from '../context/I18nContext';

export const NotFound: React.FC = () => {
  const { t } = useI18n();

  const directLinks = [
    { to: '/app', label: 'Studio Dashboard', desc: 'Overview of runs, research metrics, and active simulations', icon: <Home size={18} /> },
    { to: '/app/matlab', label: 'MATLAB SIL Studio', desc: 'Real 3D vehicle engineering workstation & Simulink validation', icon: <Cpu size={18} /> },
    { to: '/app/workstation', label: '3D Workstation', desc: 'Interactive Three.js multi-camera autonomous vehicle replay', icon: <Box size={18} /> },
    { to: '/app/scenarios', label: 'Benchmark Scenarios', desc: 'Browse 8 canonical Indian road scenarios', icon: <Map size={18} /> },
    { to: '/app/runs', label: 'Experiment Directory', desc: 'Filter, inspect, and replay recorded simulation runs', icon: <PlayCircle size={18} /> },
    { to: '/app/compare', label: 'Comparative Replay', desc: 'Multi-planner head-to-head trajectory analysis', icon: <Columns size={18} /> },
    { to: '/app/benchmark', label: 'Ablation Benchmarks', desc: 'Statistical comparison with 95% bootstrap CIs', icon: <BarChart3 size={18} /> },
    { to: '/app/failures', label: 'Failure Explorer', desc: 'Attribution analysis across perception, prediction & replan', icon: <AlertTriangle size={18} /> },
  ];

  return (
    <div
      style={{
        minHeight: '80vh',
        padding: '3rem 1.5rem',
        maxWidth: '820px',
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          fontSize: '4.5rem',
          fontWeight: 900,
          background: 'linear-gradient(135deg, #38bdf8, #818cf8)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          lineHeight: 1,
          fontFamily: 'var(--font-mono)',
          marginBottom: '0.5rem',
          letterSpacing: '-0.03em',
        }}
      >
        404
      </div>

      <h1 style={{
        fontSize: '1.75rem',
        fontWeight: 800,
        marginBottom: '0.75rem',
        background: 'linear-gradient(135deg, #f8fafc 0%, #94a3b8 100%)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
      }}>
        {t('not_found_title')}
      </h1>

      <p style={{ color: '#94a3b8', fontSize: '1rem', maxWidth: '560px', lineHeight: 1.6, marginBottom: '2rem' }}>
        The requested studio route does not exist. Use the quick links below to jump to any active workstation or return to the dashboard.
      </p>

      {/* Directory of helpful routes */}
      <div
        style={{
          width: '100%',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: '1rem',
          textAlign: 'left',
          marginBottom: '2rem',
        }}
      >
        {directLinks.map((link) => (
          <Link
            key={link.to}
            to={link.to}
            className="glass-panel"
            style={{
              padding: '1rem',
              textDecoration: 'none',
              color: 'inherit',
              display: 'flex',
              gap: '0.75rem',
              alignItems: 'flex-start',
              border: '1px solid var(--border-default)',
              transition: 'all 0.2s ease',
              borderRadius: '8px',
              backgroundColor: 'rgba(15, 23, 42, 0.65)',
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'rgba(56, 189, 248, 0.5)';
              e.currentTarget.style.backgroundColor = 'rgba(15, 23, 42, 0.85)';
              e.currentTarget.style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--border-default)';
              e.currentTarget.style.backgroundColor = 'rgba(15, 23, 42, 0.65)';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            <div style={{ color: 'var(--accent-primary)', marginTop: '2px' }}>{link.icon}</div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                {link.label}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                {link.desc}
              </div>
            </div>
          </Link>
        ))}
      </div>

      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center' }}>
        <Link
          to="/app"
          className="btn-primary"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            textDecoration: 'none',
            padding: '0.75rem 1.5rem',
            borderRadius: '8px',
            fontWeight: 600,
            background: 'linear-gradient(135deg, #0284c7, #38bdf8)',
            color: '#04111d',
            cursor: 'pointer',
          }}
        >
          <ArrowLeft size={16} />
          {t('return_home')}
        </Link>

        <button
          onClick={() => { window.location.href = '/app'; }}
          className="btn-secondary"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.75rem 1.5rem',
            borderRadius: '8px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Reload Dashboard Directly
        </button>
      </div>
    </div>
  );
};
