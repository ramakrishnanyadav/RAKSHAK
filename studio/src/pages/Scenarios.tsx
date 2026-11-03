/**
 * Canonical Scenarios Catalog Page (Route: /app/scenarios).
 * Displays the 5 canonical benchmark scenarios from engine/scenarios/registry.py
 * for intelligent path planning and collision avoidance on unstructured Indian roads.
 */

import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Play, Eye, Compass, ShieldAlert, Sparkles, MapPin, AlertTriangle, PlusCircle, CheckCircle } from 'lucide-react';
import { useI18n } from '../context/I18nContext';
import { apiClient } from '../api/client';
import { EmptyState, SkeletonCard } from '../components/StatusState';

export interface ScenarioDefinition {
  id: string;
  name: string;
  description: string;
  environment: string;
  trafficChallenge: string;
  evaluates: string;
  speed: string;
  distance: string;
  split: 'train' | 'val' | 'test';
  agentMix: string[];
  roadWidth: string;
  curvature: string;
  defaultRunId: string;
}

/**
 * Historical legacy scenario ID compatibility mapping.
 * Maps legacy IDs to canonical engine scenario IDs to preserve bookmark
 * and historical run replay compatibility without altering underlying data.
 */
export const LEGACY_SCENARIO_COMPATIBILITY_MAP: Record<string, string> = {
  'SCENARIO_1_UNSTRUCTURED_ROUNDABOUT': 'SCENARIO_1_VILLAGE_ROAD',
  'SCENARIO_2_WRONG_WAY_AUTO': 'SCENARIO_2_URBAN_INTERSECTION',
  'SCENARIO_3_MONSOON_POTHOLE': 'SCENARIO_3_HIGHWAY_MERGE',
  'SCENARIO_4_MIXED_CROWD': 'SCENARIO_4_DENSE_MARKET',
  'SCENARIO_6_BRAKING_TRUCK': 'SCENARIO_5_CATTLE_CROSSING',
};

/**
 * Exactly five canonical scenarios from engine/scenarios/registry.py:
 * 1. SCENARIO_1_VILLAGE_ROAD
 * 2. SCENARIO_2_URBAN_INTERSECTION
 * 3. SCENARIO_3_HIGHWAY_MERGE
 * 4. SCENARIO_4_DENSE_MARKET
 * 5. SCENARIO_5_CATTLE_CROSSING
 */
