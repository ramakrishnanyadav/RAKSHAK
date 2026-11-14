/**
 * Experiment Runs Directory Component.
 * Implements Stage 4G.3 Priority 2:
 * - Grouped by Scenario (Scenarios 1-5) and Test Batch (Seed 1000)
 * - Multi-criteria filtering (Scenario, Planner, Outcome, Run ID search)
 * - Experiment Analysis summary banner (Total runs, Scenarios, Planners, Safe vs Collisions)
 * - High-density accessible comparison table with authentic simulation metrics
 * - Direct navigation to meaningful Run Detail Replay (/app/runs/:id)
 */

import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  CheckCircle,
  AlertTriangle,
  PlayCircle,
  Search,
  Filter,
  RotateCcw,
  ShieldCheck,
  Compass,
  ArrowRight,
  Info,
  Layers,
  Clock,
  Gauge,
  MapPin,
} from 'lucide-react';

export interface ExperimentRunRecord {
  id: string;
  scenario_id: string;
  scenario_name: string;
  planner_id: string;
  planner_name: string;
  seed: number;
  collision_occurred: boolean;
  completed_goal: boolean;
  min_clearance_m: number | null;
  mean_speed_m_s: number | null;
  max_jerk_m_s3: number | null;
  mean_jerk_m_s3: number | null;
  replan_count: number | null;
  p95_latency_ms: number | null;
  duration_s: number | null;
  path_length_m: number | null;
  frame_count: number | null;
  failure_tag?: string | null;
}

interface ExperimentDirectoryProps {
  runs: ExperimentRunRecord[];
  isLoading?: boolean;
}

const SCENARIO_ORDER = [
  'SCENARIO_1_VILLAGE_ROAD',
  'SCENARIO_2_URBAN_INTERSECTION',
  'SCENARIO_3_HIGHWAY_MERGE',
  'SCENARIO_4_DENSE_MARKET',
  'SCENARIO_5_CATTLE_CROSSING',
];

const SCENARIO_TITLES: Record<string, string> = {
  SCENARIO_1_VILLAGE_ROAD: 'Scenario 1: Unmarked Village Road',
  SCENARIO_2_URBAN_INTERSECTION: 'Scenario 2: Busy Unsignalized Urban Intersection',
  SCENARIO_3_HIGHWAY_MERGE: 'Scenario 3: Mixed High-Speed Highway Merge',
  SCENARIO_4_DENSE_MARKET: 'Scenario 4: Dense Pedestrian & Two-Wheeler Market',
  SCENARIO_5_CATTLE_CROSSING: 'Scenario 5: Sudden Cattle Crossing',
};

const PLANNER_BADGE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  B0: { bg: 'rgba(148, 163, 184, 0.15)', text: '#94a3b8', border: 'rgba(148, 163, 184, 0.3)' },
  B1: { bg: 'rgba(56, 189, 248, 0.15)', text: '#38bdf8', border: 'rgba(56, 189, 248, 0.3)' },
  B2: { bg: 'rgba(129, 140, 248, 0.15)', text: '#818cf8', border: 'rgba(129, 140, 248, 0.3)' },
  P1: { bg: 'rgba(234, 179, 8, 0.15)', text: '#eab308', border: 'rgba(234, 179, 8, 0.3)' },
  P2: { bg: 'rgba(249, 115, 22, 0.15)', text: '#f97316', border: 'rgba(249, 115, 22, 0.3)' },
  P3: { bg: 'rgba(16, 185, 129, 0.15)', text: '#10b981', border: 'rgba(16, 185, 129, 0.35)' },
};

