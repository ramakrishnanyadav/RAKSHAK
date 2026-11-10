/**
 * Status and State Indicators for ADAPTIVE-PATH Studio.
 * Provides accessible Skeleton, Empty, Error, and Offline states.
 * Fulfills WCAG 2.2 AA requirement for predictable content updates and clear error recovery.
 */

import React from 'react';
import { AlertCircle, RefreshCw, FolderOpen, WifiOff } from 'lucide-react';
import { useI18n } from '../context/I18nContext';

// Skeleton Loader with reduced-motion awareness
export const SkeletonLoader: React.FC<{
  height?: string;
  width?: string;
  className?: string;
  label?: string;
}> = ({ height = '1rem', width = '100%', className = '', label = 'Loading content...' }) => (
  <div
    role="status"
    aria-label={label}
    className={`skeleton-pulse ${className}`}
    style={{
      height,
      width,
      backgroundColor: 'rgba(56, 189, 248, 0.08)',
      borderRadius: 'var(--radius-sm)',
      border: '1px solid rgba(56, 189, 248, 0.12)',
    }}
  >
    <span className="sr-only">{label}</span>
  </div>
);

export const SkeletonCard: React.FC = () => (
  <div
    className="glass-panel"
    style={{
      padding: '1.25rem',
      display: 'flex',
      flexDirection: 'column',
      gap: '0.75rem',
      position: 'relative',
      overflow: 'hidden',
    }}
    role="status"
    aria-label="Loading card"
  >
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: 'linear-gradient(90deg, #38bdf8, #818cf8)' }} />
    <SkeletonLoader height="1.5rem" width="60%" />
    <SkeletonLoader height="1rem" width="90%" />
    <SkeletonLoader height="1rem" width="40%" />
    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
      <SkeletonLoader height="2rem" width="5rem" />
      <SkeletonLoader height="2rem" width="5rem" />
    </div>
  </div>
);

export const SkeletonTable: React.FC<{ rows?: number; cols?: number }> = ({
  rows = 5,
  cols = 6,
}) => (
  <div
    role="status"
    aria-label="Loading table data"
    style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '100%' }}
  >
    <div style={{ display: 'flex', gap: '1rem', padding: '0.5rem 0' }}>
      {Array.from({ length: cols }).map((_, i) => (
        <SkeletonLoader key={i} height="1.5rem" width={`${100 / cols}%`} />
      ))}
    </div>
    {Array.from({ length: rows }).map((_, r) => (
      <div key={r} style={{ display: 'flex', gap: '1rem', padding: '0.5rem 0' }}>
        {Array.from({ length: cols }).map((_, c) => (
          <SkeletonLoader key={c} height="1.25rem" width={`${100 / cols}%`} />
        ))}
      </div>
    ))}
  </div>
);

// Empty State Card
export const EmptyState: React.FC<{
  title: string;
  description: string;
  actionText?: string;
  onAction?: () => void;
}> = ({ title, description, actionText, onAction }) => (
  <div
    role="region"
    aria-label={title}
    className="glass-panel"
    style={{
      padding: '3rem 1.5rem',
      textAlign: 'center',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '0.75rem',
      margin: '1.5rem 0',
      background: 'linear-gradient(135deg, rgba(16, 22, 35, 0.7) 0%, rgba(11, 15, 23, 0.85) 100%)',
      border: '1px solid rgba(56, 189, 248, 0.16)',
    }}
  >
    <div
      style={{
        width: '52px',
        height: '52px',
        borderRadius: '50%',
        background: 'rgba(56, 189, 248, 0.1)',
        border: '1px solid rgba(56, 189, 248, 0.25)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#38bdf8',
        boxShadow: '0 0 20px rgba(56, 189, 248, 0.15)',
      }}
    >
      <FolderOpen size={24} />
    </div>
    <h3 style={{
      margin: 0,
      fontSize: '1.2rem',
      fontWeight: 800,
      background: 'linear-gradient(135deg, #f8fafc 0%, #94a3b8 100%)',
      WebkitBackgroundClip: 'text',
      WebkitTextFillColor: 'transparent',
    }}>{title}</h3>
    <p style={{ margin: 0, maxWidth: '450px', color: '#94a3b8', fontSize: '0.9rem', lineHeight: 1.5 }}>
      {description}
    </p>
    {actionText && onAction && (
      <button
        onClick={onAction}
        className="btn-primary"
        style={{ marginTop: '0.75rem', minHeight: 'var(--min-target-size)' }}
      >
        {actionText}
      </button>
    )}
  </div>
);

// Error State Card with Retry
export const ErrorState: React.FC<{
  title?: string;
  message: string;
  onRetry?: () => void;
}> = ({ title = 'Failed to load data', message, onRetry }) => (
  <div
    role="alert"
    className="glass-panel"
    style={{
      padding: '2rem 1.5rem',
      position: 'relative',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      gap: '0.75rem',
      margin: '1.5rem 0',
      background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.08) 0%, rgba(16, 22, 35, 0.8) 100%)',
      border: '1px solid rgba(239, 68, 68, 0.3)',
    }}
  >
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: 'linear-gradient(90deg, #ef4444, #f87171)' }} />
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
      <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'rgba(239, 68, 68, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <AlertCircle size={20} color="#f87171" />
      </div>
      <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#f87171' }}>{title}</h3>
    </div>
    <p style={{ margin: 0, color: '#cbd5e1', fontSize: '0.9rem' }}>{message}</p>
    {onRetry && (
      <div>
        <button
          onClick={onRetry}
          className="btn-secondary"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            marginTop: '0.5rem',
            minHeight: 'var(--min-target-size)',
          }}
        >
          <RefreshCw size={15} />
          <span>Retry Request</span>
        </button>
      </div>
    )}
  </div>
);

// Offline Notice Banner
export const OfflineBanner: React.FC<{ isOffline: boolean; runCount?: number }> = ({
  isOffline,
  runCount = 14,
}) => {
  const { t } = useI18n();

  if (!isOffline) return null;

  return (
    <div
      role="status"
      style={{
        background: 'linear-gradient(90deg, rgba(245, 158, 11, 0.15) 0%, rgba(16, 22, 35, 0.95) 100%)',
        borderBottom: '1px solid rgba(245, 158, 11, 0.3)',
        color: '#fbbf24',
        padding: '0.5rem 1.25rem',
        fontSize: '0.85rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '0.5rem',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
        <WifiOff size={16} color="#fbbf24" />
        <span>
          <strong style={{ color: '#fef08a' }}>Offline Mode:</strong> Studio is currently disconnected from the live worker.
          Browsing {runCount} verified pre-bundled SIH2026 runs.
        </span>
      </div>
      <span
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '0.72rem',
          fontWeight: 700,
          background: 'rgba(245, 158, 11, 0.2)',
          color: '#fbbf24',
          border: '1px solid rgba(245, 158, 11, 0.35)',
          padding: '2px 8px',
          borderRadius: '4px',
          letterSpacing: '0.05em',
        }}
      >
        STANDALONE CLIENT
      </span>
    </div>
  );
};