export const BENCHMARK_SCENARIOS: ScenarioDefinition[] = [
  {
    id: 'SCENARIO_1_VILLAGE_ROAD',
    name: '1. Unmarked Village Road',
    description: 'Narrow unmarked rural asphalt road with potholes, unpaved dirt shoulders, and an oncoming heavy commercial vehicle.',
    environment: 'Narrow rural roadway without painted lane markings (6.4m – 7.6m width) with unpaved earthen shoulders.',
    trafficChallenge: 'Negotiating safe passage past an oncoming heavy vehicle while avoiding road surface potholes.',
    evaluates: 'Continuous non-lane-bound path planning, dynamic speed regulation, and safe shoulder clearance.',
    speed: '25 km/h (7.0 m/s)',
    distance: '80 meters',
    split: 'train',
    roadWidth: '6.4 – 7.6 m',
    curvature: 'κ ≤ 0.08 m⁻¹',
    agentMix: ['Heavy Commercial Vehicle', 'Two-Wheeler'],
    defaultRunId: 'run_scenario_1_village_road_p3_tune_s1000',
  },
  {
    id: 'SCENARIO_2_URBAN_INTERSECTION',
    name: '2. Busy Unsignalized Urban Intersection',
    description: 'Complex junction without traffic signals, featuring cross-cutting auto-rickshaws and swarming two-wheelers.',
    environment: 'Multi-directional urban intersection without traffic lights or marked lane corridors.',
    trafficChallenge: 'Cross-cutting auto-rickshaws and swarming two-wheelers merging unpredictably from multiple directions.',
    evaluates: 'Multi-agent motion prediction, dynamic gap acceptance, and collision-free crossing without signal guidance.',
    speed: '25 km/h (7.0 m/s)',
    distance: '75 meters',
    split: 'train',
    roadWidth: '14.0 m intersection zone',
    curvature: 'κ ≤ 0.05 m⁻¹',
    agentMix: ['Auto-Rickshaws (Cross-cutting)', 'Swarming Two-Wheelers'],
    defaultRunId: 'run_scenario_2_urban_intersection_p3_tune_s1000',
  },
  {
    id: 'SCENARIO_3_HIGHWAY_MERGE',
    name: '3. Highway Merge with Slow Vehicles',
    description: 'Fast-moving arterial corridor with slow auto-rickshaws entering from unpaved ramps at acute angles.',
    environment: 'High-speed dual-carriageway corridor with unpaved access ramps entering at acute angles.',
    trafficChallenge: 'Severe speed differential between cruising traffic and slow vehicles entering without acceleration lanes.',
    evaluates: 'Long-horizon trajectory forecasting, smooth speed adjustments, and proactive braking to prevent rear-end collisions.',
    speed: '40 km/h (11.0 m/s)',
    distance: '100 meters',
    split: 'val',
    roadWidth: '10.5 m dual carriageway',
    curvature: 'κ ≤ 0.02 m⁻¹',
    agentMix: ['Merging Auto-Rickshaw', 'High-Speed Traffic'],
    defaultRunId: 'run_scenario_3_highway_merge_p3_tune_s1000',
  },
  {
    id: 'SCENARIO_4_DENSE_MARKET',
    name: '4. Dense Market with Occluded Emergence',
    description: 'Vendor stalls and parked vehicles with sudden pedestrian stepping out from behind visual occlusion.',
    environment: 'Constricted market street (5.5m – 6.0m width) with roadside vendor stalls and parked auto-rickshaws.',
    trafficChallenge: 'Pedestrians and handcarts stepping out suddenly into the driveable path from blind spots.',
    evaluates: 'Occlusion-aware crawling speed, safety margin maintenance, and immediate emergency safe stop (MRM).',
    speed: '22 km/h (6.0 m/s)',
    distance: '75 meters',
    split: 'val',
    roadWidth: '5.5 – 6.0 m (constricted)',
    curvature: 'κ ≤ 0.03 m⁻¹',
    agentMix: ['Pedestrians (Sudden emergence)', 'Handcarts', 'Stationary Stalls'],
    defaultRunId: 'run_scenario_4_dense_market_p3_tune_s1000',
  },
  {
    id: 'SCENARIO_5_CATTLE_CROSSING',
    name: '5. Sudden Cattle Crossing',
    description: 'Livestock entering the roadway and halting mid-lane, requiring non-lane lateral avoidance or safe braking.',
    environment: 'Rural transit roadway (8.0m width) with dirt shoulders and unstructured animal crossings.',
    trafficChallenge: 'Cattle wandering onto the road and halting unpredictably across the vehicle travel corridor.',
    evaluates: 'Uncertainty prediction envelopes, stationary obstacle persistence handling, and safe lateral detour navigation.',
    speed: '27 km/h (7.5 m/s)',
    distance: '80 meters',
    split: 'test',
    roadWidth: '8.0 m with dirt shoulder',
    curvature: 'κ ≤ 0.01 m⁻¹',
    agentMix: ['Cattle (Bovine)', 'Overtaking Two-Wheeler'],
    defaultRunId: 'run_scenario_5_cattle_crossing_p3_tune_s1000',
  },
];

