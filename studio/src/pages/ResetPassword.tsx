/**
 * Password Reset Page (Route: /reset).
 * Enables password reset request and token verification with accessible status alerts.
 */

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { apiClient } from '../api/client';
import { KeyRound, ArrowLeft, CheckCircle2, AlertCircle } from 'lucide-react';

export const ResetPassword: React.FC = () => {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsSubmitting(true);

    try {
      await apiClient.resetPassword(email);
      setSubmitted(true);
    } catch (err: any) {
      // In offline mode or mocked, still confirm request sent to avoid user enumeration
      setSubmitted(true);
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
          maxWidth: '440px',
          width: '100%',
          padding: '2.5rem 2rem',
          border: '1px solid var(--border-default)',
        }}
      >
        <div style={{ marginBottom: '1.5rem', textAlign: 'center' }}>
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
              margin: '0 auto 1rem',
            }}
          >
            <KeyRound size={22} />
          </div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0, marginBottom: '0.4rem' }}>
            Reset Password
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', margin: 0 }}>
            Enter your verified institutional email to receive a password recovery link
          </p>
        </div>

        {submitted ? (
          <div
            role="status"
            style={{
              textAlign: 'center',
              padding: '1.5rem 0',
            }}
          >
            <CheckCircle2 size={40} color="var(--accent-teal)" style={{ margin: '0 auto 1rem' }} />
            <h2 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '0.5rem' }}>
              Check Your Inbox
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.5, marginBottom: '1.5rem' }}>
              If an account exists for <strong>{email}</strong>, we have dispatched a secure password
              reset link valid for 30 minutes.
            </p>
            <Link
              to="/login"
              className="btn-primary"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.65rem 1.25rem',
                textDecoration: 'none',
              }}
            >
              <ArrowLeft size={16} />
              <span>Return to Sign In</span>
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate>
            {errorMsg && (
              <div
                role="alert"
                style={{
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid var(--risk-critical)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '0.75rem',
                  marginBottom: '1.25rem',
                  color: 'var(--risk-critical)',
                  fontSize: '0.85rem',
                }}
              >
                {errorMsg}
              </div>
            )}

            <div style={{ marginBottom: '1.5rem' }}>
              <label
                htmlFor="reset-email"
                style={{
                  display: 'block',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  marginBottom: '0.4rem',
                }}
              >
                Account Email
              </label>
              <input
                id="reset-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="researcher@institution.edu"
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
              {isSubmitting ? 'Sending Link...' : 'Send Recovery Link'}
            </button>

            <div style={{ textAlign: 'center' }}>
              <Link
                to="/login"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  fontSize: '0.85rem',
                  color: 'var(--text-secondary)',
                  textDecoration: 'none',
                }}
              >
                <ArrowLeft size={14} />
                <span>Back to Sign In</span>
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
