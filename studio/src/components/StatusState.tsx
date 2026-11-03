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
      backgroundColor: 'var(--border-default)',
      borderRadius: 'var(--radius-sm)',
      opacity: 0.5,
    }}
  >
    <span className="sr-only">{label}</span>
  </div>
);

export const SkeletonCard: React.FC = () => (
  <div
    className="glass-panel"
    style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}
    role="status"
    aria-label="Loading card"
  >
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
    }}
  >
    <div
      style={{
        width: '48px',
        height: '48px',
        borderRadius: '50%',
        background: 'var(--bg-surface-elevated)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--text-secondary)',
      }}
    >
      <FolderOpen size={24} />
    </div>
    <h3 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--text-primary)' }}>{title}</h3>
    <p style={{ margin: 0, maxWidth: '450px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
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
      borderLeft: '4px solid var(--risk-critical)',
      display: 'flex',
      flexDirection: 'column',
      gap: '0.75rem',
      margin: '1.5rem 0',
    }}
  >
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
      <AlertCircle size={22} color="var(--risk-critical)" />
      <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-primary)' }}>{title}</h3>
    </div>
    <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{message}</p>
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
        background: 'rgba(245, 158, 11, 0.12)',
        borderBottom: '1px solid rgba(245, 158, 11, 0.3)',
        color: 'var(--risk-medium)',
        padding: '0.5rem 1rem',
        fontSize: '0.85rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '0.5rem',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <WifiOff size={16} />
        <span>
          <strong>Offline Mode:</strong> Studio is currently disconnected from the live worker.
          Browsing {runCount} verified pre-bundled SIH2026 runs.
        </span>
      </div>
      <span
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '0.75rem',
          background: 'rgba(245, 158, 11, 0.2)',
          padding: '2px 8px',
          borderRadius: '4px',
        }}
      >
        STANDALONE CLIENT
      </span>
    </div>
  );
};