export const Scenarios: React.FC = () => {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [splitFilter, setSplitFilter] = useState<'all' | 'train' | 'val' | 'test'>('all');
  const [selectedScenarioId, setSelectedScenarioId] = useState<string>('SCENARIO_1_VILLAGE_ROAD');

  // Load scenarios from API if available, falling back gracefully to authoritative catalog
  const { data: scenarios = BENCHMARK_SCENARIOS, isLoading, isError } = useQuery({
    queryKey: ['scenarios_catalog'],
    queryFn: async () => {
      try {
        const live = await apiClient.listScenarios();
        if (live && Array.isArray(live) && live.length > 0) {
          // Verify live matches canonical IDs and preserve rich descriptions
          return live.map((d) => {
            const canonical = BENCHMARK_SCENARIOS.find((b) => b.id === d.id) || BENCHMARK_SCENARIOS[0];
            return {
              ...canonical,
              id: d.id,
              name: d.name || canonical.name,
              description: d.description || canonical.description,
            };
          });
        }
      } catch {
        // Backend offline or error -> use canonical static catalog
      }
      return BENCHMARK_SCENARIOS;
    },
    initialData: BENCHMARK_SCENARIOS,
  });

  const filteredScenarios = scenarios.filter(
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
            Canonical simulation environments representing real-world challenges on Indian roads without painted lanes.
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

      {/* Loading state indicator */}
      {isLoading && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1.25rem' }}>
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      )}

      {/* Empty State when filter has no matches */}
      {!isLoading && filteredScenarios.length === 0 && (
        <EmptyState
          title="No Scenarios Match Selected Split"
          description={`No scenarios found for the "${splitFilter}" split filter.`}
          actionText="Show All Canonical Scenarios"
          onAction={() => setSplitFilter('all')}
        />
      )}

      {/* Grid of Scenario Cards */}
      {!isLoading && filteredScenarios.length > 0 && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
            gap: '1.25rem',
          }}
        >
          {filteredScenarios.map((sc) => {
            const isSelected = sc.id === selectedScenarioId;
            return (
              <div
                key={sc.id}
                className="glass-panel"
                onClick={() => setSelectedScenarioId(sc.id)}
                role="article"
                aria-selected={isSelected}
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setSelectedScenarioId(sc.id);
                  }
                }}
                style={{
                  padding: '1.25rem',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  border: isSelected ? '2px solid var(--accent-primary)' : '1px solid var(--border-default)',
                  borderRadius: 'var(--radius-md)',
                  boxShadow: isSelected ? '0 0 16px rgba(59, 130, 246, 0.2)' : 'none',
                  cursor: 'pointer',
                  transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
                  gap: '1rem',
                  position: 'relative',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
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
                      {isSelected && (
                        <span
                          style={{
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            padding: '2px 6px',
                            borderRadius: '4px',
                            background: 'var(--accent-primary)',
                            color: '#ffffff',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px',
                          }}
                        >
                          <CheckCircle size={11} /> Selected
                        </span>
                      )}
                    </div>
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

                  {/* 3 Core Communications: Environment, Main Challenge, Evaluates */}
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.45rem',
                      fontSize: '0.8rem',
                      background: 'var(--bg-surface-elevated)',
                      padding: '0.75rem',
                      borderRadius: 'var(--radius-sm)',
                      marginBottom: '0.75rem',
                      border: '1px solid var(--border-subtle)',
                    }}
                  >
                    <div>
                      <strong style={{ color: 'var(--text-primary)' }}>Environment:</strong>{' '}
                      <span style={{ color: 'var(--text-secondary)' }}>{sc.environment}</span>
                    </div>
                    <div>
                      <strong style={{ color: 'var(--text-primary)' }}>Traffic Challenge:</strong>{' '}
                      <span style={{ color: 'var(--text-secondary)' }}>{sc.trafficChallenge}</span>
                    </div>
                    <div>
                      <strong style={{ color: 'var(--text-primary)' }}>Evaluates:</strong>{' '}
                      <span style={{ color: 'var(--text-secondary)' }}>{sc.evaluates}</span>
                    </div>
                  </div>

                  {/* Physical Parameters Summary */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: '0.4rem',
                      fontSize: '0.75rem',
                      color: 'var(--text-secondary)',
                      marginBottom: '0.75rem',
                    }}
                  >
                    <div>Speed: <strong style={{ color: 'var(--text-primary)' }}>{sc.speed}</strong></div>
                    <div>Distance: <strong style={{ color: 'var(--text-primary)' }}>{sc.distance}</strong></div>
                    <div>Road Width: <strong style={{ color: 'var(--text-primary)' }}>{sc.roadWidth}</strong></div>
                    <div>Curvature: <strong style={{ color: 'var(--text-primary)' }}>{sc.curvature}</strong></div>
                  </div>

                  <div>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                      Road Users:
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
                  onClick={(e) => e.stopPropagation()}
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
                    onClick={() => navigate(`/app/runs/new?scenario=${sc.id}`)}
                    className="btn-secondary"
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
                    <PlusCircle size={15} />
                    <span>New Run</span>
                  </button>

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
                    <span>Replay</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
