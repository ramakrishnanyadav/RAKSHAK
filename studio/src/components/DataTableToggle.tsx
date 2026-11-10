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
        background: 'rgba(16, 22, 35, 0.85)',
        border: '1px solid rgba(56, 189, 248, 0.22)',
        borderRadius: 'var(--radius-md)',
        padding: '3px',
        gap: '3px',
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
          padding: '0.35rem 0.75rem',
          fontSize: '0.8rem',
          fontWeight: 700,
          border: 'none',
          borderRadius: 'var(--radius-sm)',
          cursor: 'pointer',
          background: !isTableView ? 'linear-gradient(135deg, #0ea5e9, #38bdf8)' : 'transparent',
          color: !isTableView ? '#07080a' : '#94a3b8',
          boxShadow: !isTableView ? '0 2px 8px rgba(14, 165, 233, 0.3)' : 'none',
          minHeight: 'var(--min-target-size)',
          minWidth: 'var(--min-target-size)',
          transition: 'all 0.15s ease',
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
          padding: '0.35rem 0.75rem',
          fontSize: '0.8rem',
          fontWeight: 700,
          border: 'none',
          borderRadius: 'var(--radius-sm)',
          cursor: 'pointer',
          background: isTableView ? 'linear-gradient(135deg, #0ea5e9, #38bdf8)' : 'transparent',
          color: isTableView ? '#07080a' : '#94a3b8',
          boxShadow: isTableView ? '0 2px 8px rgba(14, 165, 233, 0.3)' : 'none',
          minHeight: 'var(--min-target-size)',
          minWidth: 'var(--min-target-size)',
          transition: 'all 0.15s ease',
        }}
      >
        <Table size={14} aria-hidden="true" />
        <span>{t('accessible_view')}</span>
      </button>
    </div>
  );
};
