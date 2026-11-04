/**
 * Guided Three-Step Simulation Preparation Experience (Route: /app/runs/new).
 * 
 * STEP 1: Choose an Environment (5 Canonical Scenarios from backend registry)
 * STEP 2: Choose a Driving Strategy (Simple Mode with P3 Adaptive vs B0 Baseline;
 *         Research Mode exposing all 6 authentic planners: B0, B1, B2, P1, P2, P3)
 * STEP 3: Review and Start (Configuration review, seed validation, real simulation launch)
 */

import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAnnouncer } from '../components/LiveAnnouncer';
import { usePresentationMode } from '../context/SettingsContext';
import { BENCHMARK_SCENARIOS, LEGACY_SCENARIO_COMPATIBILITY_MAP } from './Scenarios';
import {
  PlayCircle,
  Cpu,
  Sliders,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ArrowRight,
  ArrowLeft,
  ShieldAlert,
  Sparkles,
  Compass,
  Check,
  ChevronDown,
  ChevronUp,
  FlaskConical,
  Settings,
  Car,
} from 'lucide-react';
import { apiClient } from '../api/client';

export interface PlannerDefinition {
  id: string;
  name: string;
  shortDescription: string;
  category: 'adaptive' | 'research' | 'baseline';
  algorithmType: string;
  experimentalPurpose: string;
  everydayExplanation: string;
  recommended?: boolean;
}

export const CANONICAL_PLANNERS: PlannerDefinition[] = [
  {
    id: 'P3',
    name: 'P3: Adaptive Multi-Path Replanner',
    shortDescription: 'Multi-hypothesis predictive replanning with 95% conformal safety bounds and contingency fallbacks.',
    category: 'adaptive',
    algorithmType: 'Risk-Aware Adaptive Replanning',
    experimentalPurpose: 'Evaluates adaptive trajectory replanning under severe multi-agent uncertainty and sudden lateral incursions.',
    everydayExplanation: 'Our smart driving system. When an animal or vehicle unexpectedly swerves into the road, P3 forecasts where it could go, calculates the safest detour around it, and smoothly steers clear while staying on the road.',
    recommended: true,
  },
  {
    id: 'P2',
    name: 'P2: Risk-Field Optimal Trajectory Planner',
    shortDescription: 'Continuous trajectory optimization over smooth spatiotemporal risk potential fields.',
    category: 'research',
    algorithmType: 'Risk Potential Field Optimization',
    experimentalPurpose: 'Ablation study isolating the benefit of continuous risk potential fields versus discrete combinatorial replanning.',
    everydayExplanation: 'Treats hazards like repulsive magnetic fields to steer the vehicle along the lowest-risk valley in the road.',
  },
  {
    id: 'P1',
    name: 'P1: Spatiotemporal Predictive Lattice Planner',
    shortDescription: 'Discrete trajectory rollouts evaluated against deterministic obstacle extrapolation.',
    category: 'research',
    algorithmType: 'Spatiotemporal Frenet Lattice',
    experimentalPurpose: 'Evaluates classical predictive lattice planning with constant velocity obstacle assumptions without conformal bounds.',
    everydayExplanation: 'Generates a fan of pre-calculated candidate driving paths and picks the one with the lowest predicted collision score.',
  },
  {
    id: 'B2',
    name: 'B2: Kinematic Hybrid A* Search',
    shortDescription: 'Non-holonomic path search obeying minimum turning radius and geometric clearance.',
    category: 'baseline',
    algorithmType: 'Kinematic Hybrid A* (Search-based)',
    experimentalPurpose: 'Serves as the kinematic search baseline, testing whether global geometric search alone is sufficient without dynamic risk modeling.',
    everydayExplanation: 'A robotic maze-solving algorithm adapted for cars. Finds collision-free paths geometrically without anticipating how other road users will move.',
  },
  {
    id: 'B1',
    name: 'B1: Dynamic Window Approach + Velocity Obstacles (DWA-VO)',
    shortDescription: 'Reactive velocity-space collision avoidance sampling forward circular arcs.',
    category: 'baseline',
    algorithmType: 'Reactive Velocity Space (DWA-VO)',
    experimentalPurpose: 'Evaluates purely reactive local velocity avoidance without long-horizon corridor planning.',
    everydayExplanation: 'A reactive system that samples steering and speed adjustments each split second, braking or nudging away from imminent collisions.',
  },
  {
    id: 'B0',
    name: 'B0: Shortest Path / Constant Speed Baseline',
    shortDescription: 'Maintains centerline corridor path at target speed with hard emergency braking upon imminent collision.',
    category: 'baseline',
    algorithmType: 'Geometric Tracking (Naive Baseline)',
    experimentalPurpose: 'The primary zero-adaptation baseline. Quantifies the raw failure rate of standard non-adaptive road following in Indian conditions.',
    everydayExplanation: 'A simple baseline car that drives straight along the road center at fixed speed. It does not detour around obstacles, only braking at the last second to avoid a direct crash.',
  },
];

