/**
 * Scenarios Catalog Page (Route: /app/scenarios).
 * Displays the 6 benchmark scenarios for unstructured Indian roads (SIH2026),
 * split filtering (Train, Val, Test), and navigation to scenario detail.
 */

import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { MapPin, Navigation, Compass, AlertCircle, Play, Eye, ArrowRight, Filter } from 'lucide-react';
import { useI18n } from '../context/I18nContext';

export interface ScenarioDefinition {
  id: string;
  name: string;
  description: string;
  speed: string;
  distance: string;
  split: 'train' | 'val' | 'test';
  agentMix: string[];
  keyChallenge: string;
  roadWidth: string;
  curvature: string;
  defaultRunId: string;
}

export const BENCHMARK_SCENARIOS: ScenarioDefinition[] = [
  {
    id: 'SCENARIO_1_UNSTRUCTURED_ROUNDABOUT',
    name: '1. Unstructured Multi-Modal Roundabout',
    description: 'Chaotic circular intersection without lane discipline, with crisscrossing auto-rickshaws, two-wheelers, and pedestrians entering radially.',
    speed: '25 km/h (7.0 m/s)',
    distance: '75 meters',
    split: 'train',
    roadWidth: '12.0m outer diameter',
    curvature: 'κ = 0.08 m⁻¹',
    agentMix: ['Auto-Rickshaw (Cross)', 'Two-Wheeler (Swerving)', 'Pedestrian'],
    keyChallenge: 'Multi-hypothesis intent estimation to anticipate opportunistic gap-filling without right-of-way assumptions.',
    defaultRunId: 'run_scenario_1_village_road_p3_tune_s1000',
  },
  {
    id: 'SCENARIO_2_WRONG_WAY_AUTO',
    name: '2. Wrong-Way Auto-Rickshaw Encounter',
    description: 'High-speed rural corridor where an oncoming auto-rickshaw drives against traffic to avoid a flooded road section.',
    speed: '35 km/h (9.7 m/s)',
    distance: '90 meters',
    split: 'val',
    roadWidth: '7.5m (unmarked)',
    curvature: 'κ = 0.01 m⁻¹',
    agentMix: ['Wrong-way Auto', 'Bicycle on shoulder'],
    keyChallenge: 'Emergency corridor shift into unpaved shoulder without loss of lateral stability or yaw divergence.',
    defaultRunId: 'run_scenario_2_urban_intersection_p3_tune_s1000',
  },
  {
    id: 'SCENARIO_3_MONSOON_POTHOLE',
    name: '3. Monsoon Flooded Pothole Swerve',
    description: 'Waterlogged single-lane road with a deep submerged pothole forcing vehicle to perform a continuous G2 clothoid swerve.',
    speed: '30 km/h (8.3 m/s)',
    distance: '85 meters',
    split: 'test',
    roadWidth: '6.5m (pothole depth 18cm)',
    curvature: 'κ = 0.04 m⁻¹',
    agentMix: ['Pothole Hazard', 'Oncoming Two-Wheeler'],
    keyChallenge: 'Static cost field ridge avoidance coupled with dynamic oncoming agent clearance.',
    defaultRunId: 'run_scenario_3_highway_merge_p3_tune_s1000',
  },
  {
    id: 'SCENARIO_4_MIXED_CROWD',
    name: '4. Dense Market Street with Mixed Crowd',
    description: 'High-density market lane with pedestrian clusters, fruit carts, and sudden emergence from behind stationary parked autos.',
    speed: '20 km/h (5.5 m/s)',
    distance: '70 meters',
    split: 'train',
    roadWidth: '5.5m (constricted)',
    curvature: 'κ = 0.02 m⁻¹',
    agentMix: ['Fruit Handcart', 'Pedestrians', 'Parked Auto'],
    keyChallenge: 'Severe sensor occlusion handling and Minimal-Risk Manoeuvre (MRM) fallback.',
    defaultRunId: 'run_scenario_4_dense_market_p3_tune_s1000',
  },
  {
    id: 'SCENARIO_5_CATTLE_CROSSING',
    name: '5. Flagship Sudden Cattle Crossing',
    description: 'Slow-moving cattle herd stepping onto the highway and stopping erratically mid-lane in front of the vehicle.',
    speed: '28 km/h (7.8 m/s)',
    distance: '80 meters',
    split: 'test',
    roadWidth: '8.0m with dirt shoulder',
    curvature: 'κ = 0.00 m⁻¹',
    agentMix: ['Cattle Herd (Bovine)', 'Two-Wheeler overtaking'],
    keyChallenge: 'Calibrated conformal uncertainty envelopes predicting multi-directional cattle trajectory hesitation.',
    defaultRunId: 'run_scenario_5_cattle_crossing_p3_tune_s1000',
  },
  {
    id: 'SCENARIO_6_BRAKING_TRUCK',
    name: '6. Overloaded Truck Emergency Braking',
    description: 'Heavily overloaded commercial vehicle suddenly decelerates due to axle failure with defective brake lamps.',
    speed: '40 km/h (11.1 m/s)',
    distance: '100 meters',
    split: 'val',
    roadWidth: '9.0m dual carriageway',
    curvature: 'κ = 0.01 m⁻¹',
    agentMix: ['Overloaded Truck', 'Overtaking Sedan'],
    keyChallenge: 'High-speed negative acceleration prediction requiring sub-50ms replan trigger.',
    defaultRunId: 'run_scenario_5_cattle_crossing_p3_tune_s1000',
  },
];

