/**
 * Accessible Sign-In Page (Route: /login).
 * Supports standard credential auth, guest mode bypass, error alerts,
 * and WCAG 2.2 AA form accessibility.
 */

import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../context/I18nContext';
import { LogIn, Eye, EyeOff, AlertCircle, ArrowLeft, PlayCircle } from 'lucide-react';

export const Login: React.FC = () => {
  const { login, guestLogin } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsSubmitting(true);

    try {
      await login(email, password);
      navigate('/app');
    } catch (err: any) {
      setErrorMsg(err.message || 'Invalid email or password. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGuestEnter = () => {
    guestLogin();
    navigate('/app');
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem',
        background: '#07080a',
        backgroundImage: 'radial-gradient(circle at 50% 20%, rgba(56, 189, 248, 0.08) 0%, transparent 70%)',
      }}
    >
      <div
        className="glass-panel"
        style={{
          maxWidth: '440px',
          width: '100%',
          padding: '2.5rem 2rem',
          border: '1px solid rgba(56, 189, 248, 0.22)',
          background: 'linear-gradient(135deg, rgba(16, 22, 35, 0.9) 0%, rgba(11, 15, 23, 0.95) 100%)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5), 0 0 25px rgba(56, 189, 248, 0.1)',
        }}
      >
        <div style={{ marginBottom: '1.5rem', textAlign: 'center' }}>
          <div
            style={{
              width: '46px',
              height: '46px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #0ea5e9, #38bdf8)',
              color: '#07080a',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1rem',
              fontWeight: 900,
              fontSize: '1.3rem',
              boxShadow: '0 4px 15px rgba(14, 165, 233, 0.35)',
            }}
          >
            A
          </div>
          <h1 style={{
            fontSize: '1.6rem',
            fontWeight: 900,
            margin: 0,
            marginBottom: '0.4rem',
            background: 'linear-gradient(135deg, #f8fafc 0%, #94a3b8 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}>
            Sign in to Studio
          </h1>
          <p style={{ color: '#94a3b8', fontSize: '0.875rem', margin: 0 }}>
            Smart India Hackathon 2026 Simulation Platform
          </p>
        </div>

        {errorMsg && (
          <div
            id="login-error-alert"
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
          <div style={{ marginBottom: '1.25rem' }}>
            <label
              htmlFor="login-email"
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
              id="login-email"
              type="email"
              autoComplete="email"
              required
              aria-invalid={!!errorMsg}
              aria-describedby={errorMsg ? 'login-error-alert' : undefined}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="researcher@institution.edu"
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

          <div style={{ marginBottom: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
              <label
                htmlFor="login-password"
                style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}
              >
                Password
              </label>
              <Link
                to="/reset"
                style={{ fontSize: '0.8rem', color: 'var(--accent-primary)', textDecoration: 'none' }}
              >
                Forgot password?
              </Link>
            </div>
            <div style={{ position: 'relative' }}>
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                required
                aria-invalid={!!errorMsg}
                aria-describedby={errorMsg ? 'login-error-alert' : undefined}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.65rem 2.5rem 0.65rem 0.85rem',
                  borderRadius: 'var(--radius-sm)',
                  border: errorMsg ? '2px solid var(--risk-critical)' : '1px solid var(--border-default)',
                  background: 'var(--bg-surface)',
                  color: 'var(--text-primary)',
                  fontSize: '0.9rem',
                  boxSizing: 'border-box',
                  minHeight: 'var(--min-target-size)',
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                style={{
                  position: 'absolute',
                  right: '0.65rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  padding: '4px',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
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
            {isSubmitting ? 'Authenticating...' : 'Sign In'}
          </button>
        </form>

        <div
          style={{
            position: 'relative',
            textAlign: 'center',
            margin: '1.25rem 0',
            borderBottom: '1px solid var(--border-subtle)',
          }}
        >
          <span
            style={{
              position: 'relative',
              top: '9px',
              background: 'var(--bg-surface-elevated)',
              padding: '0 0.75rem',
              fontSize: '0.75rem',
              color: 'var(--text-secondary)',
              textTransform: 'uppercase',
            }}
          >
            Or
          </span>
        </div>

        <button
          type="button"
          onClick={handleGuestEnter}
          className="btn-secondary"
          style={{
            width: '100%',
            padding: '0.7rem',
            fontSize: '0.9rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
            minHeight: 'var(--touch-target-size)',
            marginBottom: '1.5rem',
          }}
        >
          <PlayCircle size={18} />
          <span>Continue as Guest (Demo Mode)</span>
        </button>

        <div style={{ textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          Don't have an account?{' '}
          <Link
            to="/signup"
            style={{ color: 'var(--accent-primary)', fontWeight: 600, textDecoration: 'none' }}
          >
            Create an account
          </Link>
        </div>
      </div>
    </div>
  );
};