export const NewRun: React.FC = () => {
  const [searchParams] = useSearchParams();
  const rawScenario = searchParams.get('scenario') || 'SCENARIO_5_CATTLE_CROSSING';
  const initialScenario = LEGACY_SCENARIO_COMPATIBILITY_MAP[rawScenario] || rawScenario;

  const navigate = useNavigate();
  const { announce } = useAnnouncer();

  // Three-Step Workflow State
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);

  // STEP 1: Selected Scenario
  const [scenarioId, setScenarioId] = useState<string>(initialScenario);

  // STEP 2: Driving Strategy & Mode (Synced with Global Presentation Level)
  const { presentationMode, setPresentationMode } = usePresentationMode();
  const strategyMode = presentationMode;
  const setStrategyMode = (mode: 'simple' | 'research') => setPresentationMode(mode);
  const [plannerId, setPlannerId] = useState<string>('P3');

  // STEP 3: Configuration & Hyperparameters
  const [seed, setSeed] = useState<number>(1000);
  const [split, setSplit] = useState<string>('test');
  const [engineAdapter, setEngineAdapter] = useState<'python_inprocess' | 'matlab_roadrunner'>('python_inprocess');
  const [conformalAlpha, setConformalAlpha] = useState<number>(0.05);
  const [riskThreshold, setRiskThreshold] = useState<number>(0.65);
  const [showAdvancedParams, setShowAdvancedParams] = useState<boolean>(false);

  // Execution, Submission & Validation State
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // Active Selected Objects
  const selectedScenario = BENCHMARK_SCENARIOS.find((s) => s.id === scenarioId) || BENCHMARK_SCENARIOS[4];
  const selectedPlanner = CANONICAL_PLANNERS.find((p) => p.id === plannerId) || CANONICAL_PLANNERS[0];

  // Step 1 Validation & Next
  const handleNextFromStep1 = () => {
    if (!scenarioId) {
      setValidationErrors({ scenario: 'Please select an environment to continue.' });
      return;
    }
    setValidationErrors({});
    setCurrentStep(2);
    announce('Navigated to Step 2: Choose Driving Strategy', 'polite');
  };

  // Step 2 Validation & Next
  const handleNextFromStep2 = () => {
    if (!plannerId) {
      setValidationErrors({ planner: 'Please select a driving strategy to continue.' });
      return;
    }
    setValidationErrors({});
    setCurrentStep(3);
    announce('Navigated to Step 3: Review and Start Simulation', 'polite');
  };

  // Step 3 Submission
  const handleLaunch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    // Client-side Validation
    const errors: Record<string, string> = {};
    if (!seed || isNaN(seed) || seed < 1 || seed > 999999) {
      errors.seed = 'Random seed must be a positive integer between 1 and 999,999.';
    }
    if (!scenarioId) {
      errors.scenario = 'Please select a road environment.';
    }
    if (!plannerId) {
      errors.planner = 'Please select a driving strategy.';
    }

    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }

    setValidationErrors({});
    setIsSubmitting(true);
    setErrorMsg(null);
    setStatusMessage('Enqueuing simulation job in engine queue...');

    try {
      const resp = await apiClient.createRun({
        scenario_id: scenarioId,
        planner_id: plannerId,
        engine_adapter: engineAdapter,
        split: split,
        seed: Number(seed),
        scenario_params: {
          conformal_coverage_alpha: conformalAlpha,
          risk_threshold: riskThreshold,
        },
      });

      setStatusMessage(`Simulation launched successfully! Run ID: ${resp.id}`);
      announce(`Simulation launched successfully for ${scenarioId} with planner ${plannerId}`, 'polite');

      // Navigate to live run replay
      setTimeout(() => {
        navigate(`/app/runs/${resp.id}`);
      }, 700);
    } catch (err: any) {
      const message = err?.message || 'Unable to connect to simulation engine. Verify backend is running.';
      setErrorMsg(`Simulation Launch Failed: ${message}`);
      setStatusMessage(null);
      announce(`Simulation launch failed: ${message}`, 'assertive');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ padding: '1.5rem', maxWidth: '960px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
      {/* Header */}
      <div>
        <h1 style={{ fontSize: '1.85rem', fontWeight: 800, margin: '0 0 0.35rem' }}>
          Prepare Simulation Run
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', margin: 0 }}>
          Follow 3 simple steps to select a road environment, choose a driving strategy, and launch a real simulation test drive.
        </p>
      </div>

      {/* Progress Indicator (Breadcrumbs / Steps) */}
      <nav aria-label="Simulation preparation steps" className="glass-panel" style={{ padding: '1rem 1.25rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', alignItems: 'center' }}>
          {/* Step 1 Pill */}
          <button
            type="button"
            onClick={() => setCurrentStep(1)}
            aria-current={currentStep === 1 ? 'step' : undefined}
            style={{
              background: 'transparent',
              border: 'none',
              padding: '0.4rem 0.6rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.65rem',
              cursor: 'pointer',
              textAlign: 'left',
              borderBottom: currentStep === 1 ? '3px solid var(--accent-primary)' : '3px solid transparent',
              opacity: currentStep === 1 ? 1 : 0.75,
              transition: 'all 0.15s ease',
            }}
          >
            <div
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                background: currentStep > 1 ? 'var(--status-success)' : currentStep === 1 ? 'var(--accent-primary)' : 'var(--bg-surface-elevated)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.85rem',
                fontWeight: 700,
                flexShrink: 0,
              }}
            >
              {currentStep > 1 ? <Check size={16} /> : '1'}
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-secondary)', fontWeight: 700 }}>
                Step 1
              </div>
              <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                Environment
              </div>
            </div>
          </button>

          {/* Step 2 Pill */}
          <button
            type="button"
            onClick={() => setCurrentStep(2)}
            aria-current={currentStep === 2 ? 'step' : undefined}
            style={{
              background: 'transparent',
              border: 'none',
              padding: '0.4rem 0.6rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.65rem',
              cursor: 'pointer',
              textAlign: 'left',
              borderBottom: currentStep === 2 ? '3px solid var(--accent-primary)' : '3px solid transparent',
              opacity: currentStep === 2 ? 1 : currentStep > 2 ? 0.75 : 0.6,
              transition: 'all 0.15s ease',
            }}
          >
            <div
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                background: currentStep > 2 ? 'var(--status-success)' : currentStep === 2 ? 'var(--accent-primary)' : 'var(--bg-surface-elevated)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.85rem',
                fontWeight: 700,
                flexShrink: 0,
              }}
            >
              {currentStep > 2 ? <Check size={16} /> : '2'}
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-secondary)', fontWeight: 700 }}>
                Step 2
              </div>
              <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                Driving Strategy
              </div>
            </div>
          </button>

          {/* Step 3 Pill */}
          <button
            type="button"
            onClick={() => setCurrentStep(3)}
            aria-current={currentStep === 3 ? 'step' : undefined}
            style={{
              background: 'transparent',
              border: 'none',
              padding: '0.4rem 0.6rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.65rem',
              cursor: 'pointer',
              textAlign: 'left',
              borderBottom: currentStep === 3 ? '3px solid var(--accent-primary)' : '3px solid transparent',
              opacity: currentStep === 3 ? 1 : 0.6,
              transition: 'all 0.15s ease',
            }}
          >
            <div
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                background: currentStep === 3 ? 'var(--accent-primary)' : 'var(--bg-surface-elevated)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.85rem',
                fontWeight: 700,
                flexShrink: 0,
              }}
            >
              3
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-secondary)', fontWeight: 700 }}>
                Step 3
              </div>
              <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                Review & Start
              </div>
            </div>
          </button>
        </div>
      </nav>

      {/* Status or Error Alerts */}
      {statusMessage && (
        <div
          role="status"
          style={{
            background: 'rgba(59, 130, 246, 0.12)',
            border: '1px solid rgba(59, 130, 246, 0.3)',
            borderRadius: 'var(--radius-sm)',
            padding: '0.85rem 1rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.65rem',
            color: 'var(--accent-primary)',
            fontSize: '0.9rem',
          }}
        >
          <RefreshCw size={18} className="spin-animation" />
          <span>{statusMessage}</span>
        </div>
      )}

      {errorMsg && (
        <div
          role="alert"
          style={{
            background: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid var(--risk-critical)',
            borderRadius: 'var(--radius-sm)',
            padding: '1rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
            color: 'var(--risk-critical)',
            fontSize: '0.9rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <AlertCircle size={20} />
            <strong style={{ fontSize: '0.95rem' }}>{errorMsg}</strong>
          </div>
          <p style={{ margin: 0, color: 'var(--text-primary)', fontSize: '0.85rem', lineHeight: 1.4 }}>
            The simulation could not be queued because the backend engine service is not reachable or rejected the request.
            You can retry the launch or inspect a verified pre-bundled run trace in offline mode.
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.25rem' }}>
            <button
              type="button"
              onClick={() => handleLaunch()}
              className="btn-secondary"
              style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem', minHeight: 'var(--min-target-size)' }}
            >
              Retry Simulation Launch
            </button>
            <button
              type="button"
              onClick={() => navigate('/app/runs/run_scenario_5_cattle_crossing_p3_tune_s1000')}
              className="btn-secondary"
              style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem', minHeight: 'var(--min-target-size)' }}
            >
              View Verified Reference Run (Cattle Crossing)
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* STEP 1: CHOOSE AN ENVIRONMENT                                             */}
      {/* ========================================================================= */}
      {currentStep === 1 && (
        <section aria-label="Step 1: Choose an Environment" className="glass-panel" style={{ padding: '2rem' }}>
          <div style={{ marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
              <h2 style={{ fontSize: '1.35rem', fontWeight: 700, margin: 0 }}>
                Step 1: Choose a Road Environment
              </h2>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                5 Canonical Indian Road Scenarios
              </span>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: 0 }}>
              Select the road setting and traffic challenge you want to test the driving system in.
            </p>
          </div>

          {validationErrors.scenario && (
            <div role="alert" style={{ color: 'var(--risk-critical)', fontSize: '0.85rem', marginBottom: '1rem', fontWeight: 600 }}>
              {validationErrors.scenario}
            </div>
          )}

          {/* 5 Scenario Cards Grid */}
          <div
            role="radiogroup"
            aria-label="Road environments"
            style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem', marginBottom: '2rem' }}
          >
            {BENCHMARK_SCENARIOS.map((sc) => {
              const isSelected = scenarioId === sc.id;
              return (
                <div
                  key={sc.id}
                  role="radio"
                  aria-checked={isSelected}
                  tabIndex={0}
                  onClick={() => setScenarioId(sc.id)}
                  onKeyDown={(e) => {
                    if (e.key === ' ' || e.key === 'Enter') {
                      e.preventDefault();
                      setScenarioId(sc.id);
                    }
                  }}
                  style={{
                    padding: '1.15rem 1.25rem',
                    borderRadius: 'var(--radius-md)',
                    border: isSelected ? '2px solid var(--accent-primary)' : '1px solid var(--border-default)',
                    background: isSelected ? 'rgba(59, 130, 246, 0.08)' : 'var(--bg-surface)',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.5rem',
                    transition: 'all 0.15s ease',
                    boxShadow: isSelected ? '0 0 0 1px var(--accent-primary)' : 'none',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                      <input
                        type="radio"
                        name="scenario-selection"
                        id={`scenario-${sc.id}`}
                        checked={isSelected}
                        onChange={() => setScenarioId(sc.id)}
                        style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                        aria-label={sc.name}
                      />
                      <label htmlFor={`scenario-${sc.id}`} style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--text-primary)', cursor: 'pointer' }}>
                        {sc.name}
                      </label>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <span
                        style={{
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          padding: '0.2rem 0.55rem',
                          borderRadius: 'var(--radius-sm)',
                          background: 'var(--bg-surface-elevated)',
                          border: '1px solid var(--border-subtle)',
                          color: 'var(--text-secondary)',
                        }}
                      >
                        Road width: {sc.roadWidth}
                      </span>
                      <span
                        style={{
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          padding: '0.2rem 0.55rem',
                          borderRadius: 'var(--radius-sm)',
                          background: 'var(--bg-surface-elevated)',
                          border: '1px solid var(--border-subtle)',
                          color: 'var(--text-secondary)',
                        }}
                      >
                        {sc.speed}
                      </span>
                    </div>
                  </div>

                  <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.45, paddingLeft: '1.8rem' }}>
                    {sc.description}
                  </p>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', fontSize: '0.8rem', paddingLeft: '1.8rem', marginTop: '0.2rem' }}>
                    <div>
                      <strong style={{ color: 'var(--text-primary)' }}>Traffic challenge:</strong>{' '}
                      <span style={{ color: 'var(--text-secondary)' }}>{sc.trafficChallenge}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Navigation Action */}
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={handleNextFromStep1}
              className="btn-primary"
              style={{
                padding: '0.75rem 1.5rem',
                fontSize: '0.95rem',
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                minHeight: 'var(--min-target-size)',
              }}
            >
              <span>Continue to Driving Strategy</span>
              <ArrowRight size={18} />
            </button>
          </div>
        </section>
      )}

      {/* ========================================================================= */}
      {/* STEP 2: CHOOSE A DRIVING STRATEGY                                         */}
      {/* ========================================================================= */}
      {currentStep === 2 && (
        <section aria-label="Step 2: Choose a Driving Strategy" className="glass-panel" style={{ padding: '2rem' }}>
          <div style={{ marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
              <h2 style={{ fontSize: '1.35rem', fontWeight: 700, margin: 0 }}>
                Step 2: Choose a Driving Strategy
              </h2>
              {/* Simple Mode vs Research Mode Toggle */}
              <div
                style={{
                  display: 'flex',
                  background: 'var(--bg-surface-elevated)',
                  padding: '2px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-default)',
                }}
              >
                <button
                  type="button"
                  onClick={() => setStrategyMode('simple')}
                  style={{
                    padding: '0.35rem 0.75rem',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    borderRadius: 'var(--radius-sm)',
                    border: 'none',
                    background: strategyMode === 'simple' ? 'var(--accent-primary)' : 'transparent',
                    color: strategyMode === 'simple' ? '#ffffff' : 'var(--text-secondary)',
                    cursor: 'pointer',
                  }}
                >
                  Simple Mode
                </button>
                <button
                  type="button"
                  onClick={() => setStrategyMode('research')}
                  style={{
                    padding: '0.35rem 0.75rem',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    borderRadius: 'var(--radius-sm)',
                    border: 'none',
                    background: strategyMode === 'research' ? 'var(--accent-primary)' : 'transparent',
                    color: strategyMode === 'research' ? '#ffffff' : 'var(--text-secondary)',
                    cursor: 'pointer',
                  }}
                >
                  Research Mode (All 6 Planners)
                </button>
              </div>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: 0 }}>
              {strategyMode === 'simple'
                ? 'Compare our smart adaptive driving AI against a standard baseline car in everyday language.'
                : 'Select from all 6 actual planners tested in the benchmark. Compare mathematical models, search heuristics, and risk fields.'}
            </p>
          </div>

          {validationErrors.planner && (
            <div role="alert" style={{ color: 'var(--risk-critical)', fontSize: '0.85rem', marginBottom: '1rem', fontWeight: 600 }}>
              {validationErrors.planner}
            </div>
          )}

          {/* SIMPLE MODE: P3 vs B0 */}
          {strategyMode === 'simple' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2rem' }}>
              {/* Preserved Planner Notice from Research Mode */}
              {plannerId !== 'P3' && plannerId !== 'B0' && (
                <div
                  style={{
                    padding: '0.85rem 1.1rem',
                    borderRadius: 'var(--radius-sm)',
                    background: 'rgba(59, 130, 246, 0.1)',
                    border: '1px solid rgba(59, 130, 246, 0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '1rem',
                    flexWrap: 'wrap',
                  }}
                >
                  <div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--accent-primary)' }}>
                      Advanced Strategy Active: {selectedPlanner.id} ({selectedPlanner.name})
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      Preserved from Research Mode. The simulation will run this exact planner. Or switch to the recommended adaptive driving AI.
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPlannerId('P3')}
                    className="btn-primary"
                    style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}
                  >
                    Switch to Recommended P3
                  </button>
                </div>
              )}

              {/* Option 1: P3 (Adaptive AI - Recommended) */}
              <div
                role="radio"
                aria-checked={plannerId === 'P3'}
                tabIndex={0}
                onClick={() => setPlannerId('P3')}
                onKeyDown={(e) => {
                  if (e.key === ' ' || e.key === 'Enter') {
                    e.preventDefault();
                    setPlannerId('P3');
                  }
                }}
                style={{
                  padding: '1.25rem 1.5rem',
                  borderRadius: 'var(--radius-md)',
                  border: plannerId === 'P3' ? '2px solid var(--accent-primary)' : '1px solid var(--border-default)',
                  background: plannerId === 'P3' ? 'rgba(59, 130, 246, 0.08)' : 'var(--bg-surface)',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.65rem',
                  boxShadow: plannerId === 'P3' ? '0 0 0 1px var(--accent-primary)' : 'none',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                    <input
                      type="radio"
                      name="simple-planner"
                      id="planner-p3"
                      checked={plannerId === 'P3'}
                      onChange={() => setPlannerId('P3')}
                      style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                    />
                    <label htmlFor="planner-p3" style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--text-primary)', cursor: 'pointer' }}>
                      P3: Adaptive Strategy
                    </label>
                  </div>
                  <span
                    style={{
                      background: 'rgba(16, 185, 129, 0.15)',
                      color: 'var(--status-success)',
                      border: '1px solid var(--status-success)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '0.2rem 0.6rem',
                      fontSize: '0.75rem',
                      fontWeight: 800,
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                    }}
                  >
                    Recommended Adaptive AI
                  </span>
                </div>

                <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-primary)', lineHeight: 1.5, paddingLeft: '1.8rem' }}>
                  {CANONICAL_PLANNERS[0].everydayExplanation}
                </p>

                <div style={{ display: 'flex', gap: '0.5rem', paddingLeft: '1.8rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  <strong>How it works:</strong> Multi-hypothesis predictive replanning with 95% conformal safety bounds and contingency fallbacks.
                </div>
              </div>

              {/* Option 2: B0 (Standard Non-Adaptive Baseline) */}
              <div
                role="radio"
                aria-checked={plannerId === 'B0'}
                tabIndex={0}
                onClick={() => setPlannerId('B0')}
                onKeyDown={(e) => {
                  if (e.key === ' ' || e.key === 'Enter') {
                    e.preventDefault();
                    setPlannerId('B0');
                  }
                }}
                style={{
                  padding: '1.25rem 1.5rem',
                  borderRadius: 'var(--radius-md)',
                  border: plannerId === 'B0' ? '2px solid var(--accent-primary)' : '1px solid var(--border-default)',
                  background: plannerId === 'B0' ? 'rgba(59, 130, 246, 0.08)' : 'var(--bg-surface)',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.65rem',
                  boxShadow: plannerId === 'B0' ? '0 0 0 1px var(--accent-primary)' : 'none',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                    <input
                      type="radio"
                      name="simple-planner"
                      id="planner-b0"
                      checked={plannerId === 'B0'}
                      onChange={() => setPlannerId('B0')}
                      style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                    />
                    <label htmlFor="planner-b0" style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--text-primary)', cursor: 'pointer' }}>
                      B0: Direct Path Baseline
                    </label>
                  </div>
                  <span
                    style={{
                      background: 'var(--bg-surface-elevated)',
                      color: 'var(--text-secondary)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '0.2rem 0.6rem',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                    }}
                  >
                    Identified Non-Adaptive Baseline
                  </span>
                </div>

                <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-primary)', lineHeight: 1.5, paddingLeft: '1.8rem' }}>
                  {CANONICAL_PLANNERS[5].everydayExplanation}
                </p>

                <div style={{ display: 'flex', gap: '0.5rem', paddingLeft: '1.8rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  <strong>How it works:</strong> Geometric road-centerline tracking with fixed speed; relies on emergency braking when blocked.
                </div>
              </div>

              {/* Helper notice */}
              <div
                style={{
                  background: 'var(--bg-surface-elevated)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '0.85rem 1rem',
                  fontSize: '0.85rem',
                  color: 'var(--text-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <span>
                  Want to inspect all 6 algorithms (including Lattice P1, Potential Field P2, DWA B1, Hybrid A* B2)?
                </span>
                <button
                  type="button"
                  onClick={() => setStrategyMode('research')}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--accent-primary)',
                    fontWeight: 700,
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                  }}
                >
                  Switch to Research Mode →
                </button>
              </div>
            </div>
          )}

          {/* RESEARCH MODE: All 6 Canonical Planners */}
          {strategyMode === 'research' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', marginBottom: '2rem' }}>
              {CANONICAL_PLANNERS.map((p) => {
                const isSelected = plannerId === p.id;
                return (
                  <div
                    key={p.id}
                    role="radio"
                    aria-checked={isSelected}
                    tabIndex={0}
                    onClick={() => setPlannerId(p.id)}
                    onKeyDown={(e) => {
                      if (e.key === ' ' || e.key === 'Enter') {
                        e.preventDefault();
                        setPlannerId(p.id);
                      }
                    }}
                    style={{
                      padding: '1.15rem 1.25rem',
                      borderRadius: 'var(--radius-md)',
                      border: isSelected ? '2px solid var(--accent-primary)' : '1px solid var(--border-default)',
                      background: isSelected ? 'rgba(59, 130, 246, 0.08)' : 'var(--bg-surface)',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.45rem',
                      boxShadow: isSelected ? '0 0 0 1px var(--accent-primary)' : 'none',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                        <input
                          type="radio"
                          name="research-planner"
                          id={`planner-${p.id}`}
                          checked={isSelected}
                          onChange={() => setPlannerId(p.id)}
                          style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                        />
                        <label htmlFor={`planner-${p.id}`} style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--text-primary)', cursor: 'pointer' }}>
                          {p.name}
                        </label>
                      </div>

                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <span
                          style={{
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            padding: '0.2rem 0.5rem',
                            borderRadius: 'var(--radius-sm)',
                            background: p.category === 'adaptive' ? 'rgba(16, 185, 129, 0.15)' : 'var(--bg-surface-elevated)',
                            color: p.category === 'adaptive' ? 'var(--status-success)' : 'var(--text-secondary)',
                            border: '1px solid var(--border-subtle)',
                          }}
                        >
                          {p.algorithmType}
                        </span>
                        {p.recommended && (
                          <span
                            style={{
                              fontSize: '0.75rem',
                              fontWeight: 800,
                              padding: '0.2rem 0.5rem',
                              borderRadius: 'var(--radius-sm)',
                              background: 'var(--accent-primary)',
                              color: '#ffffff',
                            }}
                          >
                            RECOMMENDED
                          </span>
                        )}
                      </div>
                    </div>

                    <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.45, paddingLeft: '1.8rem' }}>
                      {p.shortDescription}
                    </p>

                    <div style={{ fontSize: '0.8rem', paddingLeft: '1.8rem', marginTop: '0.2rem' }}>
                      <strong style={{ color: 'var(--text-primary)' }}>Experimental Purpose:</strong>{' '}
                      <span style={{ color: 'var(--text-secondary)' }}>{p.experimentalPurpose}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Navigation Actions */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button
              type="button"
              onClick={() => setCurrentStep(1)}
              className="btn-secondary"
              style={{
                padding: '0.75rem 1.25rem',
                fontSize: '0.95rem',
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                minHeight: 'var(--min-target-size)',
              }}
            >
              <ArrowLeft size={18} />
              <span>Back to Environment</span>
            </button>

            <button
              type="button"
              onClick={handleNextFromStep2}
              className="btn-primary"
              style={{
                padding: '0.75rem 1.5rem',
                fontSize: '0.95rem',
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                minHeight: 'var(--min-target-size)',
              }}
            >
              <span>Continue to Review & Start</span>
              <ArrowRight size={18} />
            </button>
          </div>
        </section>
      )}

      {/* ========================================================================= */}
      {/* STEP 3: REVIEW AND START SIMULATION                                       */}
      {/* ========================================================================= */}
      {currentStep === 3 && (
        <form onSubmit={handleLaunch} className="glass-panel" style={{ padding: '2rem' }}>
          <div style={{ marginBottom: '1.5rem' }}>
            <h2 style={{ fontSize: '1.35rem', fontWeight: 700, margin: '0 0 0.35rem' }}>
              Step 3: Review Configuration & Launch
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: 0 }}>
              Verify your chosen test environment, driving strategy, and simulation parameters before dispatching the real engine.
            </p>
          </div>

          {/* Review Summary Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
            {/* Selected Environment Box */}
            <div
              style={{
                padding: '1.15rem',
                background: 'var(--bg-surface-elevated)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-default)',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-secondary)' }}>
                  Selected Environment
                </span>
                <button
                  type="button"
                  onClick={() => setCurrentStep(1)}
                  style={{ background: 'transparent', border: 'none', color: 'var(--accent-primary)', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}
                >
                  Change
                </button>
              </div>
              <strong style={{ fontSize: '1.05rem', color: 'var(--text-primary)' }}>
                {selectedScenario.name}
              </strong>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                {selectedScenario.trafficChallenge}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Width: {selectedScenario.roadWidth} • Speed: {selectedScenario.speed}
              </div>
            </div>

            {/* Selected Strategy Box */}
            <div
              style={{
                padding: '1.15rem',
                background: 'var(--bg-surface-elevated)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-default)',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-secondary)' }}>
                  Selected Driving Strategy
                </span>
                <button
                  type="button"
                  onClick={() => setCurrentStep(2)}
                  style={{ background: 'transparent', border: 'none', color: 'var(--accent-primary)', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}
                >
                  Change
                </button>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <strong style={{ fontSize: '1.05rem', color: 'var(--text-primary)' }}>
                  {selectedPlanner.name}
                </strong>
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                {selectedPlanner.shortDescription}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Algorithm: {selectedPlanner.algorithmType}
              </div>
            </div>
          </div>

          {/* Simulation Execution Settings */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginBottom: '1.5rem' }}>
            {/* Random Seed */}
            <div>
              <label
                htmlFor="simulation-seed-input"
                style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.35rem' }}
              >
                RANDOM SEED (WORLD GENERATION)
              </label>
              <input
                id="simulation-seed-input"
                type="number"
                min={1}
                max={999999}
                value={seed}
                onChange={(e) => setSeed(parseInt(e.target.value, 10))}
                style={{
                  width: '100%',
                  padding: '0.65rem 0.85rem',
                  borderRadius: 'var(--radius-sm)',
                  border: validationErrors.seed ? '1px solid var(--risk-critical)' : '1px solid var(--border-default)',
                  background: 'var(--bg-surface)',
                  color: 'var(--text-primary)',
                  fontSize: '0.9rem',
                  boxSizing: 'border-box',
                  minHeight: 'var(--min-target-size)',
                }}
              />
              {validationErrors.seed ? (
                <span style={{ fontSize: '0.75rem', color: 'var(--risk-critical)' }}>{validationErrors.seed}</span>
              ) : (
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  Controls initial obstacle positions and arrival timings (e.g. 1000, 1001, 2000).
                </span>
              )}
            </div>

            {/* Evaluation Split */}
            <div>
              <label
                htmlFor="simulation-split-select"
                style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.35rem' }}
              >
                EVALUATION SPLIT
              </label>
              <select
                id="simulation-split-select"
                value={split}
                onChange={(e) => setSplit(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.65rem 0.85rem',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-default)',
                  background: 'var(--bg-surface)',
                  color: 'var(--text-primary)',
                  fontSize: '0.9rem',
                  minHeight: 'var(--min-target-size)',
                }}
              >
                <option value="test">Test Split (Unseen evaluation seeds)</option>
                <option value="tune">Tune Split (Development & parameter exploration)</option>
                <option value="val_b">Validation B (Frozen independent verification seeds)</option>
                <option value="train">Train Split (Nominal training baselines)</option>
              </select>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                Partitions seeds according to official experimental protocol.
              </span>
            </div>
          </div>

          {/* Engine Adapter Selector */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label
              htmlFor="engine-adapter-select"
              style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.35rem' }}
            >
              SIMULATION ENGINE ADAPTER
            </label>
            <select
              id="engine-adapter-select"
              value={engineAdapter}
              onChange={(e) => setEngineAdapter(e.target.value as any)}
              style={{
                width: '100%',
                padding: '0.65rem 0.85rem',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-default)',
                background: 'var(--bg-surface)',
                color: 'var(--text-primary)',
                fontSize: '0.9rem',
                minHeight: 'var(--min-target-size)',
              }}
            >
              <option value="python_inprocess">Python Reference Engine (In-Process, Sub-50ms Fast Execution)</option>
              <option value="matlab_roadrunner">MATLAB/Simulink + RoadRunner (Official SIH2026 Cosimulation)</option>
            </select>
          </div>

          {/* Collapsible Advanced Parameters */}
          <div style={{ marginBottom: '2rem' }}>
            <button
              type="button"
              onClick={() => setShowAdvancedParams(!showAdvancedParams)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-secondary)',
                fontSize: '0.85rem',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                cursor: 'pointer',
                padding: '0.2rem 0',
              }}
            >
              <Settings size={15} />
              <span>Advanced Research Hyperparameters</span>
              {showAdvancedParams ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>

            {showAdvancedParams && (
              <div
                style={{
                  marginTop: '0.75rem',
                  padding: '1rem',
                  background: 'var(--bg-surface-elevated)',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-subtle)',
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '1rem',
                }}
              >
                <div>
                  <label
                    htmlFor="conformal-alpha-input"
                    style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.35rem' }}
                  >
                    CONFORMAL COVERAGE ERROR (α)
                  </label>
                  <input
                    id="conformal-alpha-input"
                    type="number"
                    step="0.01"
                    min="0.01"
                    max="0.20"
                    value={conformalAlpha}
                    onChange={(e) => setConformalAlpha(parseFloat(e.target.value))}
                    style={{
                      width: '100%',
                      padding: '0.55rem 0.75rem',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border-default)',
                      background: 'var(--bg-surface)',
                      color: 'var(--text-primary)',
                      boxSizing: 'border-box',
                    }}
                  />
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    α = 0.05 guarantees 95% marginal coverage
                  </span>
                </div>

                <div>
                  <label
                    htmlFor="risk-threshold-input"
                    style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.35rem' }}
                  >
                    REPLAN RISK THRESHOLD
                  </label>
                  <input
                    id="risk-threshold-input"
                    type="number"
                    step="0.05"
                    min="0.30"
                    max="0.95"
                    value={riskThreshold}
                    onChange={(e) => setRiskThreshold(parseFloat(e.target.value))}
                    style={{
                      width: '100%',
                      padding: '0.55rem 0.75rem',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border-default)',
                      background: 'var(--bg-surface)',
                      color: 'var(--text-primary)',
                      boxSizing: 'border-box',
                    }}
                  />
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    Triggers adaptive trajectory replan when R &gt; threshold
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Actions Bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => setCurrentStep(2)}
              className="btn-secondary"
              style={{
                padding: '0.85rem 1.4rem',
                fontSize: '0.95rem',
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                minHeight: 'var(--touch-target-size)',
              }}
            >
              <ArrowLeft size={18} />
              <span>Back to Driving Strategy</span>
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-primary"
              style={{
                padding: '0.85rem 2rem',
                fontSize: '1rem',
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.6rem',
                minHeight: 'var(--touch-target-size)',
                opacity: isSubmitting ? 0.7 : 1,
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
              }}
            >
              {isSubmitting ? (
                <>
                  <RefreshCw size={20} className="spin-animation" />
                  <span>Launching Simulation...</span>
                </>
              ) : (
                <>
                  <PlayCircle size={20} />
                  <span>Start Simulation</span>
                </>
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
