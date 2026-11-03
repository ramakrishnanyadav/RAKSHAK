/**
 * Accessible Chart / Data-Table Toggle Component.
 * Enables blind and keyboard users to switch any telemetry visualization
 * into a structured, semantic HTML table.
 * Fulfills WCAG 2.2 AA hard requirement.
 */

import React from 'react';
import { Table, LineChart } from 'lucide-react';
import { useI18n } from '../context/I18nContext';

interface DataTableToggleProps {
  isTableView: boolean;
  onToggle: (showTable: boolean) => void;
  id?: string;
  label?: string;
}

export const DataTableToggle: React.FC<DataTableToggleProps> = ({
  isTableView,
  onToggle,
  id = 'data-table-toggle',
  label = 'View mode',
}) => {
  const { t } = useI18n();

  return (
    <div
      role="group"
      aria-labelledby={`${id}-label`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        background: 'var(--bg-surface-elevated)',
        border: '1px solid var(--border-default)',
        borderRadius: 'var(--radius-md)',
        padding: '2px',
        gap: '2px',
      }}
    >
      <span id={`${id}-label`} className="sr-only">
        {label}
      </span>

      <button
        type="button"
        onClick={() => onToggle(false)}
        aria-pressed={!isTableView}
        aria-label={t('visual_view')}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.4rem',
          padding: '0.35rem 0.65rem',
          fontSize: '0.8rem',
          fontWeight: 600,
          border: 'none',
          borderRadius: 'var(--radius-sm)',
          cursor: 'pointer',
          background: !isTableView ? 'var(--accent-primary)' : 'transparent',
          color: !isTableView ? '#ffffff' : 'var(--text-secondary)',
          minHeight: 'var(--min-target-size)',
          minWidth: 'var(--min-target-size)',
        }}
      >
        <LineChart size={14} aria-hidden="true" />
        <span>{t('visual_view')}</span>
      </button>

      <button
        type="button"
        onClick={() => onToggle(true)}
        aria-pressed={isTableView}
        aria-label={t('accessible_view')}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.4rem',
          padding: '0.35rem 0.65rem',
          fontSize: '0.8rem',
          fontWeight: 600,
          border: 'none',
          borderRadius: 'var(--radius-sm)',
          cursor: 'pointer',
          background: isTableView ? 'var(--accent-primary)' : 'transparent',
          color: isTableView ? '#ffffff' : 'var(--text-secondary)',
          minHeight: 'var(--min-target-size)',
          minWidth: 'var(--min-target-size)',
        }}
      >
        <Table size={14} aria-hidden="true" />
        <span>{t('accessible_view')}</span>
      </button>
    </div>
  );
};
