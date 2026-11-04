/**
 * ResultsSection - Authentic Benchmark Results & Honest Reflections
 * Presents 4 headline numbers with source tags, 5-scenario grouped bar chart
 * with "Tested on" note, "Where it still struggles" honest audit, and accessible data table.
 */

import React, { useState } from 'react';
import { ShowcaseSummary } from './types';
import { TrendingUp, ShieldCheck, Sparkles, Clock, AlertTriangle, Table, BarChart3, FileText } from 'lucide-react';

interface ResultsSectionProps {
  summary: ShowcaseSummary | null;
}

export const ResultsSection: React.FC<ResultsSectionProps> = ({ summary }) => {
  const [showTable, setShowTable] = useState(false);

  if (!summary) {
    return (
      <div style={{ padding: '3rem', textAlign: 'center', color: '#64748B' }}>
        Loading benchmark validation data...
      </div>
    );
  }

  const { headline_metrics, scenarios, weak_spot_analysis, metadata } = summary;

  return (
    <section id="results" style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
      {/* Section Header */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <span
            style={{
              fontSize: '0.75rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: '#2DD4BF',
              background: 'rgba(45, 212, 191, 0.1)',
              padding: '0.2rem 0.5rem',
              borderRadius: '4px',
            }}
          >
            Empirical Results
          </span>
          <span style={{ fontSize: '0.8rem', color: '#64748B' }}>
            {metadata.provenance} • {metadata.total_episodes_per_planner} episodes per planner
          </span>
          <span
            style={{
              fontSize: '0.7rem',
              color: '#2DD4BF',
              background: 'rgba(45, 212, 191, 0.08)',
              padding: '0.1rem 0.4rem',
              borderRadius: '4px',
              fontFamily: 'monospace',
            }}
            title="Authoritative benchmark manifest"
          >
            source: {metadata.source_file}
          </span>
        </div>
        <h2 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#FFFFFF', margin: 0 }}>
          Measured performance over 25 validation episodes
        </h2>
        <p style={{ color: '#94A3B8', fontSize: '0.95rem', maxWidth: '680px', lineHeight: 1.5, margin: 0 }}>
          Tested across 5 canonical unstructured Indian road scenarios under randomized seeds (2005–2009).
          Every number is traceable to the source manifest.
        </p>
      </div>

      {/* Row of 4 Headline Metrics with Source Tags */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '1rem',
        }}
      >
        {/* Metric 1: Completion */}
        <div
          style={{
            background: '#111318',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '8px',
            padding: '1.25rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.8rem', color: '#94A3B8' }}>{headline_metrics.completion_rate.label}</span>
            <TrendingUp size={16} color="#2DD4BF" />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
            <span style={{ fontSize: '2rem', fontWeight: 800, color: '#FFFFFF', fontFamily: 'monospace' }}>
              {headline_metrics.completion_rate.adaptive}%
            </span>
            <span style={{ fontSize: '0.85rem', color: '#64748B' }}>vs {headline_metrics.completion_rate.standard}% standard</span>
          </div>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#2DD4BF' }}>
            {headline_metrics.completion_rate.delta_label}
          </div>
          <span style={{ fontSize: '0.675rem', color: '#64748B', fontFamily: 'monospace', marginTop: 'auto' }}>
            source: {headline_metrics.completion_rate.source_file}
          </span>
        </div>

        {/* Metric 2: Crash Rate */}
        <div
          style={{
            background: '#111318',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '8px',
            padding: '1.25rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.8rem', color: '#94A3B8' }}>{headline_metrics.collision_rate.label}</span>
            <ShieldCheck size={16} color="#2DD4BF" />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
            <span style={{ fontSize: '2rem', fontWeight: 800, color: '#FFFFFF', fontFamily: 'monospace' }}>
              {headline_metrics.collision_rate.adaptive}%
            </span>
            <span style={{ fontSize: '0.85rem', color: '#64748B' }}>vs {headline_metrics.collision_rate.standard}% standard</span>
          </div>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#2DD4BF' }}>
            {headline_metrics.collision_rate.delta_label}
          </div>
          <span style={{ fontSize: '0.675rem', color: '#64748B', fontFamily: 'monospace', marginTop: 'auto' }}>
            source: {headline_metrics.collision_rate.source_file}
          </span>
        </div>

        {/* Metric 3: Smoothness (Jerk) */}
        <div
          style={{
            background: '#111318',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '8px',
            padding: '1.25rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.8rem', color: '#94A3B8' }}>{headline_metrics.smoothness_jerk.label}</span>
            <Sparkles size={16} color="#2DD4BF" />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
            <span style={{ fontSize: '2rem', fontWeight: 800, color: '#FFFFFF', fontFamily: 'monospace' }}>
              {headline_metrics.smoothness_jerk.adaptive}
            </span>
            <span style={{ fontSize: '0.85rem', color: '#64748B' }}>vs {headline_metrics.smoothness_jerk.standard} m/s³</span>
          </div>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#2DD4BF' }}>
            {headline_metrics.smoothness_jerk.delta_label}
          </div>
          <span style={{ fontSize: '0.675rem', color: '#64748B', fontFamily: 'monospace', marginTop: 'auto' }}>
            source: {headline_metrics.smoothness_jerk.source_file}
          </span>
        </div>

        {/* Metric 4: Think Time */}
        <div
          style={{
            background: '#111318',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '8px',
            padding: '1.25rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.8rem', color: '#94A3B8' }}>{headline_metrics.think_time_ms.label}</span>
            <Clock size={16} color="#2DD4BF" />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
            <span style={{ fontSize: '2rem', fontWeight: 800, color: '#FFFFFF', fontFamily: 'monospace' }}>
              {headline_metrics.think_time_ms.adaptive}
            </span>
            <span style={{ fontSize: '0.85rem', color: '#64748B' }}>vs {headline_metrics.think_time_ms.standard} ms</span>
          </div>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#2DD4BF' }}>
            {headline_metrics.think_time_ms.delta_label}
          </div>
          <span style={{ fontSize: '0.675rem', color: '#64748B', fontFamily: 'monospace', marginTop: 'auto' }}>
            source: {headline_metrics.think_time_ms.source_file}
          </span>
        </div>
      </div>

      {/* 5-Scenario Comparison Breakdown */}
      <div
        style={{
          background: '#111318',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '8px',
          padding: '1.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.25rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#FFFFFF', margin: 0 }}>
              Scenario completion breakdown
            </h3>
            <p style={{ fontSize: '0.825rem', color: '#94A3B8', margin: '0.25rem 0 0' }}>
              Comparison of goal completion rates across all 5 canonical test road scenarios.
            </p>
            <div style={{ fontSize: '0.75rem', color: '#64748B', marginTop: '0.25rem' }}>
              <strong>Tested on:</strong> Validation B Split (Seeds 2005–2009, 25 episodes per planner)
            </div>
          </div>

          <button
            onClick={() => setShowTable(!showTable)}
            style={{
              background: 'transparent',
              color: '#CBD5E1',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: '6px',
              padding: '0.4rem 0.75rem',
              fontSize: '0.8rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              cursor: 'pointer',
            }}
          >
            {showTable ? <BarChart3 size={14} /> : <Table size={14} />}
            <span>{showTable ? 'View Chart' : 'View Accessible Table'}</span>
          </button>
        </div>

        {/* Visual Bar Chart */}
        {!showTable ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', paddingTop: '0.5rem' }}>
            {scenarios.map((sc) => (
              <div key={sc.key} style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.825rem' }}>
                  <span style={{ color: '#E2E8F0', fontWeight: 600 }}>
                    {sc.name}
                    {sc.flagship && <span style={{ color: '#2DD4BF', marginLeft: '0.5rem' }}>★ Flagship</span>}
                    {sc.is_weak_spot && <span style={{ color: '#FBBF24', marginLeft: '0.5rem' }}>⚠ Hard Case</span>}
                  </span>
                  <span style={{ color: '#94A3B8', fontFamily: 'monospace' }}>
                    P3: <strong style={{ color: '#2DD4BF' }}>{sc.adaptive.completion_rate}%</strong> vs Standard:{' '}
                    <strong style={{ color: '#94A3B8' }}>{sc.standard.completion_rate}%</strong>
                  </span>
                </div>

                {/* Paired bar */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  {/* Adaptive bar */}
                  <div style={{ height: '7px', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '3px', overflow: 'hidden' }}>
                    <div
                      style={{
                        height: '100%',
                        width: `${sc.adaptive.completion_rate}%`,
                        background: '#2DD4BF',
                        borderRadius: '3px',
                        transition: 'width 0.4s ease',
                      }}
                    />
                  </div>
                  {/* Standard bar */}
                  <div style={{ height: '7px', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '3px', overflow: 'hidden' }}>
                    <div
                      style={{
                        height: '100%',
                        width: `${sc.standard.completion_rate}%`,
                        background: '#64748B',
                        borderRadius: '3px',
                        transition: 'width 0.4s ease',
                      }}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: '#64748B' }}>
                  <span>{sc.built_from}</span>
                  <span style={{ fontFamily: 'monospace' }}>source: {sc.source_file}</span>
                </div>
              </div>
            ))}

            <div style={{ display: 'flex', gap: '1.25rem', marginTop: '0.5rem', fontSize: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span style={{ width: '10px', height: '6px', background: '#2DD4BF', borderRadius: '2px' }} />
                <span style={{ color: '#CBD5E1' }}>ADAPTIVE-PATH P3</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span style={{ width: '10px', height: '6px', background: '#64748B', borderRadius: '2px' }} />
                <span style={{ color: '#94A3B8' }}>Standard planner (B1: DWA + velocity obstacles)</span>
              </div>
            </div>
          </div>
        ) : (
          /* Accessible Data Table */
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.825rem', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.1)', color: '#94A3B8' }}>
                  <th style={{ padding: '0.5rem' }}>Scenario</th>
                  <th style={{ padding: '0.5rem' }}>Built From</th>
                  <th style={{ padding: '0.5rem' }}>P3 Completion</th>
                  <th style={{ padding: '0.5rem' }}>Standard Completion</th>
                  <th style={{ padding: '0.5rem' }}>P3 Crash Rate</th>
                  <th style={{ padding: '0.5rem' }}>Standard Crash</th>
                  <th style={{ padding: '0.5rem' }}>P3 Jerk</th>
                  <th style={{ padding: '0.5rem' }}>Source</th>
                </tr>
              </thead>
              <tbody>
                {scenarios.map((sc) => (
                  <tr key={sc.key} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.04)' }}>
                    <td style={{ padding: '0.6rem 0.5rem', color: '#FFFFFF', fontWeight: 500 }}>{sc.name}</td>
                    <td style={{ padding: '0.6rem 0.5rem', color: '#94A3B8', fontSize: '0.75rem' }}>{sc.built_from}</td>
                    <td style={{ padding: '0.6rem 0.5rem', color: '#2DD4BF', fontFamily: 'monospace' }}>
                      {sc.adaptive.completion_rate}%
                    </td>
                    <td style={{ padding: '0.6rem 0.5rem', color: '#94A3B8', fontFamily: 'monospace' }}>
                      {sc.standard.completion_rate}%
                    </td>
                    <td style={{ padding: '0.6rem 0.5rem', color: sc.adaptive.collision_rate > 0 ? '#F87171' : '#2DD4BF', fontFamily: 'monospace' }}>
                      {sc.adaptive.collision_rate}%
                    </td>
                    <td style={{ padding: '0.6rem 0.5rem', color: '#F87171', fontFamily: 'monospace' }}>
                      {sc.standard.collision_rate}%
                    </td>
                    <td style={{ padding: '0.6rem 0.5rem', color: '#CBD5E1', fontFamily: 'monospace' }}>
                      {sc.adaptive.jerk_m_s3} m/s³
                    </td>
                    <td style={{ padding: '0.6rem 0.5rem', color: '#64748B', fontFamily: 'monospace', fontSize: '0.7rem' }}>
                      {sc.source_file}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Honest "Where it still struggles" Callout */}
      <div
        style={{
          background: 'rgba(245, 158, 11, 0.06)',
          border: '1px solid rgba(245, 158, 11, 0.25)',
          borderRadius: '8px',
          padding: '1.25rem 1.5rem',
          display: 'flex',
          gap: '1rem',
          alignItems: 'flex-start',
        }}
      >
        <div style={{ color: '#FBBF24', paddingTop: '0.15rem' }}>
          <AlertTriangle size={20} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
            <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#FBBF24' }}>
              Where it still struggles: {weak_spot_analysis.scenario}
            </h4>
            <span style={{ fontSize: '0.7rem', color: '#FBBF24', fontFamily: 'monospace' }}>
              source: {weak_spot_analysis.source_file}
            </span>
          </div>
          <p style={{ margin: 0, fontSize: '0.85rem', color: '#CBD5E1', lineHeight: 1.5 }}>
            {weak_spot_analysis.why}
          </p>
          <div style={{ fontSize: '0.8rem', color: '#94A3B8', marginTop: '0.25rem' }}>
            <strong>Future work:</strong> {weak_spot_analysis.future_work}
          </div>
        </div>
      </div>
    </section>
  );
};

// Aliases for component requirements
export const ResultsRow = ResultsSection;
export const ScenarioBars = ResultsSection;
