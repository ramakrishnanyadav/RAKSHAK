/**
 * Accessible Sign-Up Page (Route: /signup).
 * Registration form with role selector (Researcher, Designer, Admin) and password validation.
 */

import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { UserPlus, AlertCircle, CheckCircle } from 'lucide-react';

export const Signup: React.FC = () => {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState('researcher');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (password.length < 8) {
      setErrorMsg('Password must be at least 8 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMsg('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);
    try {
      await register(email, password, role);
      navigate('/app');
    } catch (err: any) {
      setErrorMsg(err.message || 'Registration failed. Email may already be registered.');
    } finally {
      setIsSubmitting(false);
    }
  };

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
          maxWidth: '460px',
          width: '100%',
          padding: '2.5rem 2rem',
          border: '1px solid var(--border-default)',
        }}
      >
        <div style={{ marginBottom: '1.5rem', textAlign: 'center' }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0, marginBottom: '0.4rem' }}>
            Create Researcher Account
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', margin: 0 }}>
            Join the ADAPTIVE-PATH Simulation & Benchmarking Platform
          </p>
        </div>

        {errorMsg && (
          <div
            id="signup-error-alert"
            role="alert"
            style={{
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid var(--risk-critical)',
              borderRadius: 'var(--radius-sm)',
              padding: '0.75rem',
              marginBottom: '1.25rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              color: 'var(--risk-critical)',
              fontSize: '0.85rem',
            }}
          >
            <AlertCircle size={16} aria-hidden="true" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <div style={{ marginBottom: '1.2rem' }}>
            <label
              htmlFor="signup-email"
              style={{
                display: 'block',
                fontSize: '0.85rem',
                fontWeight: 600,
                color: 'var(--text-primary)',
                marginBottom: '0.4rem',
              }}
            >
              Email address
            </label>
            <input
              id="signup-email"
              type="email"
              autoComplete="email"
              required
              aria-invalid={!!errorMsg}
              aria-describedby={errorMsg ? 'signup-error-alert' : undefined}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="researcher@iit.ac.in"
              style={{
                width: '100%',
                padding: '0.65rem 0.85rem',
                borderRadius: 'var(--radius-sm)',
                border: errorMsg ? '2px solid var(--risk-critical)' : '1px solid var(--border-default)',
                background: 'var(--bg-surface)',
                color: 'var(--text-primary)',
                fontSize: '0.9rem',
                boxSizing: 'border-box',
                minHeight: 'var(--min-target-size)',
              }}
            />
          </div>

          <div style={{ marginBottom: '1.2rem' }}>
            <label
              htmlFor="signup-role"
              style={{
                display: 'block',
                fontSize: '0.85rem',
                fontWeight: 600,
                color: 'var(--text-primary)',
                marginBottom: '0.4rem',
              }}
            >
              Primary Role
            </label>
            <select
              id="signup-role"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              style={{
                width: '100%',
                padding: '0.65rem 0.85rem',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-default)',
                background: 'var(--bg-surface)',
                color: 'var(--text-primary)',
                fontSize: '0.9rem',
                boxSizing: 'border-box',
                minHeight: 'var(--min-target-size)',
              }}
            >
              <option value="researcher">Researcher (Run Simulations, Inspect Telemetry)</option>
              <option value="designer">Scenario Designer (Configure Road & Obstacle Assets)</option>
              <option value="admin">Administrator (Full System & User Control)</option>
            </select>
          </div>

          <div style={{ marginBottom: '1.2rem' }}>
            <label
              htmlFor="signup-password"
              style={{
                display: 'block',
                fontSize: '0.85rem',
                fontWeight: 600,
                color: 'var(--text-primary)',
                marginBottom: '0.4rem',
              }}
            >
              Password (min. 8 characters)
            </label>
            <input
              id="signup-password"
              type="password"
              autoComplete="new-password"
              required
              aria-invalid={!!errorMsg}
              aria-describedby={errorMsg ? 'signup-error-alert' : undefined}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{
                width: '100%',
                padding: '0.65rem 0.85rem',
                borderRadius: 'var(--radius-sm)',
                border: errorMsg ? '2px solid var(--risk-critical)' : '1px solid var(--border-default)',
                background: 'var(--bg-surface)',
                color: 'var(--text-primary)',
                fontSize: '0.9rem',
                boxSizing: 'border-box',
                minHeight: 'var(--min-target-size)',
              }}
            />
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label
              htmlFor="signup-confirm-password"
              style={{
                display: 'block',
                fontSize: '0.85rem',
                fontWeight: 600,
                color: 'var(--text-primary)',
                marginBottom: '0.4rem',
              }}
            >
              Confirm Password
            </label>
            <input
              id="signup-confirm-password"
              type="password"
              autoComplete="new-password"
              required
              aria-invalid={!!errorMsg}
              aria-describedby={errorMsg ? 'signup-error-alert' : undefined}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              style={{
                width: '100%',
                padding: '0.65rem 0.85rem',
                borderRadius: 'var(--radius-sm)',
                border: errorMsg ? '2px solid var(--risk-critical)' : '1px solid var(--border-default)',
                background: 'var(--bg-surface)',
                color: 'var(--text-primary)',
                fontSize: '0.9rem',
                boxSizing: 'border-box',
                minHeight: 'var(--min-target-size)',
              }}
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="btn-primary"
            style={{
              width: '100%',
              padding: '0.75rem',
              fontSize: '0.95rem',
              fontWeight: 700,
              minHeight: 'var(--touch-target-size)',
              marginBottom: '1rem',
            }}
          >
            {isSubmitting ? 'Registering...' : 'Complete Registration'}
          </button>
        </form>

        <div style={{ textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          Already have an account?{' '}
          <Link to="/login" style={{ color: 'var(--accent-primary)', fontWeight: 600, textDecoration: 'none' }}>
            Sign In
          </Link>
        </div>
      </div>
    </div>
  );
};
