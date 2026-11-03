/**
 * Demo Mode Page (Route: /demo).
 * Enters guest mode instantly with access to all 14 pre-bundled verified SIH2026 runs
 * without requiring account registration or credentials.
 */

import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useAnnouncer } from '../components/LiveAnnouncer';
import { CheckCircle2, PlayCircle, ArrowRight } from 'lucide-react';

export const Demo: React.FC = () => {
  const { guestLogin } = useAuth();
  const { announce } = useAnnouncer();
  const navigate = useNavigate();

  useEffect(() => {
    guestLogin();
    announce('Demo Guest Mode activated. Loading 14 pre-bundled verified SIH2026 runs.', 'polite');
    // Brief delay for screen reader before navigating
    const timer = setTimeout(() => {
      navigate('/app', { replace: true });
    }, 800);
    return () => clearTimeout(timer);
  }, [guestLogin, announce, navigate]);

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem',
        background: 'var(--bg-app)',
      }}
    >
      <div
        className="glass-panel"
        style={{
          maxWidth: '520px',
          width: '100%',
          padding: '2.5rem',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            background: 'rgba(59, 130, 246, 0.15)',
            color: 'var(--accent-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1.5rem',
          }}
        >
          <PlayCircle size={28} />
        </div>

        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '0.75rem' }}>
          Activating Demo Guest Mode
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: 1.6, marginBottom: '1.5rem' }}>
          Configuring guest session with offline access to 14 verified multi-planner runs,
          ablation benchmarks, and failure traces...
        </p>

        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <button
            onClick={() => navigate('/app', { replace: true })}
            className="btn-primary"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.65rem 1.25rem',
            }}
          >
            <span>Proceed to Studio</span>
            <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};
