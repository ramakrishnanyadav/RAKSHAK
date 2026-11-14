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
 * Canonical 8-Scenario Benchmark Suite for Stage 4G.6:
 * 1. SCENARIO_01_POTHOLE_DAMAGED_ROAD
 * 2. SCENARIO_02_PEDESTRIAN_CROSSING (Flagship Acceptance Test)
 * 3. SCENARIO_03_DENSE_MIXED_TRAFFIC
 * 4. SCENARIO_04_MOTORCYCLE_CUT_IN
 * 5. SCENARIO_05_UNCONTROLLED_INTERSECTION
 * 6. SCENARIO_06_HIGHWAY_SUDDEN_BRAKING
 * 7. SCENARIO_07_ROADWORKS_OBSTRUCTION
 * 8. SCENARIO_08_CATTLE_CROSSING
 */
export const BENCHMARK_SCENARIOS: ScenarioDefinition[] = [
  {
    id: 'SCENARIO_01_POTHOLE_DAMAGED_ROAD',
    name: '01. Pothole & Damaged Road',
    description: 'Narrow unmarked rural asphalt with potholes, degraded asphalt patches, and oncoming heavy commercial traffic.',
    environment: 'Narrow rural roadway (6.4m – 7.6m width) with potholes, earthen shoulders, and oncoming heavy vehicles.',
    trafficChallenge: 'Negotiating passage around road-surface hazards while avoiding oncoming heavy truck.',
    evaluates: 'Road-surface hazard constraint avoidance, non-lane boundary compliance, dynamic speed regulation.',
    speed: '25 km/h (7.0 m/s)',
    distance: '80 meters',
    split: 'train',
    roadWidth: '6.4 – 7.6 m',
    curvature: 'κ ≤ 0.08 m⁻¹',
    agentMix: ['Potholes (Road Surface Constraint)', 'Oncoming Commercial Truck'],
    defaultRunId: 'run_scenario_01_pothole_damaged_road_p3_tune_s1000',
  },
  {
    id: 'SCENARIO_02_PEDESTRIAN_CROSSING',
    name: '02. Child / Pedestrian Crossing',
    description: 'Indian urban residential street with parked vehicles; sudden occluded pedestrian child stepping into path.',
    environment: 'Dense residential street (7.6m width) with parked vehicles acting as physical and visual occluders.',
    trafficChallenge: 'Child pedestrian suddenly emerges into vehicle path from behind parked vehicles.',
    evaluates: 'Occluded target perception acquisition, time-to-collision (TTC) forecasting, emergency deceleration, safe stopping.',
    speed: '23 km/h (6.5 m/s)',
    distance: '70 meters',
    split: 'train',
    roadWidth: '7.6 m residential corridor',
    curvature: 'κ ≤ 0.02 m⁻¹',
    agentMix: ['Pedestrian Child (Sudden Cross)', 'Parked Auto-Rickshaw', 'Parked Car'],
    defaultRunId: 'run_scenario_02_pedestrian_crossing_p3_tune_s1000',
  },
  {
    id: 'SCENARIO_03_DENSE_MIXED_TRAFFIC',
    name: '03. Dense Mixed Indian Traffic',
    description: 'Narrow urban arterial with heterogeneous traffic: cars, auto-rickshaws, and swarming two-wheelers in tight gaps.',
    environment: 'Narrow urban arterial corridor without marked lanes.',
    trafficChallenge: 'Two-wheelers weaving opportunistically between vehicles with small headway margins.',
    evaluates: 'Multi-agent tracking, safe following distance maintenance, speed stability under swarming conditions.',
    speed: '22 km/h (6.0 m/s)',
    distance: '75 meters',
    split: 'train',
    roadWidth: '8.4 m urban corridor',
    curvature: 'κ ≤ 0.04 m⁻¹',
    agentMix: ['Lead Auto-Rickshaw', 'Weaving Scooter', 'Oncoming Vehicle'],
    defaultRunId: 'run_scenario_03_dense_mixed_traffic_p3_tune_s1000',
  },
  {
    id: 'SCENARIO_04_MOTORCYCLE_CUT_IN',
    name: '04. Motorcycle Cut-In',
    description: 'Multi-lane urban corridor where adjacent two-wheeler cuts sharply into ego path, collapsing headway.',
    environment: 'Multi-lane urban road (10.0m width) with fast adjacent flow.',
    trafficChallenge: 'Motorcycle changes lanes directly into ego safety envelope with sudden lateral velocity.',
    evaluates: 'Closing speed estimation, dynamic headway re-evaluation, immediate braking response.',
    speed: '27 km/h (7.5 m/s)',
    distance: '80 meters',
    split: 'val',
    roadWidth: '10.0 m multi-lane',
    curvature: 'κ ≤ 0.02 m⁻¹',
    agentMix: ['Cut-In Motorcycle', 'Adjacent Traffic'],
    defaultRunId: 'run_scenario_04_motorcycle_cut_in_p3_tune_s1000',
  },
  {
    id: 'SCENARIO_05_UNCONTROLLED_INTERSECTION',
    name: '05. Uncontrolled Intersection',
    description: 'Complex 4-arm junction without traffic signals, featuring cross-cutting auto-rickshaws and two-wheelers.',
    environment: 'Multi-directional urban intersection without traffic lights or marked lane corridors.',
    trafficChallenge: 'Cross-cutting auto-rickshaws and swarming two-wheelers merging unpredictably from multiple directions.',
    evaluates: 'Multi-agent motion prediction, dynamic gap acceptance, and collision-free crossing without signal guidance.',
    speed: '25 km/h (7.0 m/s)',
    distance: '75 meters',
    split: 'val',
    roadWidth: '14.0 m intersection zone',
    curvature: 'κ ≤ 0.05 m⁻¹',
    agentMix: ['Cross-cutting Auto-Rickshaws', 'Swarming Two-Wheelers'],
    defaultRunId: 'run_scenario_05_uncontrolled_intersection_p3_tune_s1000',
  },
  {
    id: 'SCENARIO_06_HIGHWAY_SUDDEN_BRAKING',
    name: '06. Highway Sudden Braking',
    description: 'High-speed highway corridor where lead vehicle performs sudden emergency deceleration to a stop.',
    environment: 'High-speed dual-carriageway corridor (11.0m width).',
    trafficChallenge: 'Rapid closing speed and collapse of headway requiring maximum safe deceleration.',
    evaluates: 'Emergency stopping distance, jerk and passenger comfort, rear-end collision prevention.',
    speed: '43 km/h (12.0 m/s)',
    distance: '100 meters',
    split: 'val',
    roadWidth: '11.0 m highway corridor',
    curvature: 'κ ≤ 0.01 m⁻¹',
    agentMix: ['Emergency Braking Lead Car', 'Highway Traffic'],
    defaultRunId: 'run_scenario_06_highway_sudden_braking_p3_tune_s1000',
  },
  {
    id: 'SCENARIO_07_ROADWORKS_OBSTRUCTION',
    name: '07. Roadworks & Lane Obstruction',
    description: 'Partially blocked roadway with construction barricades, excavation trenches, and constrained single-lane bypass.',
    environment: 'Urban arterial undergoing road repairs with physical barricades and lane closures.',
    trafficChallenge: 'Blocked lanes forcing vehicles into a narrow single-lane bidirectional squeeze.',
    evaluates: 'Constrained space trajectory generation, boundary compliance, clearance maintenance.',
    speed: '22 km/h (6.0 m/s)',
    distance: '80 meters',
    split: 'test',
    roadWidth: '9.0 m (constricted to 3.2m)',
    curvature: 'κ ≤ 0.03 m⁻¹',
    agentMix: ['Construction Barricades', 'Excavation Trench', 'Oncoming Motorcycle'],
    defaultRunId: 'run_scenario_07_roadworks_obstruction_p3_tune_s1000',
  },
  {
    id: 'SCENARIO_08_CATTLE_CROSSING',
    name: '08. Sudden Cattle Crossing',
    description: 'Rural transit road where bovine animal steps into vehicle path and halts mid-lane, requiring detour or safe stop.',
    environment: 'Rural transit roadway (8.0m width) with dirt shoulders and unstructured animal crossings.',
    trafficChallenge: 'Cattle wandering onto the road and halting unpredictably across the vehicle travel corridor.',
    evaluates: 'Uncertainty prediction envelopes, non-lane lateral bypass planning, safe stopping.',
    speed: '27 km/h (7.5 m/s)',
    distance: '80 meters',
    split: 'test',
    roadWidth: '8.0 m with dirt shoulder',
    curvature: 'κ ≤ 0.01 m⁻¹',
    agentMix: ['Cattle (Bovine)', 'Unpaved Shoulder'],
    defaultRunId: 'run_scenario_08_cattle_crossing_p3_tune_s1000',
  },
  // Legacy aliases
  {
    id: 'SCENARIO_1_VILLAGE_ROAD',
    name: 'Legacy: Unmarked Village Road',
    description: 'Narrow unmarked rural asphalt road with potholes, unpaved dirt shoulders, and oncoming heavy vehicle.',
    environment: 'Narrow rural roadway (6.4m – 7.6m width) with unpaved earthen shoulders.',
    trafficChallenge: 'Negotiating passage past oncoming heavy vehicle while avoiding potholes.',
    evaluates: 'Continuous non-lane-bound path planning and shoulder clearance.',
    speed: '25 km/h (7.0 m/s)',
    distance: '80 meters',
    split: 'train',
    roadWidth: '6.4 – 7.6 m',
    curvature: 'κ ≤ 0.08 m⁻¹',
    agentMix: ['Heavy Commercial Vehicle', 'Two-Wheeler'],
    defaultRunId: 'run_scenario_1_village_road_p3_tune_s1000',
  },
  {
    id: 'SCENARIO_5_CATTLE_CROSSING',
    name: 'Legacy: Sudden Cattle Crossing',
    description: 'Livestock entering roadway and halting mid-lane, requiring lateral avoidance or safe braking.',
    environment: 'Rural transit roadway (8.0m width) with dirt shoulders.',
    trafficChallenge: 'Cattle wandering onto road and halting unpredictably across travel corridor.',
    evaluates: 'Uncertainty prediction envelopes and safe lateral detour navigation.',
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
  const [selectedScenarioId, setSelectedScenarioId] = useState<string>('SCENARIO_02_PEDESTRIAN_CROSSING');

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
          <h1 style={{
            fontSize: '1.9rem',
            fontWeight: 900,
            margin: '0 0 0.4rem',
            letterSpacing: '-0.03em',
            background: 'linear-gradient(135deg, #f8fafc 0%, #94a3b8 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}>
            {t('nav_scenarios')}
          </h1>
          <p style={{ color: '#64748b', fontSize: '0.9rem', margin: 0 }}>
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
            const scenarioGradients: Record<string, string> = {
              'SCENARIO_1_VILLAGE_ROAD': 'linear-gradient(135deg, #10b981, #14b8a6)',
              'SCENARIO_2_URBAN_INTERSECTION': 'linear-gradient(135deg, #f59e0b, #f97316)',
              'SCENARIO_3_HIGHWAY_MERGE': 'linear-gradient(135deg, #6366f1, #818cf8)',
              'SCENARIO_4_DENSE_MARKET': 'linear-gradient(135deg, #ef4444, #f97316)',
              'SCENARIO_5_CATTLE_CROSSING': 'linear-gradient(135deg, #38bdf8, #0ea5e9)',
            };
            const accentGrad = scenarioGradients[sc.id] || 'linear-gradient(135deg, #38bdf8, #818cf8)';

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
                  border: isSelected ? '1px solid rgba(56, 189, 248, 0.5)' : '1px solid rgba(56, 189, 248, 0.1)',
                  borderRadius: '12px',
                  boxShadow: isSelected ? '0 0 24px rgba(56, 189, 248, 0.15), 0 8px 24px rgba(0,0,0,0.3)' : '0 4px 16px rgba(0,0,0,0.3)',
                  cursor: 'pointer',
                  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                  gap: '1rem',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                {/* Top accent gradient bar */}
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: accentGrad }} />

                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <span
                        style={{
                          fontSize: '0.68rem',
                          fontFamily: 'var(--font-mono)',
                          fontWeight: 800,
                          padding: '2px 7px',
                          borderRadius: '4px',
                          background: 'rgba(56, 189, 248, 0.12)',
                          color: '#38bdf8',
                          border: '1px solid rgba(56, 189, 248, 0.2)',
                          letterSpacing: '0.05em',
                        }}
                      >
                        {sc.id.replace('SCENARIO_', 'SCN-')}
                      </span>
                      {isSelected && (
                        <span
                          style={{
                            fontSize: '0.68rem',
                            fontWeight: 800,
                            padding: '2px 7px',
                            borderRadius: '4px',
                            background: 'rgba(56, 189, 248, 0.2)',
                            color: '#38bdf8',
                            border: '1px solid rgba(56, 189, 248, 0.35)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px',
                          }}
                        >
                          <CheckCircle size={10} /> SELECTED
                        </span>
                      )}
                    </div>
                    <span
                      style={{
                        fontSize: '0.68rem',
                        fontWeight: 800,
                        textTransform: 'uppercase',
                        padding: '2px 7px',
                        borderRadius: '4px',
                        background: 'rgba(16, 22, 35, 0.6)',
                        color: sc.split === 'test' ? '#ef4444' : '#10b981',
                        border: `1px solid ${sc.split === 'test' ? 'rgba(239, 68, 68, 0.3)' : 'rgba(16, 185, 129, 0.3)'}`,
                        letterSpacing: '0.05em',
                      }}
                    >
                      {sc.split} Split
                    </span>
                  </div>

                  <h2 style={{ fontSize: '1.1rem', fontWeight: 800, margin: '0 0 0.5rem', color: '#e2e8f0', letterSpacing: '-0.01em' }}>
                    {sc.name}
                  </h2>

                  <p style={{ fontSize: '0.82rem', color: '#64748b', lineHeight: 1.55, marginBottom: '0.75rem' }}>
                    {sc.description}
                  </p>

                  {/* 3 Core Communications: Environment, Main Challenge, Evaluates */}
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.4rem',
                      fontSize: '0.78rem',
                      background: 'rgba(7, 8, 10, 0.5)',
                      padding: '0.75rem',
                      borderRadius: '8px',
                      marginBottom: '0.75rem',
                      border: '1px solid rgba(56, 189, 248, 0.08)',
                    }}
                  >
                    <div>
                      <strong style={{ color: '#94a3b8' }}>Environment: </strong>
                      <span style={{ color: '#64748b' }}>{sc.environment}</span>
                    </div>
                    <div>
                      <strong style={{ color: '#94a3b8' }}>Traffic Challenge: </strong>
                      <span style={{ color: '#64748b' }}>{sc.trafficChallenge}</span>
                    </div>
                    <div>
                      <strong style={{ color: '#94a3b8' }}>Evaluates: </strong>
                      <span style={{ color: '#64748b' }}>{sc.evaluates}</span>
                    </div>
                  </div>

                  {/* Physical Parameters Summary */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: '0.4rem',
                      fontSize: '0.72rem',
                      color: '#64748b',
                      marginBottom: '0.75rem',
                    }}
                  >
                    <div>Speed: <strong style={{ color: '#94a3b8' }}>{sc.speed}</strong></div>
                    <div>Distance: <strong style={{ color: '#94a3b8' }}>{sc.distance}</strong></div>
                    <div>Road Width: <strong style={{ color: '#94a3b8' }}>{sc.roadWidth}</strong></div>
                    <div>Curvature: <strong style={{ color: '#94a3b8' }}>{sc.curvature}</strong></div>
                  </div>

                  <div>
                    <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Road Users:{' '}
                    </span>
                    <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                      {sc.agentMix.join(', ')}
                    </span>
                  </div>
                </div>

                <div
                  style={{
                    display: 'flex',
                    gap: '0.5rem',
                    borderTop: '1px solid rgba(56, 189, 248, 0.08)',
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
                      fontSize: '0.82rem',
                      textDecoration: 'none',
                      minHeight: 'var(--min-target-size)',
                    }}
                  >
                    <Eye size={14} />
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
                      fontSize: '0.82rem',
                      minHeight: 'var(--min-target-size)',
                    }}
                  >
                    <PlusCircle size={14} />
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
                      fontSize: '0.82rem',
                      minHeight: 'var(--min-target-size)',
                    }}
                  >
                    <Play size={14} />
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
