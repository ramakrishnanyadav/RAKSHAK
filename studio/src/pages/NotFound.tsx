/**
 * Helpful 404 Not Found Page.
 * Discloses clear error message, accessible search/links directory,
 * and quick navigation back to key Studio workflows.
 */

import React from 'react';
import { Link } from 'react-router-dom';
import { Compass, Map, PlayCircle, BarChart3, AlertTriangle, ArrowLeft, Home } from 'lucide-react';
import { useI18n } from '../context/I18nContext';

export const NotFound: React.FC = () => {
  const { t } = useI18n();

  const directLinks = [
    { to: '/app', label: 'Studio Dashboard', desc: 'Overview of runs, research metrics, and active simulations', icon: <Home size={18} /> },
    { to: '/app/scenarios', label: 'Benchmark Scenarios', desc: 'Browse 5 canonical Indian road scenarios', icon: <Map size={18} /> },
    { to: '/app/runs', label: 'Replay Viewer', desc: '2D top-down canvas simulation with conformal cones', icon: <PlayCircle size={18} /> },
    { to: '/app/benchmark', label: 'Ablation Benchmarks', desc: 'Statistical comparison with 95% bootstrap CIs', icon: <BarChart3 size={18} /> },
    { to: '/app/failures', label: 'Failure Explorer', desc: 'Attribution analysis across perception, prediction & replan', icon: <AlertTriangle size={18} /> },
  ];

  return (
    <div
      style={{
        minHeight: '80vh',
        padding: '3rem 1.5rem',
        maxWidth: '760px',
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
          fontSize: '4rem',
          fontWeight: 900,
          color: 'var(--accent-primary)',
          lineHeight: 1,
          fontFamily: 'var(--font-mono)',
          marginBottom: '0.5rem',
        }}
      >
        404
      </div>

      <h1 style={{ fontSize: '1.75rem', fontWeight: 800, marginBottom: '0.75rem' }}>
        {t('not_found_title')}
      </h1>

      <p style={{ color: 'var(--text-secondary)', fontSize: '1rem', maxWidth: '520px', lineHeight: 1.6, marginBottom: '2rem' }}>
        {t('not_found_desc')}
      </p>

      {/* Directory of helpful routes */}
      <div
        style={{
          width: '100%',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
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
              transition: 'var(--transition-fast)',
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

      <Link
        to="/app"
        className="btn-primary"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.5rem',
          padding: '0.75rem 1.5rem',
          textDecoration: 'none',
          minHeight: 'var(--touch-target-size)',
        }}
      >
        <ArrowLeft size={16} />
        <span>Return to Dashboard</span>
      </Link>
    </div>
  );
};
