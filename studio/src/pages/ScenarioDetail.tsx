/**
 * Scenario Detail Page (Route: /app/scenarios/:id).
 * Discloses full simulation geometry, curvature distribution, agent spawn rules,
 * seed variation parameters, and direct simulation launch trigger.
 */

import React from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { BENCHMARK_SCENARIOS } from './Scenarios';
import { ArrowLeft, Play, Settings, ShieldCheck, MapPin, Layers, PlusCircle } from 'lucide-react';
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

  const scenario = BENCHMARK_SCENARIOS.find((s) => s.id === id) || BENCHMARK_SCENARIOS[0];

  const parameterRows: ParamRow[] = [
    { name: 'road_curvature_max', type: 'float', defaultVal: '0.08 m⁻¹', range: '[0.0, 0.15]', description: 'Maximum road curvature for G2 clothoid corridor' },
    { name: 'shoulder_width_unpaved', type: 'float', defaultVal: '1.8 m', range: '[0.5, 3.0]', description: 'Driveable unpaved dirt shoulder width' },
    { name: 'traffic_density_agents', type: 'int', defaultVal: '14', range: '[4, 60]', description: 'Number of simultaneous dynamic traffic actors' },
    { name: 'conformal_coverage_alpha', type: 'float', defaultVal: '0.05', range: '[0.01, 0.10]', description: 'Miscoverage rate guaranteeing 95% safety bound' },
    { name: 'pothole_depth_meters', type: 'float', defaultVal: '0.18 m', range: '[0.05, 0.30]', description: 'Depth of road defect obstacle triggering risk gradient' },
    { name: 'random_seed', type: 'int', defaultVal: '1000', range: '[1000, 9999]', description: 'Monte Carlo seed for stochastic agent behavior' },
  ];

  const columns: ColumnDef<ParamRow>[] = [
    { key: 'name', header: 'Parameter', sortable: true, render: (r) => <code style={{ color: 'var(--accent-primary)', fontWeight: 700 }}>{r.name}</code> },
    { key: 'type', header: 'Type' },
    { key: 'defaultVal', header: 'Nominal Value' },
    { key: 'range', header: 'Allowed Range' },
    { key: 'description', header: 'Physical Description' },
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

      {/* Description & Physical Specs */}
      <div className="glass-panel" style={{ padding: '1.5rem' }}>
        <h2 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '0.5rem' }}>
          Scenario Architecture & Operational Environment
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: 1.6, marginBottom: '1.25rem' }}>
          {scenario.description}
        </p>

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
          These parameters control the stochastic scenario generation across training and test seeds.
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