export const Scenarios: React.FC = () => {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [splitFilter, setSplitFilter] = useState<'all' | 'train' | 'val' | 'test'>('all');

  const filteredScenarios = BENCHMARK_SCENARIOS.filter(
    (sc) => splitFilter === 'all' || sc.split === splitFilter
  );

  return (
    <div style={{ padding: '1.5rem', maxWidth: '1280px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.85rem', fontWeight: 800, margin: '0 0 0.4rem' }}>
            {t('nav_scenarios')}
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', margin: 0 }}>
            Curated unstructured Indian road scenarios featuring heterogeneous road users, unpaved shoulders, and zero lane markings.
          </p>
        </div>

        {/* Split Filter Buttons */}
        <div
          role="group"
          aria-label="Filter scenarios by dataset split"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            background: 'var(--bg-surface-elevated)',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-md)',
            padding: '2px',
          }}
        >
          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', padding: '0 0.5rem' }}>
            Split:
          </span>
          {(['all', 'train', 'val', 'test'] as const).map((split) => (
            <button
              key={split}
              type="button"
              onClick={() => setSplitFilter(split)}
              aria-pressed={splitFilter === split}
              style={{
                background: splitFilter === split ? 'var(--accent-primary)' : 'transparent',
                color: splitFilter === split ? '#ffffff' : 'var(--text-secondary)',
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                padding: '0.35rem 0.65rem',
                fontSize: '0.75rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                cursor: 'pointer',
                minHeight: 'var(--min-target-size)',
              }}
            >
              {split}
            </button>
          ))}
        </div>
      </div>

      {/* Grid of Scenario Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
          gap: '1.25rem',
        }}
      >
        {filteredScenarios.map((sc) => (
          <div
            key={sc.id}
            className="glass-panel"
            style={{
              padding: '1.25rem',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              border: '1px solid var(--border-default)',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span
                  style={{
                    fontSize: '0.75rem',
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 700,
                    padding: '2px 6px',
                    borderRadius: '4px',
                    background: 'rgba(59, 130, 246, 0.15)',
                    color: 'var(--accent-primary)',
                  }}
                >
                  {sc.id.replace('SCENARIO_', 'SCN-')}
                </span>
                <span
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    background: 'var(--bg-surface-elevated)',
                    color: sc.split === 'test' ? 'var(--risk-critical)' : 'var(--accent-teal)',
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  {sc.split} Split
                </span>
              </div>

              <h2 style={{ fontSize: '1.15rem', fontWeight: 700, margin: '0 0 0.5rem', color: 'var(--text-primary)' }}>
                {sc.name}
              </h2>

              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '0.75rem' }}>
                {sc.description}
              </p>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '0.5rem',
                  fontSize: '0.8rem',
                  color: 'var(--text-secondary)',
                  background: 'var(--bg-surface-elevated)',
                  padding: '0.6rem',
                  borderRadius: 'var(--radius-sm)',
                  marginBottom: '0.75rem',
                }}
              >
                <div>Speed: <strong style={{ color: 'var(--text-primary)' }}>{sc.speed}</strong></div>
                <div>Distance: <strong style={{ color: 'var(--text-primary)' }}>{sc.distance}</strong></div>
                <div>Width: <strong style={{ color: 'var(--text-primary)' }}>{sc.roadWidth}</strong></div>
                <div>Curvature: <strong style={{ color: 'var(--text-primary)' }}>{sc.curvature}</strong></div>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                  Agents:
                </span>{' '}
                <span style={{ fontSize: '0.8rem', color: 'var(--text-primary)' }}>
                  {sc.agentMix.join(', ')}
                </span>
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                gap: '0.5rem',
                borderTop: '1px solid var(--border-subtle)',
                paddingTop: '0.75rem',
              }}
            >
              <Link
                to={`/app/scenarios/${sc.id}`}
                className="btn-secondary"
                style={{
                  flex: 1,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.4rem',
                  padding: '0.5rem',
                  fontSize: '0.85rem',
                  textDecoration: 'none',
                  minHeight: 'var(--min-target-size)',
                }}
              >
                <Eye size={15} />
                <span>Inspect Config</span>
              </Link>

              <button
                type="button"
                onClick={() => navigate(`/app/runs/${sc.defaultRunId}`)}
                className="btn-primary"
                style={{
                  flex: 1,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.4rem',
                  padding: '0.5rem',
                  fontSize: '0.85rem',
                  minHeight: 'var(--min-target-size)',
                }}
              >
                <Play size={15} />
                <span>Launch Replay</span>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
