/**
 * DatasetCard - Authentic Dataset Status & Provenance Card
 * Displays: What it is, what it was used for, verified item count, licence, attribution, and status.
 */

import React, { useState } from 'react';
import { DatasetItem } from './types';
import { ExternalLink, CheckCircle2, AlertCircle, Clock, ChevronDown, ChevronUp, FileCode } from 'lucide-react';

interface DatasetCardProps {
  dataset: DatasetItem;
}

export const DatasetCard: React.FC<DatasetCardProps> = ({ dataset }) => {
  const [expanded, setExpanded] = useState(false);

  const getStatusBadge = () => {
    if (dataset.status.includes('In use')) {
      return (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.35rem',
            fontSize: '0.75rem',
            fontWeight: 700,
            background: 'rgba(45, 212, 191, 0.12)',
            color: '#2DD4BF',
            border: '1px solid rgba(45, 212, 191, 0.3)',
            padding: '0.2rem 0.55rem',
            borderRadius: '4px',
          }}
        >
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#2DD4BF' }} />
          <span>{dataset.status}</span>
        </span>
      );
    }
    if (dataset.status.includes('Adapter only')) {
      return (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.35rem',
            fontSize: '0.75rem',
            fontWeight: 700,
            background: 'rgba(245, 158, 11, 0.12)',
            color: '#FBBF24',
            border: '1px solid rgba(245, 158, 11, 0.3)',
            padding: '0.2rem 0.55rem',
            borderRadius: '4px',
          }}
        >
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#FBBF24' }} />
          <span>{dataset.status}</span>
        </span>
      );
    }
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.35rem',
          fontSize: '0.75rem',
          fontWeight: 700,
          background: 'rgba(148, 163, 184, 0.1)',
          color: '#94A3B8',
          border: '1px solid rgba(148, 163, 184, 0.25)',
          padding: '0.2rem 0.55rem',
          borderRadius: '4px',
        }}
      >
        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#94A3B8' }} />
        <span>{dataset.status}</span>
      </span>
    );
  };

  return (
    <div
      style={{
        background: '#111318',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '8px',
        padding: '1.25rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.85rem',
        position: 'relative',
      }}
    >
      {/* Top Header: Name + Status */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#FFFFFF' }}>
            {dataset.name}
          </h3>
          <a
            href={dataset.url}
            target="_blank"
            rel="noreferrer"
            style={{
              fontSize: '0.75rem',
              color: '#2DD4BF',
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.25rem',
              marginTop: '0.2rem',
            }}
          >
            <span>{dataset.url}</span>
            <ExternalLink size={11} />
          </a>
        </div>
        {getStatusBadge()}
      </div>

      {/* One-sentence summary */}
      <p style={{ margin: 0, fontSize: '0.85rem', color: '#CBD5E1', lineHeight: 1.5 }}>
        {dataset.summary}
      </p>

      {/* Used for & verified items */}
      <div
        style={{
          background: 'rgba(0, 0, 0, 0.25)',
          borderRadius: '6px',
          padding: '0.625rem 0.75rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.4rem',
          fontSize: '0.8rem',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: '#64748B' }}>Used for:</span>
          <span style={{ color: '#E2E8F0', fontWeight: 500, textAlign: 'right' }}>{dataset.used_for}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: '#64748B' }}>Verified in repo:</span>
          <span style={{ color: '#2DD4BF', fontWeight: 700, fontFamily: 'monospace' }}>
            {dataset.item_count} {dataset.unit}
          </span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: '#64748B' }}>Licence:</span>
          <span style={{ color: '#CBD5E1' }}>{dataset.licence}</span>
        </div>
      </div>

      {/* Attribution Line */}
      <div style={{ fontSize: '0.75rem', color: '#94A3B8', borderLeft: '2px solid rgba(255, 255, 255, 0.15)', paddingLeft: '0.5rem' }}>
        <strong>Attribution:</strong> {dataset.attribution}
      </div>

      {/* Expandable audit note & details */}
      <div>
        <button
          onClick={() => setExpanded(!expanded)}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#64748B',
            fontSize: '0.75rem',
            padding: 0,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.25rem',
          }}
        >
          <span>{expanded ? 'Hide audit details' : 'Show audit details & integration steps'}</span>
          {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>

        {expanded && (
          <div
            style={{
              marginTop: '0.5rem',
              padding: '0.625rem',
              borderRadius: '6px',
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid rgba(255, 255, 255, 0.06)',
              fontSize: '0.75rem',
              color: '#94A3B8',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.4rem',
            }}
          >
            <div>{dataset.audit_note}</div>

            {dataset.adapter_file && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <FileCode size={12} color="#2DD4BF" />
                <span>Adapter: <code>{dataset.adapter_file}</code></span>
              </div>
            )}

            {dataset.mapped_classes && (
              <div>
                <strong>Mapped classes:</strong> {dataset.mapped_classes.join(', ')}
              </div>
            )}

            {dataset.steps_to_add && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                <strong>Steps to add real data:</strong>
                <ol style={{ margin: 0, paddingLeft: '1.2rem', lineHeight: 1.4 }}>
                  {dataset.steps_to_add.map((st, i) => (
                    <li key={i}>{st}</li>
                  ))}
                </ol>
              </div>
            )}

            {dataset.loaded_by && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                <strong>Loaded by MATLAB assets:</strong>
                <ul style={{ margin: 0, paddingLeft: '1.2rem', lineHeight: 1.4 }}>
                  {dataset.loaded_by.slice(0, 4).map((f, i) => (
                    <li key={i}><code>{f}</code></li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

