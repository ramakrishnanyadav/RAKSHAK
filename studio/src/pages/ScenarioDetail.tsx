/**
 * Canonical Scenario Detail Page (Route: /app/scenarios/:id).
 * Discloses simulation geometry, road parameters, dynamic agent spawn specifications,
 * and direct launch triggers for canonical Indian road scenarios.
 */

import React from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { BENCHMARK_SCENARIOS, LEGACY_SCENARIO_COMPATIBILITY_MAP } from './Scenarios';
import { ArrowLeft, Play, Settings, ShieldCheck, MapPin, Layers, PlusCircle, AlertCircle } from 'lucide-react';
import { AccessibleTable, ColumnDef } from '../components/AccessibleTable';

interface ParamRow {
  name: string;
  type: string;
  defaultVal: string;
  range: string;
  description: string;
}

export const ScenarioDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // Resolve canonical scenario ID through compatibility mapping if historical ID is passed
  const canonicalId = (id && LEGACY_SCENARIO_COMPATIBILITY_MAP[id]) || id;
  const scenario = BENCHMARK_SCENARIOS.find((s) => s.id === canonicalId) || BENCHMARK_SCENARIOS[0];

  // Specific canonical parameter configuration from engine/scenarios/registry.py
  const parameterRows: ParamRow[] = [
    {
      name: 'target_distance_m',
      type: 'float',
      defaultVal: scenario.distance,
      range: '75.0 – 100.0 m',
      description: 'Total longitudinal road corridor length to reach scenario goal',
    },
    {
      name: 'nominal_speed_m_s',
      type: 'float',
      defaultVal: scenario.speed,
      range: '6.0 – 11.0 m/s',
      description: 'Cruising reference speed for the autonomous vehicle',
    },
    {
      name: 'road_width_m',
      type: 'float',
      defaultVal: scenario.roadWidth,
      range: '5.5 – 14.0 m',
      description: 'Total driveable surface width including unpaved dirt shoulders',
    },
    {
      name: 'curvature_max',
      type: 'float',
      defaultVal: scenario.curvature,
      range: '0.01 – 0.08 m⁻¹',
      description: 'Maximum roadway centerline curvature constraint',
    },
    {
      name: 'traffic_actors',
      type: 'list',
      defaultVal: scenario.agentMix.join(', '),
      range: '1 – 6 heterogeneous actors',
      description: 'Simultaneous dynamic actors present in the simulation environment',
    },
    {
      name: 'seed_split',
      type: 'string',
      defaultVal: scenario.split.toUpperCase(),
      range: 'tune (1000–1009), val (2000–2009), test (3000–3029)',
      description: 'Designated evaluation split under the research governance protocol',
    },
  ];

  const columns: ColumnDef<ParamRow>[] = [
    {
      key: 'name',
      header: 'Parameter',
      sortable: true,
      render: (r) => <code style={{ color: 'var(--accent-primary)', fontWeight: 700 }}>{r.name}</code>,
    },
    { key: 'type', header: 'Type' },
    { key: 'defaultVal', header: 'Nominal Value' },
    { key: 'range', header: 'Operating Range' },
    { key: 'description', header: 'Operational Description' },
  ];

  return (
    <div style={{ padding: '1.5rem', maxWidth: '1100px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Breadcrumb Navigation */}
      <div>
        <Link
          to="/app/scenarios"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            color: 'var(--text-secondary)',
            textDecoration: 'none',
            fontSize: '0.875rem',
            marginBottom: '0.5rem',
          }}
        >
          <ArrowLeft size={16} />
          <span>Back to Scenarios</span>
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.8rem',
                fontWeight: 700,
                color: 'var(--accent-primary)',
                background: 'rgba(59, 130, 246, 0.15)',
                padding: '2px 8px',
                borderRadius: '4px',
              }}
            >
              {scenario.id}
            </span>
            <h1 style={{ fontSize: '1.85rem', fontWeight: 800, margin: '0.5rem 0' }}>
              {scenario.name}
            </h1>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              onClick={() => navigate(`/app/runs/new?scenario=${scenario.id}`)}
              className="btn-primary"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.65rem 1.25rem',
              }}
            >
              <PlusCircle size={18} />
              <span>Launch New Run</span>
            </button>
            <button
              onClick={() => navigate(`/app/runs/${scenario.defaultRunId}`)}
              className="btn-secondary"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.65rem 1.25rem',
              }}
            >
              <Play size={18} />
              <span>Inspect Replay</span>
            </button>
          </div>
        </div>
      </div>

      {/* Description & Operational Dimensions */}
      <div className="glass-panel" style={{ padding: '1.5rem' }}>
        <h2 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '0.5rem' }}>
          Scenario Overview & Challenge Dimensions
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: 1.6, marginBottom: '1.25rem' }}>
          {scenario.description}
        </p>

        {/* 3 Core Dimensions: Environment, Traffic Challenge, Evaluates */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '0.65rem',
            background: 'var(--bg-surface-elevated)',
            padding: '1rem',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border-subtle)',
            marginBottom: '1.25rem',
          }}
        >
          <div>
            <strong style={{ color: 'var(--text-primary)', fontSize: '0.85rem' }}>Environment:</strong>{' '}
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{scenario.environment}</span>
          </div>
          <div>
            <strong style={{ color: 'var(--text-primary)', fontSize: '0.85rem' }}>Main Traffic Challenge:</strong>{' '}
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{scenario.trafficChallenge}</span>
          </div>
          <div>
            <strong style={{ color: 'var(--text-primary)', fontSize: '0.85rem' }}>What The Simulator Evaluates:</strong>{' '}
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{scenario.evaluates}</span>
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '1rem',
            background: 'var(--bg-surface-elevated)',
            padding: '1rem',
            borderRadius: 'var(--radius-sm)',
          }}
        >
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>SPLIT</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--accent-teal)' }}>
              {scenario.split}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>CORRIDOR SPEED</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              {scenario.speed}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>PATH LENGTH</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              {scenario.distance}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>ROAD WIDTH</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              {scenario.roadWidth}
            </div>
          </div>
        </div>
      </div>

      {/* Config Parameter Table */}
      <div className="glass-panel" style={{ padding: '1.5rem' }}>
        <h2 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '0.5rem' }}>
          Configurable Parameters & Randomization Bounds
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1rem' }}>
          Authoritative parameter bounds from the simulation engine governing stochastic agent behaviors.
        </p>

        <AccessibleTable
          caption={`Parameters specification for ${scenario.id}`}
          columns={columns}
          data={parameterRows}
          keyField="name"
        />
      </div>
    </div>
  );
};
