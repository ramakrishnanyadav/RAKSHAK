/**
 * What Went Wrong - Plain-English Incident Attribution Workspace (Route: /app/failures).
 * Stage 4G.7 Redesign: Audience-friendly failure explanation, 4 summary cards,
 * human-readable event log, and 6-question structured drilldown with jump to replay.
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  Play,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Clock,
  Eye,
  ShieldAlert,
  Car,
  ChevronRight,
  ArrowRight,
  X,
  Target,
  Zap,
} from 'lucide-react';
import { AccessibleTable, ColumnDef } from '../components/AccessibleTable';
import { useI18n } from '../context/I18nContext';

interface FailureIncident {
  id: string;
  runId: string;
  scenarioName: string;
  scenarioId: string;
  category: 'Late Detection' | 'Blind Spot Hazard' | 'Speed Mismatch' | 'Delayed Braking';
  whatHappened: string;
  criticalTimeS: number;
  closestDistanceM: number;
  // 6-Question Drilldown Details
  q1VehicleState: string;
  q2Hazard: string;
  q3SensorPerception: string;
  q4PlannerDecision: string;
  q5VehicleResponse: string;
  q6WhyItFailed: string;
}

const INCIDENTS: FailureIncident[] = [
  {
    id: 'inc-01',
    runId: 'run_scenario_5_cattle_crossing_b1_tune_s1000',
    scenarioName: 'Sudden Cattle Crossing',
    scenarioId: 'SCENARIO_5_CATTLE_CROSSING',
    category: 'Blind Spot Hazard',
    whatHappened: 'Cattle stepped into driving lane unexpectedly; vehicle could not stop in time.',
    criticalTimeS: 3.4,
    closestDistanceM: 0.0,
    q1VehicleState: 'Traveling at 42 km/h in straight lane under clear conditions.',
    q2Hazard: 'Indian Zebu cow stepped into the ego lane from behind roadside vegetation at 2.4 m/s.',
    q3SensorPerception: 'Object detected by LiDAR at 18 meters; tracked as dynamic crossing target.',
    q4PlannerDecision: 'Baseline VO planned swerve, but adjacent lane was blocked by oncoming rural bus.',
    q5VehicleResponse: 'Applied 4.5 m/s² braking, but stopping distance required exceeded available gap.',
    q6WhyItFailed: 'Lack of multi-hypothesis deceleration buffer caused late transition to full emergency braking.',
  },
  {
    id: 'inc-02',
    runId: 'run_scenario_5_cattle_crossing_p1_tune_s1000',
    scenarioName: 'Sudden Cattle Crossing',
    scenarioId: 'SCENARIO_5_CATTLE_CROSSING',
    category: 'Late Detection',
    whatHappened: 'Cattle abruptly halted in road centre; vehicle grazed hazard during avoidance maneuver.',
    criticalTimeS: 4.1,
    closestDistanceM: 0.12,
    q1VehicleState: 'Approaching village bend at 35 km/h.',
    q2Hazard: 'Cattle started walking, then suddenly halted mid-lane when headlights illuminated it.',
    q3SensorPerception: 'Initial trajectory assumed continuous crossing motion (CTRV linear model).',
    q4PlannerDecision: 'Planned left swerve assuming cattle would clear lane; cattle halted instead.',
    q5VehicleResponse: 'Replanned swerve trajectory, clearing primary body with 0.12m bumper margin.',
    q6WhyItFailed: 'Deterministic motion prediction failed to anticipate sudden stationary pause of live animal.',
  },
  {
    id: 'inc-03',
    runId: 'run_scenario_4_dense_market_b1_tune_s1000',
    scenarioName: 'Dense Market Street',
    scenarioId: 'SCENARIO_4_DENSE_MARKET',
    category: 'Blind Spot Hazard',
    whatHappened: 'Pedestrian stepped out between parked auto rickshaws; vehicle stopped abruptly.',
    criticalTimeS: 2.8,
    closestDistanceM: 0.35,
    q1VehicleState: 'Crawling through narrow marketplace corridor at 22 km/h.',
    q2Hazard: 'Pedestrian stepped into path between two parked auto rickshaws without warning.',
    q3SensorPerception: 'LiDAR point cloud occluded by rickshaw canopy until pedestrian was 6m away.',
    q4PlannerDecision: 'Emergency stop commanded immediately upon perception confidence exceeding 80%.',
    q5VehicleResponse: 'ABS triggered at maximum deceleration (6.8 m/s²). Vehicle halted with 0.35m clearance.',
    q6WhyItFailed: 'No occlusion risk-field prior was active; vehicle maintained normal cruising speed near blind spots.',
  },
  {
    id: 'inc-04',
    runId: 'run_scenario_2_urban_intersection_b1_tune_s1000',
    scenarioName: 'Busy Urban Intersection',
    scenarioId: 'SCENARIO_2_URBAN_INTERSECTION',
    category: 'Speed Mismatch',
    whatHappened: 'Two-wheeler cut directly across vehicle nose; triggered heavy panic braking.',
    criticalTimeS: 3.1,
    closestDistanceM: 0.48,
    q1VehicleState: 'Entering 4-way unsignalized junction at 28 km/h.',
    q2Hazard: 'Two-wheeler swerved across intersection from lateral blind angle at high relative speed.',
    q3SensorPerception: 'Two-wheeler tracked with 82% certainty, but trajectory angle changed mid-turn.',
    q4PlannerDecision: 'Yield commanded with evasive steering bias toward left curb.',
    q5VehicleResponse: 'Steered left and dropped speed to 8 km/h, safely averting collision with 0.48m margin.',
    q6WhyItFailed: 'Junction approach speed was too aggressive for an unstructured, unsignalized intersection.',
  },
];

export const FailuresView: React.FC = () => {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [selectedIncident, setSelectedIncident] = useState<FailureIncident | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');

  const filteredIncidents = categoryFilter === 'ALL'
    ? INCIDENTS
    : INCIDENTS.filter((i) => i.category === categoryFilter);

  const categories = ['ALL', 'Late Detection', 'Blind Spot Hazard', 'Speed Mismatch', 'Delayed Braking'];

  const columns: ColumnDef<FailureIncident>[] = [
    {
      key: 'scenarioName',
      header: 'Scenario',
      sortable: true,
      render: (r) => (
        <div>
          <div style={{ fontWeight: 700, color: '#f8fafc', fontSize: '0.9rem' }}>{r.scenarioName}</div>
          <span
            style={{
              display: 'inline-block',
              marginTop: '3px',
              fontSize: '0.7rem',
              fontWeight: 600,
              padding: '1px 6px',
              borderRadius: '4px',
              background: 'rgba(239, 68, 68, 0.15)',
              color: '#f87171',
              border: '1px solid rgba(239, 68, 68, 0.3)',
            }}
          >
            {r.category}
          </span>
        </div>
      ),
    },
    {
      key: 'whatHappened',
      header: 'What Happened',
      render: (r) => (
        <span style={{ fontSize: '0.85rem', color: '#cbd5e1', lineHeight: 1.5 }}>
          {r.whatHappened}
        </span>
      ),
    },
    {
      key: 'criticalTimeS',
      header: 'When',
      sortable: true,
      render: (r) => (
        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#38bdf8', fontSize: '0.85rem' }}>
          {r.criticalTimeS.toFixed(1)}s
        </span>
      ),
    },
    {
      key: 'closestDistanceM',
      header: 'Closest Distance',
      sortable: true,
      render: (r) => (
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontWeight: 800,
            fontSize: '0.85rem',
            color: r.closestDistanceM === 0 ? '#ef4444' : r.closestDistanceM < 0.3 ? '#f97316' : '#eab308',
          }}
        >
          {r.closestDistanceM.toFixed(2)} m
        </span>
      ),
    },
    {
      key: 'action',
      header: 'Actions',
      render: (r) => (
        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
          <button
            onClick={() => setSelectedIncident(r)}
            className="btn-secondary"
            style={{
              padding: '0.35rem 0.65rem',
              fontSize: '0.75rem',
              fontWeight: 700,
              borderRadius: '6px',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
            }}
            title="Open 6-question incident breakdown"
          >
            <HelpCircle size={13} color="#38bdf8" />
            <span>Why It Happened</span>
          </button>

          <button
            onClick={() => navigate(`/app/workstation?scenario=${r.scenarioId}`)}
            className="btn-primary"
            style={{
              padding: '0.35rem 0.65rem',
              fontSize: '0.75rem',
              fontWeight: 700,
              borderRadius: '6px',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              background: 'linear-gradient(135deg, #0284c7, #38bdf8)',
              color: '#04111d',
            }}
            title="Inspect 3D simulation at incident moment"
          >
            <Play size={12} fill="#04111d" />
            <span>Watch Replay</span>
          </button>
        </div>
      ),
    },
  ];

  return (
    <div style={{ padding: '1.75rem', maxWidth: '1280px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
      {/* Title & Introduction */}
      <div>
        <h1
          style={{
            fontSize: '2rem',
            fontWeight: 900,
            margin: '0 0 0.35rem',
            letterSpacing: '-0.03em',
            display: 'flex',
            alignItems: 'center',
            gap: '0.65rem',
            background: 'linear-gradient(135deg, #f87171 0%, #f97316 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          <AlertTriangle size={26} color="#f87171" style={{ WebkitTextFillColor: 'initial' }} />
          What Went Wrong
        </h1>
        <p style={{ color: '#94a3b8', fontSize: '0.92rem', margin: 0, maxWidth: '720px' }}>
          Understand why a test failed and how the vehicle responded. Every recorded near-miss and collision is broken down into simple, transparent questions.
        </p>
      </div>

      {/* 4 Summary Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '1rem',
        }}
      >
        {/* Card 1: Total Failed Tests */}
        <div
          className="glass-panel"
          style={{
            padding: '1.2rem',
            borderRadius: '10px',
            border: '1px solid rgba(239, 68, 68, 0.25)',
            background: 'rgba(239, 68, 68, 0.05)',
          }}
        >
          <div style={{ fontSize: '0.75rem', color: '#f87171', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Total Failed Tests
          </div>
          <div style={{ fontSize: '2.2rem', fontWeight: 900, color: '#f8fafc', marginTop: '0.25rem' }}>
            {INCIDENTS.length}
          </div>
          <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '0.2rem' }}>
            Out of 50 multi-seed benchmark runs
          </div>
        </div>

        {/* Card 2: Main Causes */}
        <div
          className="glass-panel"
          style={{
            padding: '1.2rem',
            borderRadius: '10px',
            border: '1px solid rgba(249, 115, 22, 0.25)',
            background: 'rgba(249, 115, 22, 0.05)',
          }}
        >
          <div style={{ fontSize: '0.75rem', color: '#fb923c', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Main Causes
          </div>
          <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#f8fafc', marginTop: '0.4rem' }}>
            Blind Spots & Animal Pauses
          </div>
          <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '0.35rem' }}>
            Cattle halting unexpectedly & hidden pedestrians
          </div>
        </div>

        {/* Card 3: Scenarios Affected */}
        <div
          className="glass-panel"
          style={{
            padding: '1.2rem',
            borderRadius: '10px',
            border: '1px solid rgba(56, 189, 248, 0.25)',
            background: 'rgba(56, 189, 248, 0.05)',
          }}
        >
          <div style={{ fontSize: '0.75rem', color: '#38bdf8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Scenarios Affected
          </div>
          <div style={{ fontSize: '2.2rem', fontWeight: 900, color: '#f8fafc', marginTop: '0.25rem' }}>
            3
          </div>
          <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '0.2rem' }}>
            Cattle Crossing, Market, Urban Junction
          </div>
        </div>

        {/* Card 4: Tests Needing Attention */}
        <div
          className="glass-panel"
          style={{
            padding: '1.2rem',
            borderRadius: '10px',
            border: '1px solid rgba(168, 85, 247, 0.25)',
            background: 'rgba(168, 85, 247, 0.05)',
          }}
        >
          <div style={{ fontSize: '0.75rem', color: '#c084fc', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Tests Needing Attention
          </div>
          <div style={{ fontSize: '2.2rem', fontWeight: 900, color: '#f8fafc', marginTop: '0.25rem' }}>
            1
          </div>
          <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '0.2rem' }}>
            Zero-clearance collision on Baseline B1
          </div>
        </div>
      </div>

      {/* Category Filter Chips */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              style={{
                padding: '0.4rem 0.85rem',
                borderRadius: '8px',
                fontSize: '0.78rem',
                fontWeight: 700,
                border: categoryFilter === cat ? '1px solid #38bdf8' : '1px solid rgba(255, 255, 255, 0.1)',
                background: categoryFilter === cat ? 'rgba(56, 189, 248, 0.15)' : 'rgba(15, 23, 42, 0.6)',
                color: categoryFilter === cat ? '#38bdf8' : '#94a3b8',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              {cat}
            </button>
          ))}
        </div>

        <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
          Showing {filteredIncidents.length} of {INCIDENTS.length} incidents
        </div>
      </div>

      {/* Human-Readable Incidents Table */}
      <div className="glass-panel" style={{ padding: '1.25rem', borderRadius: '12px' }}>
        <AccessibleTable
          caption="Detailed log of benchmark incidents, root causes, closest clearances, and investigation links"
          summary="Lists all failed tests and near-misses with what happened, the critical timestamp, closest distance, and investigation options"
          columns={columns}
          data={filteredIncidents}
          keyField="id"
        />
      </div>

      {/* 6-Question Event Drilldown Modal */}
      {selectedIncident && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="drilldown-title"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.8)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1.5rem',
            zIndex: 9999,
          }}
          onClick={() => setSelectedIncident(null)}
        >
          <div
            className="glass-panel"
            style={{
              width: '100%',
              maxWidth: '680px',
              maxHeight: '90vh',
              overflowY: 'auto',
              borderRadius: '14px',
              border: '1px solid rgba(56, 189, 248, 0.3)',
              background: '#0d1322',
              padding: '1.75rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.25rem',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '1rem' }}>
              <div>
                <div style={{ fontSize: '0.75rem', color: '#f87171', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Incident Breakdown
                </div>
                <h2 id="drilldown-title" style={{ fontSize: '1.35rem', fontWeight: 800, color: '#f8fafc', margin: '0.25rem 0 0' }}>
                  {selectedIncident.scenarioName}
                </h2>
                <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '0.2rem' }}>
                  Category: <strong style={{ color: '#cbd5e1' }}>{selectedIncident.category}</strong> • Critical Time: <strong style={{ color: '#38bdf8' }}>{selectedIncident.criticalTimeS}s</strong>
                </div>
              </div>

              <button
                onClick={() => setSelectedIncident(null)}
                aria-label="Close modal"
                style={{
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '0.4rem',
                  color: '#94a3b8',
                  cursor: 'pointer',
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* 6 Structured Plain-English Questions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              {/* Q1 */}
              <div style={{ background: 'rgba(15, 23, 42, 0.7)', padding: '0.85rem 1rem', borderRadius: '8px', borderLeft: '3px solid #38bdf8' }}>
                <div style={{ fontSize: '0.75rem', color: '#38bdf8', fontWeight: 700 }}>
                  1. What was the vehicle doing?
                </div>
                <div style={{ fontSize: '0.85rem', color: '#e2e8f0', marginTop: '0.25rem', lineHeight: 1.5 }}>
                  {selectedIncident.q1VehicleState}
                </div>
              </div>

              {/* Q2 */}
              <div style={{ background: 'rgba(15, 23, 42, 0.7)', padding: '0.85rem 1rem', borderRadius: '8px', borderLeft: '3px solid #f97316' }}>
                <div style={{ fontSize: '0.75rem', color: '#fb923c', fontWeight: 700 }}>
                  2. What hazard appeared?
                </div>
                <div style={{ fontSize: '0.85rem', color: '#e2e8f0', marginTop: '0.25rem', lineHeight: 1.5 }}>
                  {selectedIncident.q2Hazard}
                </div>
              </div>

              {/* Q3 */}
              <div style={{ background: 'rgba(15, 23, 42, 0.7)', padding: '0.85rem 1rem', borderRadius: '8px', borderLeft: '3px solid #a855f7' }}>
                <div style={{ fontSize: '0.75rem', color: '#c084fc', fontWeight: 700 }}>
                  3. What did the sensor see?
                </div>
                <div style={{ fontSize: '0.85rem', color: '#e2e8f0', marginTop: '0.25rem', lineHeight: 1.5 }}>
                  {selectedIncident.q3SensorPerception}
                </div>
              </div>

              {/* Q4 */}
              <div style={{ background: 'rgba(15, 23, 42, 0.7)', padding: '0.85rem 1rem', borderRadius: '8px', borderLeft: '3px solid #3b82f6' }}>
                <div style={{ fontSize: '0.75rem', color: '#60a5fa', fontWeight: 700 }}>
                  4. What did the planner decide?
                </div>
                <div style={{ fontSize: '0.85rem', color: '#e2e8f0', marginTop: '0.25rem', lineHeight: 1.5 }}>
                  {selectedIncident.q4PlannerDecision}
                </div>
              </div>

              {/* Q5 */}
              <div style={{ background: 'rgba(15, 23, 42, 0.7)', padding: '0.85rem 1rem', borderRadius: '8px', borderLeft: '3px solid #eab308' }}>
                <div style={{ fontSize: '0.75rem', color: '#facc15', fontWeight: 700 }}>
                  5. What was the vehicle's response?
                </div>
                <div style={{ fontSize: '0.85rem', color: '#e2e8f0', marginTop: '0.25rem', lineHeight: 1.5 }}>
                  {selectedIncident.q5VehicleResponse}
                </div>
              </div>

              {/* Q6 */}
              <div style={{ background: 'rgba(15, 23, 42, 0.7)', padding: '0.85rem 1rem', borderRadius: '8px', borderLeft: '3px solid #ef4444' }}>
                <div style={{ fontSize: '0.75rem', color: '#f87171', fontWeight: 700 }}>
                  6. Why did it fail?
                </div>
                <div style={{ fontSize: '0.85rem', color: '#e2e8f0', marginTop: '0.25rem', lineHeight: 1.5 }}>
                  {selectedIncident.q6WhyItFailed}
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', paddingTop: '0.5rem', borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
              <button
                onClick={() => setSelectedIncident(null)}
                className="btn-secondary"
                style={{ padding: '0.55rem 1rem', borderRadius: '8px', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer' }}
              >
                Close
              </button>

              <button
                onClick={() => {
                  const scId = selectedIncident.scenarioId;
                  setSelectedIncident(null);
                  navigate(`/app/workstation?scenario=${scId}`);
                }}
                className="btn-primary"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.55rem 1.25rem',
                  borderRadius: '8px',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  background: 'linear-gradient(135deg, #0284c7, #38bdf8)',
                  color: '#04111d',
                  cursor: 'pointer',
                }}
              >
                <Play size={14} fill="#04111d" />
                <span>Jump to 3D Replay at {selectedIncident.criticalTimeS}s</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