export const ExperimentDirectory: React.FC<ExperimentDirectoryProps> = ({ runs, isLoading }) => {
  const navigate = useNavigate();

  // Filters
  const [selectedScenario, setSelectedScenario] = useState<string>('ALL');
  const [selectedPlanner, setSelectedPlanner] = useState<string>('ALL');
  const [selectedOutcome, setSelectedOutcome] = useState<'ALL' | 'SAFE' | 'COLLISION'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Summary Metrics
  const summary = useMemo(() => {
    const total = runs.length;
    const uniqueScenarios = new Set(runs.map((r) => r.scenario_id)).size;
    const uniquePlanners = new Set(runs.map((r) => r.planner_id)).size;
    const safeRuns = runs.filter((r) => !r.collision_occurred).length;
    const collisionRuns = runs.filter((r) => r.collision_occurred).length;
    return { total, uniqueScenarios, uniquePlanners, safeRuns, collisionRuns };
  }, [runs]);

  // Filtered Runs
  const filteredRuns = useMemo(() => {
    return runs.filter((run) => {
      if (selectedScenario !== 'ALL' && run.scenario_id !== selectedScenario) return false;
      if (selectedPlanner !== 'ALL' && run.planner_id !== selectedPlanner) return false;
      if (selectedOutcome === 'SAFE' && run.collision_occurred) return false;
      if (selectedOutcome === 'COLLISION' && !run.collision_occurred) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesId = run.id.toLowerCase().includes(q);
        const matchesScenario = run.scenario_name.toLowerCase().includes(q);
        const matchesPlanner = run.planner_name.toLowerCase().includes(q);
        if (!matchesId && !matchesScenario && !matchesPlanner) return false;
      }
      return true;
    });
  }, [runs, selectedScenario, selectedPlanner, selectedOutcome, searchQuery]);

  // Group by Scenario
  const groupedByScenario = useMemo(() => {
    const groups: Record<string, ExperimentRunRecord[]> = {};
    SCENARIO_ORDER.forEach((scId) => {
      groups[scId] = [];
    });
    filteredRuns.forEach((r) => {
      if (!groups[r.scenario_id]) groups[r.scenario_id] = [];
      groups[r.scenario_id].push(r);
    });
    return groups;
  }, [filteredRuns]);

  const handleResetFilters = () => {
    setSelectedScenario('ALL');
    setSelectedPlanner('ALL');
    setSelectedOutcome('ALL');
    setSearchQuery('');
  };

  return (
    <div style={{ maxWidth: '1440px', margin: '0 auto', padding: '1.25rem 2rem' }}>
      {/* 1. Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '1.5rem',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0, color: '#f8fafc', letterSpacing: '-0.02em' }}>
              Experiment Runs Directory
            </h1>
            <span
              style={{
                fontSize: '0.68rem',
                padding: '0.15rem 0.5rem',
                borderRadius: '4px',
                background: 'rgba(56, 189, 248, 0.12)',
                color: '#38bdf8',
                fontWeight: 700,
                border: '1px solid rgba(56, 189, 248, 0.25)',
              }}
            >
              15 Canonical Experiments
            </span>
          </div>
          <p style={{ color: '#94a3b8', fontSize: '0.86rem', marginTop: '0.25rem', margin: 0 }}>
            Structured repository of multi-planner autonomous simulations across canonical unstructured Indian road environments.
          </p>
        </div>
      </div>

      {/* 2. Experiment Analysis Summary Banner */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(5, 1fr)',
          gap: '0.75rem',
          marginBottom: '1.5rem',
        }}
      >
        <div style={{ background: '#0d1322', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '8px', padding: '0.85rem 1rem' }}>
          <div style={{ fontSize: '0.68rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>
            Total Recorded Runs
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#38bdf8', fontFamily: 'monospace', marginTop: '0.2rem' }}>
            {summary.total}
          </div>
          <div style={{ fontSize: '0.65rem', color: '#94a3b8', marginTop: '0.15rem' }}>
            5 Scenarios · Seed 1000
          </div>
        </div>

        <div style={{ background: '#0d1322', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '8px', padding: '0.85rem 1rem' }}>
          <div style={{ fontSize: '0.68rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>
            Unique Road Scenarios
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#818cf8', fontFamily: 'monospace', marginTop: '0.2rem' }}>
            {summary.uniqueScenarios}
          </div>
          <div style={{ fontSize: '0.65rem', color: '#94a3b8', marginTop: '0.15rem' }}>
            Village, Market, Cattle, Intersection, Merge
          </div>
        </div>

        <div style={{ background: '#0d1322', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '8px', padding: '0.85rem 1rem' }}>
          <div style={{ fontSize: '0.68rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>
            Planners Evaluated
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#f8fafc', fontFamily: 'monospace', marginTop: '0.2rem' }}>
            {summary.uniquePlanners}
          </div>
          <div style={{ fontSize: '0.65rem', color: '#94a3b8', marginTop: '0.15rem' }}>
            B0, B1, B2, P1, P2, P3
          </div>
        </div>

        <div style={{ background: '#0d1322', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '8px', padding: '0.85rem 1rem' }}>
          <div style={{ fontSize: '0.68rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>
            Safe / Non-Collision Runs
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#10b981', fontFamily: 'monospace', marginTop: '0.2rem' }}>
            {summary.safeRuns}
          </div>
          <div style={{ fontSize: '0.65rem', color: '#10b981', marginTop: '0.15rem' }}>
            Includes P3 Cattle Crossing (3.99m buffer)
          </div>
        </div>

        <div style={{ background: '#0d1322', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '8px', padding: '0.85rem 1rem' }}>
          <div style={{ fontSize: '0.68rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>
            Baseline Collisions Disclosed
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#ef4444', fontFamily: 'monospace', marginTop: '0.2rem' }}>
            {summary.collisionRuns}
          </div>
          <div style={{ fontSize: '0.65rem', color: '#94a3b8', marginTop: '0.15rem' }}>
            Rigorous stress verification
          </div>
        </div>
      </div>

      {/* 3. Filter Bar */}
      <div
        style={{
          background: '#0d1322',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '10px',
          padding: '0.85rem 1.25rem',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: '1rem',
          marginBottom: '1.5rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#94a3b8', fontSize: '0.8rem' }}>
          <Filter size={15} color="#38bdf8" />
          <span style={{ fontWeight: 700, color: '#f8fafc' }}>Filter By:</span>
        </div>

        {/* Scenario Dropdown */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <span style={{ fontSize: '0.74rem', color: '#64748b' }}>Scenario:</span>
          <select
            value={selectedScenario}
            onChange={(e) => setSelectedScenario(e.target.value)}
            style={{
              background: '#070b14',
              color: '#f8fafc',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: '5px',
              padding: '0.35rem 0.6rem',
              fontSize: '0.74rem',
              cursor: 'pointer',
            }}
          >
            <option value="ALL">All 5 Scenarios</option>
            {SCENARIO_ORDER.map((id) => (
              <option key={id} value={id}>
                {SCENARIO_TITLES[id]}
              </option>
            ))}
          </select>
        </div>

        {/* Planner Dropdown */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <span style={{ fontSize: '0.74rem', color: '#64748b' }}>Planner:</span>
          <select
            value={selectedPlanner}
            onChange={(e) => setSelectedPlanner(e.target.value)}
            style={{
              background: '#070b14',
              color: '#f8fafc',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: '5px',
              padding: '0.35rem 0.6rem',
              fontSize: '0.74rem',
              cursor: 'pointer',
            }}
          >
            <option value="ALL">All Planners</option>
            <option value="B0">B0 (Static)</option>
            <option value="B1">B1 (DWA + VO)</option>
            <option value="B2">B2 (MPC Kinematic)</option>
            <option value="P1">P1 (Predictive)</option>
            <option value="P2">P2 (Risk-Aware)</option>
            <option value="P3">P3 (Risk-Adaptive Flagship)</option>
          </select>
        </div>

        {/* Outcome Dropdown */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <span style={{ fontSize: '0.74rem', color: '#64748b' }}>Outcome:</span>
          <select
            value={selectedOutcome}
            onChange={(e) => setSelectedOutcome(e.target.value as any)}
            style={{
              background: '#070b14',
              color: '#f8fafc',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: '5px',
              padding: '0.35rem 0.6rem',
              fontSize: '0.74rem',
              cursor: 'pointer',
            }}
          >
            <option value="ALL">All Outcomes</option>
            <option value="SAFE">Safe / Completed (0 Collisions)</option>
            <option value="COLLISION">Collision Occurred</option>
          </select>
        </div>

        {/* Search Input */}
        <div style={{ display: 'flex', alignItems: 'center', background: '#070b14', border: '1px solid rgba(255, 255, 255, 0.12)', borderRadius: '5px', padding: '0.2rem 0.6rem', flex: 1, minWidth: '180px' }}>
          <Search size={14} color="#64748b" style={{ marginRight: '0.4rem' }} />
          <input
            type="text"
            placeholder="Search Run ID, Planner..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: '#f8fafc',
              fontSize: '0.74rem',
              width: '100%',
            }}
          />
        </div>

        {/* Reset Action */}
        <button
          onClick={handleResetFilters}
          style={{
            background: 'transparent',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '5px',
            color: '#94a3b8',
            padding: '0.35rem 0.65rem',
            fontSize: '0.74rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.35rem',
          }}
        >
          <RotateCcw size={13} />
          <span>Reset</span>
        </button>
      </div>

      {/* 4. Grouped Scenarios & Tables */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
        {SCENARIO_ORDER.map((scId) => {
          const scenarioRuns = groupedByScenario[scId] || [];
          if (scenarioRuns.length === 0 && selectedScenario !== 'ALL') return null;

          return (
            <div
              key={scId}
              style={{
                background: '#0d1322',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '10px',
                overflow: 'hidden',
              }}
            >
              {/* Scenario Section Header */}
              <div
                style={{
                  padding: '0.85rem 1.25rem',
                  background: 'rgba(255, 255, 255, 0.02)',
                  borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                  <MapPin size={16} color="#38bdf8" />
                  <h2 style={{ fontSize: '0.98rem', fontWeight: 800, margin: 0, color: '#f8fafc' }}>
                    {SCENARIO_TITLES[scId]}
                  </h2>
                  <span style={{ fontSize: '0.7rem', color: '#64748b' }}>
                    ({scenarioRuns.length} recorded {scenarioRuns.length === 1 ? 'run' : 'runs'})
                  </span>
                </div>

                <div style={{ fontSize: '0.72rem', color: '#94a3b8', fontFamily: 'monospace' }}>
                  Batch: Seed 1000
                </div>
              </div>

              {/* Runs Table */}
              {scenarioRuns.length === 0 ? (
                <div style={{ padding: '1.5rem', textAlign: 'center', color: '#64748b', fontSize: '0.8rem' }}>
                  No recorded experiments match the selected filters for this scenario.
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.76rem', color: '#cbd5e1' }}>
                    <thead>
                      <tr style={{ background: 'rgba(255, 255, 255, 0.03)', borderBottom: '1px solid rgba(255, 255, 255, 0.06)', textAlign: 'left' }}>
                        <th style={{ padding: '0.6rem 1rem' }}>Planner</th>
                        <th style={{ padding: '0.6rem 0.75rem' }}>Run ID</th>
                        <th style={{ padding: '0.6rem 0.75rem' }}>Outcome</th>
                        <th style={{ padding: '0.6rem 0.75rem' }}>Min Clearance</th>
                        <th style={{ padding: '0.6rem 0.75rem' }}>Path Length</th>
                        <th style={{ padding: '0.6rem 0.75rem' }}>Mean Speed</th>
                        <th style={{ padding: '0.6rem 0.75rem' }}>Replans</th>
                        <th style={{ padding: '0.6rem 0.75rem' }}>Duration</th>
                        <th style={{ padding: '0.6rem 1rem', textAlign: 'right' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {scenarioRuns.map((r) => {
                        const badge = PLANNER_BADGE_COLORS[r.planner_id] || PLANNER_BADGE_COLORS.B1;
                        const isSafe = !r.collision_occurred;

                        return (
                          <tr
                            key={r.id}
                            style={{
                              borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                              transition: 'background 0.15s ease',
                            }}
                          >
                            {/* Planner Badge */}
                            <td style={{ padding: '0.65rem 1rem' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <span
                                  style={{
                                    display: 'inline-block',
                                    padding: '0.18rem 0.45rem',
                                    borderRadius: '4px',
                                    background: badge.bg,
                                    color: badge.text,
                                    border: `1px solid ${badge.border}`,
                                    fontWeight: 800,
                                    fontSize: '0.72rem',
                                  }}
                                >
                                  {r.planner_id}
                                </span>
                                <span style={{ fontSize: '0.74rem', color: '#f8fafc', fontWeight: 600 }}>
                                  {r.planner_name.split(':')[1]?.trim() || r.planner_name}
                                </span>
                              </div>
                            </td>

                            {/* Run ID */}
                            <td style={{ padding: '0.65rem 0.75rem', fontFamily: 'monospace', color: '#94a3b8', fontSize: '0.72rem' }}>
                              {r.id}
                            </td>

                            {/* Outcome Badge */}
                            <td style={{ padding: '0.65rem 0.75rem' }}>
                              {isSafe ? (
                                <span
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.3rem',
                                    padding: '0.2rem 0.55rem',
                                    borderRadius: '4px',
                                    background: 'rgba(16, 185, 129, 0.15)',
                                    color: '#10b981',
                                    fontWeight: 700,
                                    fontSize: '0.72rem',
                                    border: '1px solid rgba(16, 185, 129, 0.3)',
                                  }}
                                >
                                  <CheckCircle size={13} />
                                  <span>SAFE</span>
                                </span>
                              ) : (
                                <span
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.3rem',
                                    padding: '0.2rem 0.55rem',
                                    borderRadius: '4px',
                                    background: 'rgba(239, 68, 68, 0.15)',
                                    color: '#ef4444',
                                    fontWeight: 700,
                                    fontSize: '0.72rem',
                                    border: '1px solid rgba(239, 68, 68, 0.3)',
                                  }}
                                >
                                  <AlertTriangle size={13} />
                                  <span>COLLISION</span>
                                </span>
                              )}
                            </td>

                            {/* Min Clearance */}
                            <td style={{ padding: '0.65rem 0.75rem', fontFamily: 'monospace', fontWeight: 600, color: (r.min_clearance_m ?? 0) > 1.0 ? '#10b981' : (r.min_clearance_m ?? 0) > 0 ? '#f59e0b' : '#ef4444' }}>
                              {r.min_clearance_m !== null ? `${r.min_clearance_m.toFixed(2)} m` : <span style={{ color: '#64748b' }}>N/A (unrecorded)</span>}
                            </td>

                            {/* Path Length */}
                            <td style={{ padding: '0.65rem 0.75rem', fontFamily: 'monospace' }}>
                              {r.path_length_m !== null ? `${r.path_length_m.toFixed(1)} m` : <span style={{ color: '#64748b' }}>N/A</span>}
                            </td>

                            {/* Mean Speed */}
                            <td style={{ padding: '0.65rem 0.75rem', fontFamily: 'monospace' }}>
                              {r.mean_speed_m_s !== null ? `${r.mean_speed_m_s.toFixed(2)} m/s` : <span style={{ color: '#64748b' }}>N/A</span>}
                            </td>

                            {/* Replans */}
                            <td style={{ padding: '0.65rem 0.75rem', fontFamily: 'monospace' }}>
                              {r.replan_count !== null ? r.replan_count : <span style={{ color: '#64748b' }}>N/A</span>}
                            </td>

                            {/* Duration */}
                            <td style={{ padding: '0.65rem 0.75rem', fontFamily: 'monospace' }}>
                              {r.duration_s !== null ? `${r.duration_s.toFixed(1)} s` : <span style={{ color: '#64748b' }}>N/A</span>}
                            </td>

                            {/* Action Button */}
                            <td style={{ padding: '0.65rem 1rem', textAlign: 'right' }}>
                              <button
                                onClick={() => navigate(`/app/runs/${r.id}`)}
                                style={{
                                  background: 'rgba(56, 189, 248, 0.12)',
                                  border: '1px solid rgba(56, 189, 248, 0.3)',
                                  color: '#38bdf8',
                                  borderRadius: '5px',
                                  padding: '0.3rem 0.65rem',
                                  fontSize: '0.72rem',
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.35rem',
                                  transition: 'all 0.15s ease',
                                }}
                              >
                                <PlayCircle size={13} />
                                <span>Inspect Run</span>
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
