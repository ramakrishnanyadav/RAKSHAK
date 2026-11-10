/**
 * Accessible Data Table Component.
 * Implements WCAG 2.2 AA table accessibility guidelines:
 * - Explicit <caption>
 * - Column and row headers with scope attributes
 * - Roving tabindex and aria-sort on sortable headers
 * - Risk represented by Pattern + Label + Number (NEVER color alone)
 */

import React, { useState } from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';

export interface ColumnDef<T> {
  key: string;
  header: string;
  align?: 'left' | 'center' | 'right';
  sortable?: boolean;
  render?: (row: T) => React.ReactNode;
}

interface AccessibleTableProps<T> {
  caption: string;
  summary?: string;
  columns: ColumnDef<T>[];
  data: T[];
  keyField: keyof T | ((row: T) => string);
  emptyMessage?: string;
}

export function AccessibleTable<T extends Record<string, any>>({
  caption,
  summary,
  columns,
  data,
  keyField,
  emptyMessage = 'No records available.',
}: AccessibleTableProps<T>): React.ReactElement {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const handleSort = (key: string) => {
    if (sortKey === key) {
      if (sortDirection === 'asc') setSortDirection('desc');
      else {
        setSortKey(null);
        setSortDirection('asc');
      }
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  };

  const sortedData = React.useMemo(() => {
    if (!sortKey) return data;
    return [...data].sort((a, b) => {
      const valA = a[sortKey];
      const valB = b[sortKey];
      if (valA === valB) return 0;
      if (valA == null) return 1;
      if (valB == null) return -1;
      const comp = valA < valB ? -1 : 1;
      return sortDirection === 'asc' ? comp : -comp;
    });
  }, [data, sortKey, sortDirection]);

  const getKey = (row: T, index: number): string => {
    if (typeof keyField === 'function') return keyField(row);
    return String(row[keyField] ?? index);
  };

  return (
    <div
      tabIndex={0}
      role="region"
      aria-label={`${caption} scrollable view`}
      style={{
        width: '100%',
        overflowX: 'auto',
        borderRadius: 'var(--radius-md)',
        border: '1px solid rgba(56, 189, 248, 0.2)',
        background: 'linear-gradient(180deg, rgba(16, 22, 35, 0.9) 0%, rgba(11, 15, 23, 0.95) 100%)',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.35)',
      }}
    >
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          textAlign: 'left',
          fontSize: '0.875rem',
        }}
      >
        <caption
          style={{
            textAlign: 'left',
            padding: '0.85rem 1.25rem',
            fontWeight: 800,
            fontSize: '1rem',
            color: '#f8fafc',
            borderBottom: '1px solid rgba(56, 189, 248, 0.15)',
            background: 'linear-gradient(90deg, rgba(56, 189, 248, 0.08) 0%, rgba(16, 22, 35, 0.6) 100%)',
          }}
        >
          {caption}
          {summary && (
            <span
              style={{
                display: 'block',
                fontWeight: 400,
                fontSize: '0.8rem',
                color: '#94a3b8',
                marginTop: '3px',
              }}
            >
              {summary}
            </span>
          )}
        </caption>

        <thead>
          <tr style={{ background: 'linear-gradient(135deg, rgba(16, 22, 35, 0.95), rgba(11, 15, 23, 0.98))', borderBottom: '2px solid rgba(56, 189, 248, 0.25)' }}>
            {columns.map((col, idx) => {
              const isSorted = sortKey === col.key;
              const ariaSort = isSorted ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none';

              return (
                <th
                  key={col.key || idx}
                  scope="col"
                  aria-sort={col.sortable ? ariaSort : undefined}
                  style={{
                    padding: '0.8rem 1rem',
                    fontWeight: 700,
                    fontSize: '0.78rem',
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    color: isSorted ? '#38bdf8' : '#94a3b8',
                    textAlign: col.align || 'left',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {col.sortable ? (
                    <button
                      type="button"
                      onClick={() => handleSort(col.key)}
                      style={{
                        background: isSorted ? 'rgba(56, 189, 248, 0.12)' : 'none',
                        border: isSorted ? '1px solid rgba(56, 189, 248, 0.25)' : 'none',
                        color: isSorted ? '#38bdf8' : 'inherit',
                        font: 'inherit',
                        fontWeight: 'inherit',
                        letterSpacing: 'inherit',
                        textTransform: 'inherit',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        padding: '0.25rem 0.5rem',
                        borderRadius: 'var(--radius-sm)',
                        minHeight: 'var(--min-target-size)',
                      }}
                      aria-label={`Sort by ${col.header}, currently ${ariaSort}`}
                    >
                      <span>{col.header}</span>
                      {isSorted ? (
                        sortDirection === 'asc' ? (
                          <ArrowUp size={14} color="#38bdf8" aria-hidden="true" />
                        ) : (
                          <ArrowDown size={14} color="#38bdf8" aria-hidden="true" />
                        )
                      ) : (
                        <ArrowUpDown size={14} style={{ opacity: 0.4 }} aria-hidden="true" />
                      )}
                    </button>
                  ) : (
                    col.header
                  )}
                </th>
              );
            })}
          </tr>
        </thead>

        <tbody>
          {sortedData.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                style={{
                  padding: '2rem',
                  textAlign: 'center',
                  color: 'var(--text-secondary)',
                }}
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            sortedData.map((row, rIdx) => (
              <tr
                key={getKey(row, rIdx)}
                style={{
                  borderBottom: '1px solid rgba(56, 189, 248, 0.08)',
                  background: rIdx % 2 === 0 ? 'transparent' : 'rgba(56, 189, 248, 0.02)',
                  transition: 'background 0.15s ease',
                }}
              >
                {columns.map((col, cIdx) => (
                  <td
                    key={col.key || cIdx}
                    style={{
                      padding: '0.7rem 1rem',
                      color: '#f8fafc',
                      textAlign: col.align || 'left',
                    }}
                  >
                    {col.render ? col.render(row) : String(row[col.key] ?? '—')}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

// Accessible Risk Field Badge with non-color hatching pattern, label, and numerical score
export const AccessibleRiskBadge: React.FC<{
  score: number;
  label?: string;
}> = ({ score, label }) => {
  let level = 'LOW';
  let className = 'risk-low';
  let pattern = 'pattern-hazard-dots';

  if (score >= 0.75) {
    level = 'CRITICAL';
    className = 'risk-critical';
    pattern = 'pattern-hazard-striped';
  } else if (score >= 0.5) {
    level = 'HIGH';
    className = 'risk-high';
    pattern = 'pattern-hazard-striped';
  } else if (score >= 0.25) {
    level = 'MEDIUM';
    className = 'risk-medium';
    pattern = 'pattern-hazard-dots';
  }

  const displayLabel = label || level;
  const scorePercent = (score * 100).toFixed(0);

  return (
    <span
      className={`risk-badge ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.4rem',
        padding: '0.2rem 0.55rem',
        borderRadius: 'var(--radius-sm)',
        fontSize: '0.75rem',
        fontWeight: 700,
        fontFamily: 'var(--font-mono)',
        border: '1px solid currentColor',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <span
        className={pattern}
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
        }}
      />
      <span style={{ position: 'relative', zIndex: 1 }}>
        {displayLabel} ({scorePercent}%)
      </span>
    </span>
  );
};
