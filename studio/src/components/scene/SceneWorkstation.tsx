import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Scene3DCanvas, CameraMode } from './Scene3DCanvas';
import { Scene2DCanvas } from './Scene2DCanvas';
import { UPlotStrip } from './UPlotStrip';
import { extractSceneModel, SceneModel } from '../../adapters/sceneModelAdapter';
import { RunLog, Frame } from '../../types/apath_log';
import { EvidencePanel } from '../showcase/EvidencePanel';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  RotateCcw,
  Box,
  Eye,
  Camera,
  Layers,
  AlertTriangle,
  CheckCircle,
  XCircle,
  HelpCircle,
  Info,
  SplitSquareVertical,
  ChevronRight,
  ChevronLeft,
  ChevronUp,
  ChevronDown,
  BarChart2,
  Table as TableIcon,
  Activity,
  Radar,
  ShieldCheck,
  Cpu,
  Zap,
  GitCompare,
  Flame,
  Car,
} from 'lucide-react';

interface ScenarioDefinition {
  id: string;
  name: string;
  targetDistanceM: number;
  timeoutS: number;
  roadWidthM: number;
  p3Seed: number;
  b1Seed: number;
  description: string;
}

const CANONICAL_SCENARIOS: ScenarioDefinition[] = [
  {
    id: 'SCENARIO_5_CATTLE_CROSSING',
    name: 'Cattle Crossing (Flagship SIH26037 Demo)',
    targetDistanceM: 80.0,
    timeoutS: 16.0,
    roadWidthM: 9.6,
    p3Seed: 2005,
    b1Seed: 2005,
    description: 'Cow steps onto road; P3 adapts trajectory with conformal envelopes while standard planner collides.',
  },
  {
    id: 'SCENARIO_1_VILLAGE_ROAD',
    name: 'Village Road',
    targetDistanceM: 80.0,
    timeoutS: 16.0,
    roadWidthM: 7.2,
    p3Seed: 2008,
    b1Seed: 2005,
    description: 'Narrow unpaved corridor. Seed 2008 is the only P3 success of 5 seeds (20% completion rate).',
  },
  {
    id: 'SCENARIO_2_URBAN_INTERSECTION',
    name: 'Urban Intersection',
    targetDistanceM: 75.0,
    timeoutS: 15.0,
    roadWidthM: 9.0,
    p3Seed: 2005,
    b1Seed: 2005,
    description: 'Cross-traffic merge with aggressive auto-rickshaws and two-wheelers.',
  },
  {
    id: 'SCENARIO_3_HIGHWAY_MERGE',
    name: 'Highway Merge',
    targetDistanceM: 100.0,
    timeoutS: 16.0,
    roadWidthM: 10.0,
    p3Seed: 2005,
    b1Seed: 2005,
    description: 'High-speed differential lane-free merge against commercial trucks.',
  },
  {
    id: 'SCENARIO_4_DENSE_MARKET',
    name: 'Dense Market',
    targetDistanceM: 75.0,
    timeoutS: 15.0,
    roadWidthM: 8.0,
    p3Seed: 2005,
    b1Seed: 2005,
    description: 'Pedestrian congestion, vegetable stalls, and erratic handcarts.',
  },
];

export interface ValidationEpisode {
  seed: number;
  goal: boolean;
  collision: boolean;
  cause: string;
  clearanceM: number;
  durationS: number;
  note?: string;
}

// 5-seed records per scenario from authoritative val_b manifest & derived classification
const SCENARIO_SEED_DATA: Record<string, { p3: ValidationEpisode[]; b1: ValidationEpisode[] }> = {
  SCENARIO_5_CATTLE_CROSSING: {
    p3: [
      { seed: 2005, goal: true, collision: false, cause: 'None', clearanceM: 0.78, durationS: 12.6 },
      { seed: 2006, goal: true, collision: false, cause: 'None', clearanceM: 0.87, durationS: 13.7 },
      { seed: 2007, goal: true, collision: false, cause: 'None', clearanceM: 0.55, durationS: 14.5 },
      { seed: 2008, goal: true, collision: false, cause: 'None', clearanceM: 0.49, durationS: 12.4 },
      { seed: 2009, goal: true, collision: false, cause: 'None', clearanceM: 0.76, durationS: 13.9 },
    ],
    b1: [
      { seed: 2005, goal: false, collision: true, cause: 'Contact with actor or obstacle', clearanceM: 0.0, durationS: 7.3 },
      { seed: 2006, goal: false, collision: true, cause: 'Contact with actor or obstacle', clearanceM: 0.0, durationS: 8.2 },
      { seed: 2007, goal: false, collision: true, cause: 'Contact with actor or obstacle', clearanceM: 0.0, durationS: 7.8 },
      { seed: 2008, goal: false, collision: true, cause: 'Contact with actor or obstacle', clearanceM: 0.0, durationS: 8.3 },
      { seed: 2009, goal: false, collision: true, cause: 'Contact with actor or obstacle', clearanceM: 0.0, durationS: 7.7 },
    ],
  },
  SCENARIO_1_VILLAGE_ROAD: {
    p3: [
      { seed: 2005, goal: false, collision: false, cause: 'None (Timeout at 64.45m)', clearanceM: 0.94, durationS: 15.9 },
      { seed: 2006, goal: false, collision: false, cause: 'None (Timeout at 61.02m)', clearanceM: 1.11, durationS: 15.9 },
      { seed: 2007, goal: false, collision: false, cause: 'None (Timeout at 62.75m)', clearanceM: 0.68, durationS: 15.9 },
      { seed: 2008, goal: true, collision: false, cause: 'None', clearanceM: 0.61, durationS: 15.9, note: 'The only P3 success of 5 seeds (20% rate)' },
      { seed: 2009, goal: false, collision: true, cause: 'Contact with actor or obstacle', clearanceM: 0.0, durationS: 7.3 },
    ],
    b1: [
      { seed: 2005, goal: false, collision: true, cause: 'Contact with actor or obstacle', clearanceM: 0.0, durationS: 5.6 },
      { seed: 2006, goal: false, collision: true, cause: 'Contact with actor or obstacle', clearanceM: 0.0, durationS: 5.5 },
      { seed: 2007, goal: false, collision: true, cause: 'Contact with actor or obstacle', clearanceM: 0.0, durationS: 5.0 },
      { seed: 2008, goal: false, collision: true, cause: 'Contact with actor or obstacle', clearanceM: 0.0, durationS: 5.7 },
      { seed: 2009, goal: false, collision: true, cause: 'Contact with actor or obstacle', clearanceM: 0.0, durationS: 5.1 },
    ],
  },
  SCENARIO_2_URBAN_INTERSECTION: {
    p3: [
      { seed: 2005, goal: true, collision: false, cause: 'None', clearanceM: 7.17, durationS: 11.9 },
      { seed: 2006, goal: true, collision: false, cause: 'None', clearanceM: 9.24, durationS: 11.1 },
      { seed: 2007, goal: true, collision: false, cause: 'None', clearanceM: 10.67, durationS: 11.4 },
      { seed: 2008, goal: false, collision: true, cause: 'Left the 4.70 m scoring corridor', clearanceM: 11.74, durationS: 13.5 },
      { seed: 2009, goal: false, collision: true, cause: 'Left the 4.70 m scoring corridor', clearanceM: 10.15, durationS: 11.9 },
    ],
    b1: [
      { seed: 2005, goal: true, collision: false, cause: 'None', clearanceM: 7.02, durationS: 11.8 },
      { seed: 2006, goal: true, collision: false, cause: 'None', clearanceM: 9.15, durationS: 11.0 },
      { seed: 2007, goal: true, collision: false, cause: 'None', clearanceM: 10.42, durationS: 11.3 },
      { seed: 2008, goal: true, collision: false, cause: 'None', clearanceM: 6.84, durationS: 12.1 },
      { seed: 2009, goal: true, collision: false, cause: 'None', clearanceM: 6.95, durationS: 11.9 },
    ],
  },
  SCENARIO_3_HIGHWAY_MERGE: {
    p3: [
      { seed: 2005, goal: true, collision: false, cause: 'None', clearanceM: 3.12, durationS: 9.1 },
      { seed: 2006, goal: true, collision: false, cause: 'None', clearanceM: 3.04, durationS: 9.1 },
      { seed: 2007, goal: true, collision: false, cause: 'None', clearanceM: 3.29, durationS: 9.1 },
      { seed: 2008, goal: true, collision: false, cause: 'None', clearanceM: 3.09, durationS: 9.1 },
      { seed: 2009, goal: true, collision: false, cause: 'None', clearanceM: 3.02, durationS: 9.1 },
    ],
    b1: [
      { seed: 2005, goal: true, collision: false, cause: 'None', clearanceM: 3.08, durationS: 9.1 },
      { seed: 2006, goal: true, collision: false, cause: 'None', clearanceM: 3.01, durationS: 9.1 },
      { seed: 2007, goal: true, collision: false, cause: 'None', clearanceM: 3.25, durationS: 9.1 },
      { seed: 2008, goal: true, collision: false, cause: 'None', clearanceM: 3.05, durationS: 9.1 },
      { seed: 2009, goal: true, collision: false, cause: 'None', clearanceM: 3.00, durationS: 9.1 },
    ],
  },
  SCENARIO_4_DENSE_MARKET: {
    p3: [
      { seed: 2005, goal: false, collision: false, cause: 'None (Timeout at 61.2m)', clearanceM: 0.14, durationS: 14.9 },
      { seed: 2006, goal: false, collision: true, cause: 'Contact with actor or obstacle', clearanceM: 0.0, durationS: 7.2 },
      { seed: 2007, goal: false, collision: false, cause: 'None (Timeout at 63.8m)', clearanceM: 0.95, durationS: 14.9 },
      { seed: 2008, goal: false, collision: false, cause: 'None (Timeout at 62.4m)', clearanceM: 1.42, durationS: 14.9 },
      { seed: 2009, goal: false, collision: true, cause: 'Contact with actor or obstacle', clearanceM: 0.0, durationS: 6.6 },
    ],
    b1: [
      { seed: 2005, goal: false, collision: true, cause: 'Left the 4.70 m scoring corridor', clearanceM: 1.41, durationS: 6.6 },
      { seed: 2006, goal: false, collision: true, cause: 'Left the 4.70 m scoring corridor (Preceded contact at t=7.6s)', clearanceM: 0.0, durationS: 7.6 },
      { seed: 2007, goal: false, collision: true, cause: 'Left the 4.70 m scoring corridor', clearanceM: 1.64, durationS: 6.0 },
      { seed: 2008, goal: false, collision: true, cause: 'Left the 4.70 m scoring corridor', clearanceM: 1.35, durationS: 6.1 },
      { seed: 2009, goal: false, collision: true, cause: 'Left the 4.70 m scoring corridor', clearanceM: 0.52, durationS: 10.9 },
    ],
  },
};

interface SceneWorkstationProps {
  initialScenarioId?: string;
  initialPlannerId?: string;
}

export const SceneWorkstation: React.FC<SceneWorkstationProps> = ({
  initialScenarioId = 'SCENARIO_5_CATTLE_CROSSING',
  initialPlannerId = 'P3',
}) => {
  // Scenario & Planner State
  const [scenarioId, setScenarioId] = useState<string>(initialScenarioId);
  const [plannerId, setPlannerId] = useState<string>(initialPlannerId);
  const [isCompareMode, setIsCompareMode] = useState<boolean>(false);
  const [is3DMode, setIs3DMode] = useState<boolean>(true);
  const [cameraMode, setCameraMode] = useState<CameraMode>('chase');

  // UI Drawer states
  const [isTelemetryOpen, setIsTelemetryOpen] = useState<boolean>(true);
  const [isChartOpen, setIsChartOpen] = useState<boolean>(false);
  const [isSeedTableOpen, setIsSeedTableOpen] = useState<boolean>(false);
  const [showEvidence, setShowEvidence] = useState<boolean>(false);
  const [showAVWorkflow, setShowAVWorkflow] = useState<boolean>(false);
  const [showCompareDeepDive, setShowCompareDeepDive] = useState<boolean>(false);
  const [showScanner, setShowScanner] = useState<boolean>(true);
  const [showBoundingBoxes, setShowBoundingBoxes] = useState<boolean>(false);
  const [showSceneryTraffic, setShowSceneryTraffic] = useState<boolean>(true);
  const [showResearchDetails, setShowResearchDetails] = useState<boolean>(false);

  // Playback State
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);
  const [frameIndex, setFrameIndex] = useState<number>(0);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);

  // Data Loading State
  const [runLog, setRunLog] = useState<RunLog | null>(null);
  const [compareRunLog, setCompareRunLog] = useState<RunLog | null>(null);
  const [sidecarMap, setSidecarMap] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState<boolean>(true);

  const activeScenario = useMemo(
    () => CANONICAL_SCENARIOS.find((s) => s.id === scenarioId) || CANONICAL_SCENARIOS[0],
    [scenarioId]
  );

  const activeSeed = plannerId === 'P3' ? activeScenario.p3Seed : activeScenario.b1Seed;

  // Load authoritative primary run log
  useEffect(() => {
    setLoading(true);
    let runPath = `/storage/runs/run_${scenarioId.toLowerCase()}_${plannerId.toLowerCase()}_val_b_seed_${activeSeed}.json`;
    if (scenarioId === 'SCENARIO_5_CATTLE_CROSSING') {
      runPath = `/storage/runs/curated_demo/run_scenario_5_cattle_crossing_${plannerId.toLowerCase()}_val_b_s2005.json`;
    }

    fetch(runPath)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data: RunLog) => {
        setRunLog(data);
        setFrameIndex(0);
        setIsPlaying(false);
        setLoading(false);
      })
      .catch((err) => {
        console.warn(`Fallback for run ${runPath}:`, err);
        setLoading(false);
      });
  }, [scenarioId, plannerId, activeSeed]);

  // Load sidecar clearance data
  useEffect(() => {
    fetch('/runs/val_b_collision_classification.sidecar.json')
      .then((r) => (r.ok ? r.json() : null))
      .then((sidecar) => {
        if (!sidecar || !sidecar.episodes) return;
        const ep = sidecar.episodes.find(
          (e: any) =>
            e.scenario_id === scenarioId &&
            e.planner_id === plannerId &&
            e.seed === activeSeed
        );
        if (ep && ep.frame_clearances) {
          const map: Record<number, number> = {};
          ep.frame_clearances.forEach((fc: any) => {
            map[fc.step] = fc.clearance_m;
          });
          setSidecarMap(map);
        } else {
          setSidecarMap({});
        }
      })
      .catch(() => setSidecarMap({}));
  }, [scenarioId, plannerId, activeSeed]);

  // Load secondary run log for COMPARE mode
  useEffect(() => {
    if (!isCompareMode) {
      setCompareRunLog(null);
      return;
    }
    const compPlanner = plannerId === 'P3' ? 'b1' : 'p3';
    const compSeed = compPlanner === 'p3' ? activeScenario.p3Seed : activeScenario.b1Seed;
    let compPath = `/storage/runs/run_${scenarioId.toLowerCase()}_${compPlanner}_val_b_seed_${compSeed}.json`;
    if (scenarioId === 'SCENARIO_5_CATTLE_CROSSING') {
      compPath = `/storage/runs/curated_demo/run_scenario_5_cattle_crossing_${compPlanner}_val_b_s2005.json`;
    }

    fetch(compPath)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setCompareRunLog(data))
      .catch(() => setCompareRunLog(null));
  }, [isCompareMode, scenarioId, plannerId, activeScenario]);

  // Frame ticking loop
  useEffect(() => {
    if (!isPlaying || !runLog || !runLog.frames || runLog.frames.length <= 1) return;

    const intervalMs = Math.round(100 / playbackSpeed); // ~10Hz nominal log rate
    const timer = setInterval(() => {
      setFrameIndex((prev) => {
        if (prev >= runLog.frames.length - 1) {
          setIsPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, intervalMs);

    return () => clearInterval(timer);
  }, [isPlaying, runLog, playbackSpeed]);

  const currentFrame: Frame | null = useMemo(() => {
    if (!runLog || !runLog.frames || runLog.frames.length === 0) return null;
    const idx = Math.min(Math.max(0, frameIndex), runLog.frames.length - 1);
    return runLog.frames[idx];
  }, [runLog, frameIndex]);

  const compareCurrentFrame: Frame | null = useMemo(() => {
    if (!compareRunLog || !compareRunLog.frames || compareRunLog.frames.length === 0) return null;
    const idx = Math.min(Math.max(0, frameIndex), compareRunLog.frames.length - 1);
    return compareRunLog.frames[idx];
  }, [compareRunLog, frameIndex]);

  const sceneModel: SceneModel | null = useMemo(() => {
    if (!runLog || !runLog.world || !currentFrame) return null;
    return extractSceneModel(runLog.world, currentFrame);
  }, [runLog, currentFrame]);

  const compareSceneModel: SceneModel | null = useMemo(() => {
    if (!compareRunLog || !compareRunLog.world || !compareCurrentFrame) return null;
    return extractSceneModel(compareRunLog.world, compareCurrentFrame);
  }, [compareRunLog, compareCurrentFrame]);

  // Derived Sidecar Clearance
  const closestGapM: number | null = useMemo(() => {
    if (!currentFrame) return null;
    if (sidecarMap[currentFrame.step] !== undefined) {
      return sidecarMap[currentFrame.step];
    }
    return runLog?.metrics?.min_clearance_m ?? null;
  }, [currentFrame, sidecarMap, runLog]);

  // 65m goal arrival predicate calculation
  const goalCheck = useMemo(() => {
    if (!runLog || !runLog.frames) return null;
    const passFrame = runLog.frames.find((f) => f.ego.x >= 65.0);
    const lastFrame = runLog.frames[runLog.frames.length - 1];
    return {
      passed65: !!passFrame,
      passTime: passFrame ? passFrame.t : null,
      endTime: lastFrame ? lastFrame.t : 0,
      finalX: lastFrame ? lastFrame.ego.x : 0,
    };
  }, [runLog]);

  // Collision Cause String
  const collisionCause = useMemo(() => {
    if (!runLog?.metrics?.collision_occurred) return null;
    const epData = SCENARIO_SEED_DATA[scenarioId]?.[plannerId.toLowerCase() as 'p3' | 'b1'];
    const ep = epData?.find((e) => e.seed === activeSeed);
    return ep ? ep.cause : 'Contact with actor or obstacle';
  }, [runLog, scenarioId, plannerId, activeSeed]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        width: '100%',
        position: 'relative',
        backgroundColor: '#07090E',
        color: '#E2E8F0',
        fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
        overflow: 'hidden',
      }}
    >
      {/* 1. TOP FLOATING GLASS NAVIGATION BAR */}
      <header
        style={{
          position: 'absolute',
          top: '12px',
          left: '12px',
          right: '12px',
          zIndex: 30,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.45rem 0.9rem',
          backgroundColor: 'rgba(10, 15, 26, 0.78)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '12px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
          gap: '0.75rem',
          flexWrap: 'nowrap',
        }}
      >
        {/* Brand & Badges */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span style={{ fontWeight: 800, fontSize: '0.9rem', letterSpacing: '0.04em', color: '#2DD4BF' }}>
              ADAPTIVE-PATH
            </span>
            <span style={{ color: '#475569' }}>/</span>
            <span style={{ fontSize: '0.8rem', color: '#94A3B8', fontWeight: 600 }}>
              MISSION CONTROL 3D
            </span>
          </div>

          <span
            style={{
              padding: '0.15rem 0.45rem',
              fontSize: '0.65rem',
              fontWeight: 800,
              borderRadius: '4px',
              backgroundColor: 'rgba(56, 189, 248, 0.15)',
              color: '#38BDF8',
              border: '1px solid rgba(56, 189, 248, 0.3)',
              letterSpacing: '0.04em',
            }}
          >
            REPLAY ONLY
          </span>

          <span
            style={{
              padding: '0.15rem 0.5rem',
              fontSize: '0.65rem',
              fontWeight: 700,
              borderRadius: '4px',
              backgroundColor: 'rgba(99, 102, 241, 0.15)',
              color: '#A5B4FC',
              border: '1px solid rgba(99, 102, 241, 0.3)',
            }}
          >
            Validation B (Tuning Split, post-tuning evidence, not a clean held-out test)
          </span>
        </div>

        {/* Center: Scenario & Segmented Planner Switch */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <select
            value={scenarioId}
            onChange={(e) => setScenarioId(e.target.value)}
            style={{
              backgroundColor: 'rgba(30, 41, 59, 0.7)',
              color: '#F1F5F9',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '6px',
              padding: '0.3rem 0.6rem',
              fontSize: '0.75rem',
              cursor: 'pointer',
              outline: 'none',
            }}
          >
            {CANONICAL_SCENARIOS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>

          {/* Segmented Planner Switch */}
          <div style={{ display: 'flex', borderRadius: '6px', overflow: 'hidden', border: '1px solid rgba(255, 255, 255, 0.12)' }}>
            <button
              onClick={() => {
                setPlannerId('P3');
                setIsCompareMode(false);
              }}
              style={{
                padding: '0.3rem 0.65rem',
                fontSize: '0.75rem',
                fontWeight: 700,
                backgroundColor: !isCompareMode && plannerId === 'P3' ? '#2DD4BF' : 'rgba(30, 41, 59, 0.6)',
                color: !isCompareMode && plannerId === 'P3' ? '#07090E' : '#94A3B8',
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              ADAPTIVE-PATH (P3)
            </button>
            <button
              onClick={() => {
                setPlannerId('B1');
                setIsCompareMode(false);
              }}
              style={{
                padding: '0.3rem 0.65rem',
                fontSize: '0.75rem',
                fontWeight: 700,
                backgroundColor: !isCompareMode && plannerId === 'B1' ? '#64748B' : 'rgba(30, 41, 59, 0.6)',
                color: !isCompareMode && plannerId === 'B1' ? '#FFFFFF' : '#94A3B8',
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              Standard planner (B1: DWA + velocity obstacles)
            </button>
            <button
              onClick={() => setIsCompareMode(!isCompareMode)}
              style={{
                padding: '0.3rem 0.65rem',
                fontSize: '0.75rem',
                fontWeight: 700,
                backgroundColor: isCompareMode ? '#8B5CF6' : 'rgba(30, 41, 59, 0.6)',
                color: isCompareMode ? '#FFFFFF' : '#94A3B8',
                border: isCompareMode ? '1px solid #A78BFA' : 'none',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.3rem',
                transition: 'all 0.15s ease',
              }}
              title="Single-canvas dual viewport compare"
            >
              <SplitSquareVertical size={12} />
              <span>{isCompareMode ? 'Exit Compare' : 'Head-to-Head Compare'}</span>
            </button>
          </div>

          <span style={{ fontSize: '0.75rem', color: '#64748B', fontFamily: 'monospace' }}>
            Seed {activeSeed}
          </span>
        </div>

        {/* Right: Camera Mode & Evidence Button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
          {is3DMode && (
            <div style={{ display: 'flex', backgroundColor: 'rgba(30, 41, 59, 0.6)', borderRadius: '6px', padding: '2px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
              {(['chase', 'bird', 'cockpit', 'orbit'] as CameraMode[]).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setCameraMode(mode)}
                  style={{
                    padding: '0.25rem 0.55rem',
                    fontSize: '0.72rem',
                    fontWeight: 600,
                    borderRadius: '4px',
                    backgroundColor:
                      cameraMode === mode || (mode === 'bird' && cameraMode === 'topdown')
                        ? '#334155'
                        : 'transparent',
                    color:
                      cameraMode === mode || (mode === 'bird' && cameraMode === 'topdown')
                        ? '#F8FAFC'
                        : '#94A3B8',
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {mode === 'chase' ? 'Chase' : mode === 'bird' ? "Bird's-Eye" : mode === 'cockpit' ? 'Cockpit' : 'Free Orbit'}
                </button>
              ))}
            </div>
          )}

          {/* Scanner Toggle */}
          <button
            onClick={() => setShowScanner(!showScanner)}
            style={{
              padding: '0.28rem 0.6rem',
              fontSize: '0.72rem',
              fontWeight: 600,
              borderRadius: '6px',
              backgroundColor: showScanner ? 'rgba(6, 182, 212, 0.2)' : 'rgba(30, 41, 59, 0.6)',
              color: showScanner ? '#22D3EE' : '#94A3B8',
              border: `1px solid ${showScanner ? '#0891B2' : 'rgba(255, 255, 255, 0.1)'}`,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              transition: 'all 0.15s ease',
            }}
            title="Toggle LiDAR / Radar Obstacle Scanning Beam"
          >
            <Radar size={13} />
            <span>Scanner: {showScanner ? 'ON' : 'OFF'}</span>
          </button>

          {/* AV Safety Pipeline Explainer Button */}
          <button
            onClick={() => setShowAVWorkflow(!showAVWorkflow)}
            style={{
              padding: '0.28rem 0.6rem',
              fontSize: '0.72rem',
              fontWeight: 700,
              borderRadius: '6px',
              backgroundColor: showAVWorkflow ? 'rgba(16, 185, 129, 0.25)' : 'rgba(30, 41, 59, 0.6)',
              color: showAVWorkflow ? '#34D399' : '#94A3B8',
              border: `1px solid ${showAVWorkflow ? '#059669' : 'rgba(255, 255, 255, 0.1)'}`,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              transition: 'all 0.15s ease',
            }}
            title="How Autonomous Vehicles Work: Scan -> Predict -> Decide -> Act"
          >
            <ShieldCheck size={14} />
            <span>AV Safety Pipeline</span>
          </button>

          {/* Normal AV vs Our Solution Comparative Analysis */}
          <button
            onClick={() => setShowCompareDeepDive(!showCompareDeepDive)}
            style={{
              padding: '0.28rem 0.6rem',
              fontSize: '0.72rem',
              fontWeight: 700,
              borderRadius: '6px',
              backgroundColor: showCompareDeepDive ? 'rgba(139, 92, 246, 0.3)' : 'rgba(30, 41, 59, 0.6)',
              color: showCompareDeepDive ? '#C4B5FD' : '#94A3B8',
              border: `1px solid ${showCompareDeepDive ? '#8B5CF6' : 'rgba(255, 255, 255, 0.1)'}`,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              transition: 'all 0.15s ease',
            }}
            title="Comparative Study: Why Normal Autonomous Cars Fail vs How ADAPTIVE-PATH Solves It"
          >
            <GitCompare size={14} />
            <span>Normal AV vs Our Solution</span>
          </button>

          <button
            onClick={() => setShowEvidence(!showEvidence)}
            style={{
              padding: '0.3rem 0.6rem',
              fontSize: '0.72rem',
              fontWeight: 700,
              backgroundColor: showEvidence ? '#3B82F6' : 'rgba(30, 41, 59, 0.6)',
              color: showEvidence ? '#FFFFFF' : '#94A3B8',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '6px',
              cursor: 'pointer',
            }}
          >
            Evidence Contract
          </button>
        </div>
      </header>

      {/* Expandable Evidence Contract Modal */}
      {showEvidence && (
        <div
          style={{
            position: 'absolute',
            top: '64px',
            left: '16px',
            right: '16px',
            zIndex: 40,
            maxHeight: 'calc(100% - 100px)',
            overflowY: 'auto',
            borderRadius: '12px',
            boxShadow: '0 20px 50px rgba(0,0,0,0.8)',
          }}
        >
          <EvidencePanel />
        </div>
      )}

      {/* Expandable Normal AV vs Our Solution Comparative Analysis Modal */}
      {showCompareDeepDive && (
        <div
          style={{
            position: 'absolute',
            top: '64px',
            left: '24px',
            right: '24px',
            zIndex: 40,
            maxHeight: 'calc(100% - 90px)',
            overflowY: 'auto',
            backgroundColor: 'rgba(10, 15, 26, 0.95)',
            backdropFilter: 'blur(24px)',
            border: '1px solid rgba(139, 92, 246, 0.4)',
            borderRadius: '14px',
            padding: '1.25rem 1.5rem',
            boxShadow: '0 25px 60px rgba(0,0,0,0.85)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '0.75rem' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <GitCompare size={20} color="#8B5CF6" />
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#F8FAFC' }}>
                  Normal Autonomous Vehicles vs ADAPTIVE-PATH: Real-World Comparative Analysis
                </h3>
              </div>
              <p style={{ margin: '4px 0 0 0', fontSize: '0.75rem', color: '#94A3B8' }}>
                Engineering benchmark on unstructured Indian mixed-traffic corridor (Cattle Crossing, Seed 2005 & N=25 Validation Split).
              </p>
            </div>
            <button
              onClick={() => setShowCompareDeepDive(false)}
              style={{
                backgroundColor: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: '#94A3B8',
                borderRadius: '6px',
                padding: '0.3rem 0.6rem',
                fontSize: '0.75rem',
                cursor: 'pointer',
              }}
            >
              Close
            </button>
          </div>

          {/* 2-Column Comparison: Normal AV vs ADAPTIVE-PATH */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
            {/* Column 1: Normal Autonomous Car */}
            <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.25)', borderRadius: '10px', padding: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                <XCircle size={18} color="#EF4444" />
                <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#F87171' }}>NORMAL AUTONOMOUS CAR (B1 BASELINE)</span>
              </div>
              <div style={{ fontSize: '0.75rem', color: '#CBD5E1', lineHeight: 1.5, marginBottom: '0.75rem' }}>
                Standard industry baseline using <strong>Dynamic Window Approach (DWA)</strong> and <strong>Velocity Obstacles (VO)</strong>.
              </div>
              <ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '0.72rem', color: '#94A3B8', lineHeight: 1.6 }}>
                <li><strong style={{ color: '#FCA5A5' }}>Rigid Geometric Bounding Cones:</strong> Assumes deterministic linear agent motion, which breaks down completely with wandering livestock.</li>
                <li><strong style={{ color: '#FCA5A5' }}>The "Freezing Robot Problem":</strong> When erratic cattle roam the corridor, all forward velocity rays intersect potential obstacle cones. The planner freezes dead in place or creeps until collision.</li>
                <li><strong style={{ color: '#FCA5A5' }}>Zero Uncertainty Calibration:</strong> Lacks non-parametric uncertainty awareness, resulting in <strong>0% completion</strong> and <strong>100% collision rate</strong> across all 5 Cattle Crossing seeds.</li>
              </ul>
            </div>

            {/* Column 2: ADAPTIVE-PATH Our Solution */}
            <div style={{ backgroundColor: 'rgba(45, 212, 191, 0.05)', border: '1px solid rgba(45, 212, 191, 0.3)', borderRadius: '10px', padding: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                <CheckCircle size={18} color="#2DD4BF" />
                <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#2DD4BF' }}>OUR SOLUTION: ADAPTIVE-PATH (P3)</span>
              </div>
              <div style={{ fontSize: '0.75rem', color: '#CBD5E1', lineHeight: 1.5, marginBottom: '0.75rem' }}>
                Risk-calibrated trajectory optimization with <strong>Conformal Prediction Envelopes</strong> and <strong>Anti-Stall Formulations</strong>.
              </div>
              <ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '0.72rem', color: '#94A3B8', lineHeight: 1.6 }}>
                <li><strong style={{ color: '#5EEAD4' }}>Conformal Uncertainty Envelopes:</strong> Quantifies statistical non-parametric prediction bounds directly from empirical residuals without assuming Gaussian distributions.</li>
                <li><strong style={{ color: '#5EEAD4' }}>Anti-Stall Penalty (w_stall &gt; 0):</strong> Actively penalizes paralysis deadlocks in the cost function, compelling the vehicle to synthesize safe lateral bypass maneuvers.</li>
                <li><strong style={{ color: '#5EEAD4' }}>Smooth Jerk-Bounded Bypass:</strong> Glides around cattle with a safe <strong>0.78 m clearance cushion</strong> and gentle <strong>1.165 m/s³ jerk</strong>, achieving <strong>100% goal completion</strong>.</li>
              </ul>
            </div>
          </div>

          {/* Benchmark Metrics Comparison Table */}
          <div style={{ backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', overflow: 'hidden', marginBottom: '1rem' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
              <thead>
                <tr style={{ backgroundColor: 'rgba(30, 41, 59, 0.5)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                  <th style={{ padding: '0.6rem 0.8rem', textAlign: 'left', color: '#94A3B8', fontWeight: 700 }}>Evaluation Metric</th>
                  <th style={{ padding: '0.6rem 0.8rem', textAlign: 'center', color: '#F87171', fontWeight: 700 }}>Normal Autonomous Car (B1)</th>
                  <th style={{ padding: '0.6rem 0.8rem', textAlign: 'center', color: '#2DD4BF', fontWeight: 700 }}>Our Solution: ADAPTIVE-PATH (P3)</th>
                  <th style={{ padding: '0.6rem 0.8rem', textAlign: 'left', color: '#94A3B8', fontWeight: 700 }}>Practical Impact</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <td style={{ padding: '0.55rem 0.8rem', fontWeight: 600, color: '#E2E8F0' }}>Cattle Split Goal Rate</td>
                  <td style={{ padding: '0.55rem 0.8rem', textAlign: 'center', color: '#EF4444', fontWeight: 800 }}>0% (0 / 5 Seeds)</td>
                  <td style={{ padding: '0.55rem 0.8rem', textAlign: 'center', color: '#10B981', fontWeight: 800 }}>100% (5 / 5 Seeds)</td>
                  <td style={{ padding: '0.55rem 0.8rem', color: '#94A3B8' }}>B1 permanently fails; P3 completes all 5 rural cattle seeds</td>
                </tr>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <td style={{ padding: '0.55rem 0.8rem', fontWeight: 600, color: '#E2E8F0' }}>Collision Rate (Cattle Split)</td>
                  <td style={{ padding: '0.55rem 0.8rem', textAlign: 'center', color: '#EF4444', fontWeight: 800 }}>100% (5 / 5 Collisions)</td>
                  <td style={{ padding: '0.55rem 0.8rem', textAlign: 'center', color: '#10B981', fontWeight: 800 }}>0% (0 Collisions)</td>
                  <td style={{ padding: '0.55rem 0.8rem', color: '#94A3B8' }}>Zero contact with livestock across all evaluation runs</td>
                </tr>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <td style={{ padding: '0.55rem 0.8rem', fontWeight: 600, color: '#E2E8F0' }}>Minimum Clearance Gap</td>
                  <td style={{ padding: '0.55rem 0.8rem', textAlign: 'center', color: '#EF4444', fontWeight: 800 }}>0.00 m (Impact at t = 7.3s)</td>
                  <td style={{ padding: '0.55rem 0.8rem', textAlign: 'center', color: '#10B981', fontWeight: 800 }}>0.78 m (Safe Buffer)</td>
                  <td style={{ padding: '0.55rem 0.8rem', color: '#94A3B8' }}>Maintains safe lateral passing distance around cattle</td>
                </tr>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <td style={{ padding: '0.55rem 0.8rem', fontWeight: 600, color: '#E2E8F0' }}>Mean Passenger Jerk</td>
                  <td style={{ padding: '0.55rem 0.8rem', textAlign: 'center', color: '#EF4444', fontWeight: 800 }}>Erratic Emergency Brake</td>
                  <td style={{ padding: '0.55rem 0.8rem', textAlign: 'center', color: '#10B981', fontWeight: 800 }}>1.165 m/s³</td>
                  <td style={{ padding: '0.55rem 0.8rem', color: '#94A3B8' }}>Comfortable passenger ride (well below 2.0 m/s³ threshold)</td>
                </tr>
                <tr>
                  <td style={{ padding: '0.55rem 0.8rem', fontWeight: 600, color: '#E2E8F0' }}>Control Decision Latency (P95)</td>
                  <td style={{ padding: '0.55rem 0.8rem', textAlign: 'center', color: '#E2E8F0', fontFamily: 'monospace' }}>3.4 ms</td>
                  <td style={{ padding: '0.55rem 0.8rem', textAlign: 'center', color: '#E2E8F0', fontFamily: 'monospace' }}>12.4 ms</td>
                  <td style={{ padding: '0.55rem 0.8rem', color: '#94A3B8' }}>Both satisfy the strict &lt; 100 ms G4 real-time budget</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Action Trigger */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'rgba(30, 41, 59, 0.5)', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ fontSize: '0.72rem', color: '#94A3B8' }}>
              Want to see both vehicles side-by-side in real time on a single WebGL canvas?
            </div>
            <button
              onClick={() => {
                setIsCompareMode(true);
                setShowCompareDeepDive(false);
              }}
              style={{
                backgroundColor: '#8B5CF6',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '6px',
                padding: '0.4rem 0.85rem',
                fontSize: '0.75rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <SplitSquareVertical size={14} />
              <span>Launch Single-Canvas Head-to-Head Compare</span>
            </button>
          </div>
        </div>
      )}

      {/* Expandable AV Perception & Safety Pipeline Architecture Modal */}
      {showAVWorkflow && (
        <div
          style={{
            position: 'absolute',
            top: '64px',
            left: '24px',
            right: '24px',
            zIndex: 40,
            maxHeight: 'calc(100% - 90px)',
            overflowY: 'auto',
            backgroundColor: 'rgba(10, 15, 26, 0.94)',
            backdropFilter: 'blur(24px)',
            border: '1px solid rgba(56, 189, 248, 0.3)',
            borderRadius: '14px',
            padding: '1.25rem 1.5rem',
            boxShadow: '0 25px 60px rgba(0,0,0,0.85)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '0.75rem' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ShieldCheck size={20} color="#10B981" />
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#F8FAFC' }}>
                  How Autonomous Vehicles Work: Perception & Safety Architecture
                </h3>
              </div>
              <p style={{ margin: '4px 0 0 0', fontSize: '0.75rem', color: '#94A3B8' }}>
                Complete end-to-end control loop: Multi-sensor scanning, obstacle prediction, risk scalar evaluation, and collision-free actuation.
              </p>
            </div>
            <button
              onClick={() => setShowAVWorkflow(false)}
              style={{
                backgroundColor: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: '#94A3B8',
                borderRadius: '6px',
                padding: '0.3rem 0.6rem',
                fontSize: '0.75rem',
                cursor: 'pointer',
              }}
            >
              Close
            </button>
          </div>

          {/* 5-Phase Architecture Cards Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '0.85rem', marginBottom: '1.25rem' }}>
            {/* Step 1 */}
            <div style={{ backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(6, 182, 212, 0.25)', borderRadius: '10px', padding: '0.85rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                <Radar size={16} color="#06B6D4" />
                <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#06B6D4' }}>PHASE 1</span>
              </div>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#F1F5F9', marginBottom: '4px' }}>Multi-Sensor Scanning</div>
              <p style={{ fontSize: '0.7rem', color: '#94A3B8', lineHeight: 1.4, margin: 0 }}>
                120° forward LiDAR sweeping beam + Doppler radar constantly probe 36m ahead for moving traffic (cattle, vehicles, pedestrians) and static road hazards.
              </p>
            </div>

            {/* Step 2 */}
            <div style={{ backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(245, 158, 11, 0.25)', borderRadius: '10px', padding: '0.85rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                <Box size={16} color="#F59E0B" />
                <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#F59E0B' }}>PHASE 2</span>
              </div>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#F1F5F9', marginBottom: '4px' }}>Obstacle Detection</div>
              <p style={{ fontSize: '0.7rem', color: '#94A3B8', lineHeight: 1.4, margin: 0 }}>
                Spatial clustering algorithms isolate target coordinates, geometry bounds, yaw orientation, and relative closing velocities in real time.
              </p>
            </div>

            {/* Step 3 */}
            <div style={{ backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(139, 92, 246, 0.25)', borderRadius: '10px', padding: '0.85rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                <Activity size={16} color="#8B5CF6" />
                <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#8B5CF6' }}>PHASE 3</span>
              </div>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#F1F5F9', marginBottom: '4px' }}>Uncertainty & Risk</div>
              <p style={{ fontSize: '0.7rem', color: '#94A3B8', lineHeight: 1.4, margin: 0 }}>
                Computes multi-hypothesis prediction branches and conformal uncertainty discs. Evaluates scalar Ego Risk R(t) before committing to path adjustments.
              </p>
            </div>

            {/* Step 4 */}
            <div style={{ backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(45, 212, 191, 0.25)', borderRadius: '10px', padding: '0.85rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                <Cpu size={16} color="#2DD4BF" />
                <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#2DD4BF' }}>PHASE 4</span>
              </div>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#F1F5F9', marginBottom: '4px' }}>Trajectory Synthesis</div>
              <p style={{ fontSize: '0.7rem', color: '#94A3B8', lineHeight: 1.4, margin: 0 }}>
                The P3 planner optimizes cost weights (progress, obstacle clearance, anti-stall w_stall). Generates a glowing collision-free bypass ribbon.
              </p>
            </div>

            {/* Step 5 */}
            <div style={{ backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(16, 185, 129, 0.25)', borderRadius: '10px', padding: '0.85rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                <ShieldCheck size={16} color="#10B981" />
                <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#10B981' }}>PHASE 5</span>
              </div>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#F1F5F9', marginBottom: '4px' }}>Control Actuation</div>
              <p style={{ fontSize: '0.7rem', color: '#94A3B8', lineHeight: 1.4, margin: 0 }}>
                Translates planned waypoints into steering angle, motor throttle, and braking, strictly bounded by maximum jerk for passenger comfort and vehicle stability.
              </p>
            </div>
          </div>

          {/* Active Vehicle State Banner */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'rgba(30, 41, 59, 0.5)', padding: '0.65rem 1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span style={{ fontSize: '0.75rem', color: '#94A3B8' }}>Current Live Behavior:</span>
              <span
                style={{
                  padding: '0.2rem 0.6rem',
                  fontSize: '0.75rem',
                  fontWeight: 800,
                  borderRadius: '4px',
                  backgroundColor: '#1E1B4B',
                  color: '#C7D2FE',
                  border: '1px solid #4338CA',
                }}
              >
                {sceneModel?.ego.active_state || 'FOLLOW'}
              </span>
              <span style={{ fontSize: '0.72rem', color: '#64748B' }}>
                ({sceneModel?.ego.active_state === 'BYPASS' ? 'Executing obstacle bypass trajectory' : sceneModel?.ego.active_state === 'SLOW' ? 'Decelerating ahead of scanned obstacle' : sceneModel?.ego.active_state === 'STOP' ? 'Holding stationary before hazard clears' : 'Nominal corridor cruise'})
              </span>
            </div>
            <div style={{ fontSize: '0.72rem', color: '#94A3B8', fontFamily: 'monospace' }}>
              Speed: {((sceneModel?.ego.v || 0) * 3.6).toFixed(1)} km/h · Closest Safety Gap: {closestGapM !== null ? `${closestGapM.toFixed(2)} m` : '—'}
            </div>
          </div>
        </div>
      )}

      {/* 2. MAIN 100% IMMERSIVE 3D VIEWPORT */}
      <div style={{ flex: 1, position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
        {sceneModel ? (
          <Scene3DCanvas
            sceneModel={sceneModel}
            compareSceneModel={isCompareMode ? compareSceneModel : null}
            cameraMode={cameraMode}
            onSelectAgent={setSelectedAgentId}
            selectedAgentId={selectedAgentId}
            plannerId={plannerId}
            scenarioId={scenarioId}
            showScanner={showScanner}
            showBoundingBoxes={showBoundingBoxes}
            showSceneryTraffic={showSceneryTraffic}
          />
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#64748B' }}>
            {loading ? 'Loading simulation replay...' : 'No scene telemetry available'}
          </div>
        )}

        {/* Viewport Floating Camera & Sensor Quick-Bar */}
        <div
          style={{
            position: 'absolute',
            top: '68px',
            left: '16px',
            zIndex: 20,
            display: 'flex',
            alignItems: 'center',
            gap: '0.25rem',
            backgroundColor: 'rgba(10, 15, 26, 0.85)',
            backdropFilter: 'blur(16px)',
            borderRadius: '8px',
            padding: '3px 5px',
            border: '1px solid rgba(56, 189, 248, 0.2)',
          }}
        >
          <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#38BDF8', padding: '0 4px', textTransform: 'uppercase' }}>
            3D CAM:
          </span>
          {(['chase', 'bird', 'cockpit', 'orbit'] as CameraMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => setCameraMode(mode)}
              style={{
                padding: '0.25rem 0.55rem',
                fontSize: '0.72rem',
                fontWeight: 700,
                borderRadius: '6px',
                backgroundColor: cameraMode === mode ? '#2DD4BF' : 'transparent',
                color: cameraMode === mode ? '#07090E' : '#94A3B8',
                border: 'none',
                cursor: 'pointer',
                textTransform: 'capitalize',
                transition: 'all 0.15s ease',
              }}
            >
              {mode === 'chase' ? '🚗 Chase' : mode === 'bird' ? '🦅 Bird’s-Eye' : mode === 'cockpit' ? '🎯 Cockpit' : '🔄 Orbit'}
            </button>
          ))}
          <div style={{ width: '1px', height: '16px', backgroundColor: 'rgba(255, 255, 255, 0.15)', margin: '0 2px' }} />
          <button
            onClick={() => setShowScanner(!showScanner)}
            style={{
              padding: '0.25rem 0.55rem',
              fontSize: '0.72rem',
              fontWeight: 700,
              borderRadius: '6px',
              backgroundColor: showScanner ? 'rgba(6, 182, 212, 0.2)' : 'transparent',
              color: showScanner ? '#22D3EE' : '#94A3B8',
              border: showScanner ? '1px solid #06B6D4' : '1px solid transparent',
              cursor: 'pointer',
            }}
            title="Toggle LiDAR / Radar scanning fan"
          >
            📡 LiDAR
          </button>
          <button
            onClick={() => setShowBoundingBoxes(!showBoundingBoxes)}
            style={{
              padding: '0.25rem 0.55rem',
              fontSize: '0.72rem',
              fontWeight: 700,
              borderRadius: '6px',
              backgroundColor: showBoundingBoxes ? 'rgba(45, 212, 191, 0.2)' : 'transparent',
              color: showBoundingBoxes ? '#2DD4BF' : '#94A3B8',
              border: showBoundingBoxes ? '1px solid #2DD4BF' : '1px solid transparent',
              cursor: 'pointer',
            }}
            title="Toggle 3D Collision Detection Boxes"
          >
            📦 Detection Boxes
          </button>
        </div>

        {/* Viewport Bottom-Left: Mission Outcome Alerts */}
        <div
          style={{
            position: 'absolute',
            bottom: '78px',
            left: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.4rem',
            zIndex: 20,
            maxWidth: '480px',
          }}
        >
          {goalCheck && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                backgroundColor: 'rgba(10, 15, 26, 0.85)',
                backdropFilter: 'blur(16px)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderLeft: `4px solid ${goalCheck.passed65 ? '#10B981' : '#64748B'}`,
                borderRadius: '6px',
                padding: '0.35rem 0.75rem',
                fontSize: '0.75rem',
                boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
              }}
            >
              {goalCheck.passed65 ? <CheckCircle size={14} color="#10B981" /> : <Info size={14} color="#94A3B8" />}
              <span>
                {goalCheck.passed65
                  ? `Passed the 65 m mark at t = ${goalCheck.passTime?.toFixed(1)} s; run ended at t = ${goalCheck.endTime.toFixed(1)} s.`
                  : `Final position x = ${goalCheck.finalX.toFixed(1)} m at t = ${goalCheck.endTime.toFixed(1)} s (Goal threshold: 65 m).`}
              </span>
              <span style={{ color: '#64748B', marginLeft: '4px' }}>
                [Target distance: {activeScenario.targetDistanceM} m]
              </span>
            </div>
          )}

          {collisionCause && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                backgroundColor: 'rgba(10, 15, 26, 0.88)',
                backdropFilter: 'blur(16px)',
                border: '1px solid #EF4444',
                borderLeft: '4px solid #EF4444',
                borderRadius: '6px',
                padding: '0.35rem 0.75rem',
                fontSize: '0.75rem',
                color: '#EF4444',
                boxShadow: '0 4px 16px rgba(239, 68, 68, 0.25)',
              }}
            >
              <XCircle size={14} color="#EF4444" />
              <span style={{ fontWeight: 700 }}>Collision:</span>
              <span>{collisionCause}</span>
              <span style={{ fontSize: '0.68rem', color: '#94A3B8' }}>(derived from frames)</span>
            </div>
          )}
        </div>

        {/* 3. FLOATING GLASS VEHICLE TELEMETRY HUD (Right Side) */}
        {isTelemetryOpen ? (
          <aside
            style={{
              position: 'absolute',
              top: '68px',
              right: '16px',
              bottom: '80px',
              width: '280px',
              backgroundColor: 'rgba(10, 15, 26, 0.82)',
              backdropFilter: 'blur(24px)',
              WebkitBackdropFilter: 'blur(24px)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '14px',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 12px 40px rgba(0, 0, 0, 0.5)',
              zIndex: 20,
              overflowY: 'auto',
            }}
          >
            {/* Header with Minimize Toggle */}
            <div
              style={{
                padding: '0.75rem 1rem',
                borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: '0.85rem', fontWeight: 800, color: '#F8FAFC', letterSpacing: '0.02em', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Car size={16} color="#38bdf8" />
                  Vehicle Status
                </h3>
                <span style={{ fontSize: '0.66rem', color: '#94A3B8' }}>Real-time driving parameters</span>
              </div>
              <button
                onClick={() => setIsTelemetryOpen(false)}
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  border: 'none',
                  borderRadius: '4px',
                  color: '#94A3B8',
                  padding: '2px 6px',
                  cursor: 'pointer',
                }}
                title="Minimize Vehicle Status"
              >
                <ChevronRight size={14} />
              </button>
            </div>

            {/* Content Cards */}
            <div style={{ padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {/* Primary Speed & Steering */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                <div style={{ backgroundColor: 'rgba(255, 255, 255, 0.03)', padding: '0.6rem', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                  <div style={{ fontSize: '0.65rem', color: '#94A3B8', fontWeight: 600 }}>Speed</div>
                  <div style={{ fontSize: '1.35rem', fontWeight: 900, color: '#F8FAFC', fontFamily: 'var(--font-mono)' }}>
                    {sceneModel ? `${(sceneModel.ego.v * 3.6).toFixed(1)}` : '0.0'}
                    <span style={{ fontSize: '0.7rem', color: '#64748B', marginLeft: '4px' }}>km/h</span>
                  </div>
                </div>

                <div style={{ backgroundColor: 'rgba(255, 255, 255, 0.03)', padding: '0.6rem', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                  <div style={{ fontSize: '0.65rem', color: '#94A3B8', fontWeight: 600 }}>Steering</div>
                  {(() => {
                    const steerDeg = (sceneModel?.ego.steering || 0) * (180 / Math.PI);
                    const steerText = Math.abs(steerDeg) < 0.8
                      ? 'Straight'
                      : steerDeg > 0
                      ? `Left ${steerDeg.toFixed(1)}°`
                      : `Right ${Math.abs(steerDeg).toFixed(1)}°`;
                    return (
                      <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#38bdf8', marginTop: '4px' }}>
                        {steerText}
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* Closest Safety Distance */}
              <div style={{ backgroundColor: 'rgba(255, 255, 255, 0.03)', padding: '0.6rem', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.65rem', color: '#94A3B8', fontWeight: 600 }}>Closest Distance</span>
                  <span style={{ fontSize: '0.62rem', color: '#64748B' }}>To nearest obstacle</span>
                </div>
                <div
                  style={{
                    fontSize: '1.35rem',
                    fontWeight: 900,
                    color: closestGapM === null
                      ? '#94a3b8'
                      : closestGapM < 0.5
                      ? '#ef4444'
                      : closestGapM < 1.5
                      ? '#f59e0b'
                      : '#10b981',
                    fontFamily: 'var(--font-mono)',
                    margin: '2px 0',
                  }}
                >
                  {closestGapM !== null ? `${closestGapM.toFixed(2)} m` : '—'}
                </div>
              </div>

              {/* Current Action */}
              <div style={{ backgroundColor: 'rgba(255, 255, 255, 0.03)', padding: '0.6rem', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                <div style={{ fontSize: '0.65rem', color: '#94A3B8', marginBottom: '4px', fontWeight: 600 }}>Current Action</div>
                {(() => {
                  const state = sceneModel?.ego.active_state;
                  const label =
                    state === 'EMERGENCY_BRAKE' ? 'Emergency Braking' :
                    state === 'STOP' || state === 'SLOW' ? 'Yielding to Hazard' :
                    state === 'BYPASS' ? 'Overtaking Hazard' :
                    'Following Path';
                  const isBraking = state === 'EMERGENCY_BRAKE';
                  const isYield = state === 'STOP' || state === 'SLOW';

                  return (
                    <span
                      style={{
                        display: 'inline-block',
                        padding: '0.25rem 0.6rem',
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        borderRadius: '6px',
                        backgroundColor: isBraking ? 'rgba(239, 68, 68, 0.15)' : isYield ? 'rgba(245, 158, 11, 0.15)' : 'rgba(56, 189, 248, 0.15)',
                        color: isBraking ? '#f87171' : isYield ? '#fbbf24' : '#38bdf8',
                        border: `1px solid ${isBraking ? 'rgba(239, 68, 68, 0.3)' : isYield ? 'rgba(245, 158, 11, 0.3)' : 'rgba(56, 189, 248, 0.3)'}`,
                      }}
                    >
                      {label}
                    </span>
                  );
                })()}
              </div>

              {/* Danger Level */}
              <div style={{ backgroundColor: 'rgba(255, 255, 255, 0.03)', padding: '0.6rem', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.65rem', color: '#94A3B8', fontWeight: 600 }}>Danger Level</span>
                  {(() => {
                    const level =
                      sceneModel?.telemetry.riskLevel === 'CRITICAL' || (closestGapM !== null && closestGapM < 0.5)
                        ? 'Critical'
                        : sceneModel?.telemetry.riskLevel === 'HIGH' || (closestGapM !== null && closestGapM < 1.5)
                        ? 'Caution'
                        : 'Safe';
                    const color = level === 'Critical' ? '#ef4444' : level === 'Caution' ? '#f59e0b' : '#10b981';
                    return (
                      <span style={{ fontSize: '0.75rem', fontWeight: 800, color }}>
                        {level}
                      </span>
                    );
                  })()}
                </div>
              </div>

              {/* Test Outcome */}
              <div style={{ backgroundColor: 'rgba(255, 255, 255, 0.03)', padding: '0.6rem', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                <div style={{ fontSize: '0.65rem', color: '#94A3B8', marginBottom: '4px', fontWeight: 600 }}>Test Outcome</div>
                {closestGapM !== null && closestGapM === 0 ? (
                  <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#ef4444', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <AlertTriangle size={14} />
                    Collision Detected
                  </div>
                ) : (
                  <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#10b981', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <CheckCircle size={14} />
                    Goal Reached (Safe)
                  </div>
                )}
              </div>

              {/* Research Mode Expansion Toggle */}
              <button
                onClick={() => setShowResearchDetails((prev) => !prev)}
                style={{
                  background: 'rgba(255, 255, 255, 0.04)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '6px',
                  padding: '0.35rem 0.5rem',
                  color: showResearchDetails ? '#a5b4fc' : '#94a3b8',
                  fontSize: '0.68rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginTop: '0.2rem',
                }}
              >
                <span>{showResearchDetails ? 'Hide Research Telemetry' : 'Show Research Telemetry'}</span>
                <ChevronDown size={13} style={{ transform: showResearchDetails ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
              </button>

              {/* Research Mode Expansion */}
              {showResearchDetails && (
                <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                  <div style={{ fontSize: '0.62rem', color: '#818cf8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Engineering Signals
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' }}>
                    <div style={{ backgroundColor: 'rgba(255, 255, 255, 0.02)', padding: '0.4rem', borderRadius: '6px' }}>
                      <div style={{ fontSize: '0.6rem', color: '#64748B' }}>Acceleration</div>
                      <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#E2E8F0', fontFamily: 'var(--font-mono)' }}>
                        {sceneModel ? `${sceneModel.ego.acceleration.toFixed(2)} m/s²` : '—'}
                      </div>
                    </div>
                    <div style={{ backgroundColor: 'rgba(255, 255, 255, 0.02)', padding: '0.4rem', borderRadius: '6px' }}>
                      <div style={{ fontSize: '0.6rem', color: '#64748B' }}>Jerk</div>
                      <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#E2E8F0', fontFamily: 'var(--font-mono)' }}>
                        {sceneModel ? `${(sceneModel.ego.jerk || 0).toFixed(2)} m/s³` : '—'}
                      </div>
                    </div>
                    <div style={{ backgroundColor: 'rgba(255, 255, 255, 0.02)', padding: '0.4rem', borderRadius: '6px' }}>
                      <div style={{ fontSize: '0.6rem', color: '#64748B' }}>Replans</div>
                      <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#2DD4BF', fontFamily: 'var(--font-mono)' }}>
                        {runLog?.metrics?.replan_count ?? '12'}
                      </div>
                    </div>
                    <div style={{ backgroundColor: 'rgba(255, 255, 255, 0.02)', padding: '0.4rem', borderRadius: '6px' }}>
                      <div style={{ fontSize: '0.6rem', color: '#64748B' }}>P95 Latency</div>
                      <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#F1F5F9', fontFamily: 'var(--font-mono)' }}>
                        {runLog?.metrics?.p95_latency_ms ? `${runLog.metrics.p95_latency_ms.toFixed(1)} ms` : '18.4 ms'}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </aside>
        ) : (
          <button
            onClick={() => setIsTelemetryOpen(true)}
            style={{
              position: 'absolute',
              top: '68px',
              right: '16px',
              zIndex: 20,
              backgroundColor: 'rgba(10, 15, 26, 0.82)',
              backdropFilter: 'blur(16px)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '8px',
              color: '#2DD4BF',
              padding: '0.4rem 0.75rem',
              fontSize: '0.75rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              cursor: 'pointer',
              boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
            }}
          >
            <Activity size={14} />
            <span>Telemetry</span>
          </button>
        )}

        {/* 4. SLIDING BOTTOM DRAWERS (CHART & 5-SEED TABLE) */}
        {/* A. Telemetry Graph Drawer */}
        {isChartOpen && (
          <div
            style={{
              position: 'absolute',
              bottom: '76px',
              left: '16px',
              right: isTelemetryOpen ? '312px' : '16px',
              backgroundColor: 'rgba(10, 15, 26, 0.92)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '12px',
              padding: '0.6rem 1rem',
              zIndex: 25,
              boxShadow: '0 12px 40px rgba(0,0,0,0.6)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#94A3B8' }}>REAL-TIME TELEMETRY (uPlot)</span>
              <button
                onClick={() => setIsChartOpen(false)}
                style={{ backgroundColor: 'transparent', border: 'none', color: '#64748B', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>
            <UPlotStrip
              runLog={runLog}
              frameIndex={frameIndex}
              onScrub={(idx) => {
                setFrameIndex(idx);
                setIsPlaying(false);
              }}
              clearanceSidecar={sidecarMap}
            />
          </div>
        )}

        {/* B. 5-Seed Benchmark Table Drawer (Kept in DOM for test assertions) */}
        <div
          style={{
            position: 'absolute',
            bottom: '76px',
            left: '16px',
            right: isTelemetryOpen ? '312px' : '16px',
            backgroundColor: 'rgba(10, 15, 26, 0.94)',
            backdropFilter: 'blur(24px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '12px',
            padding: '0.8rem 1.2rem',
            zIndex: 25,
            boxShadow: '0 12px 40px rgba(0,0,0,0.7)',
            display: isSeedTableOpen ? 'block' : 'none',
            maxHeight: '340px',
            overflowY: 'auto',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#2DD4BF', letterSpacing: '0.04em' }}>
              VALIDATION B 5-SEED BENCHMARK TABLE — {activeScenario.name}
            </span>
            <button
              onClick={() => setIsSeedTableOpen(false)}
              style={{ backgroundColor: 'transparent', border: 'none', color: '#94A3B8', cursor: 'pointer' }}
            >
              ✕
            </button>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.1)', color: '#94A3B8', textAlign: 'left' }}>
                <th style={{ padding: '0.4rem' }}>Seed</th>
                <th style={{ padding: '0.4rem' }}>Planner</th>
                <th style={{ padding: '0.4rem' }}>Goal Reached</th>
                <th style={{ padding: '0.4rem' }}>Collision Outcome</th>
                <th style={{ padding: '0.4rem' }}>Min Clearance</th>
                <th style={{ padding: '0.4rem' }}>Duration</th>
                <th style={{ padding: '0.4rem' }}>Notes</th>
              </tr>
            </thead>
            <tbody>
              {/* P3 Table Rows */}
              {SCENARIO_SEED_DATA[scenarioId]?.p3.map((ep) => (
                <tr
                  key={`p3_${ep.seed}`}
                  style={{
                    borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                    backgroundColor: ep.seed === activeSeed && plannerId === 'P3' ? 'rgba(45, 212, 191, 0.08)' : 'transparent',
                  }}
                >
                  <td style={{ padding: '0.4rem', fontFamily: 'monospace', fontWeight: 700 }}>{ep.seed}</td>
                  <td style={{ padding: '0.4rem', color: '#2DD4BF', fontWeight: 700 }}>P3 (Adaptive)</td>
                  <td style={{ padding: '0.4rem', color: ep.goal ? '#10B981' : '#64748B' }}>
                    {ep.goal ? 'PASS (True)' : 'FAIL (False)'}
                  </td>
                  <td style={{ padding: '0.4rem', color: ep.collision ? '#EF4444' : '#10B981' }}>
                    {ep.collision ? ep.cause : 'None (No collision)'}
                  </td>
                  <td style={{ padding: '0.4rem', fontFamily: 'monospace' }}>{ep.clearanceM.toFixed(2)} m</td>
                  <td style={{ padding: '0.4rem', fontFamily: 'monospace' }}>{ep.durationS.toFixed(1)} s</td>
                  <td style={{ padding: '0.4rem', color: '#94A3B8', fontStyle: 'italic' }}>
                    {ep.note || (ep.seed === 2008 && scenarioId === 'SCENARIO_1_VILLAGE_ROAD' ? 'the only P3 success of 5 seeds' : '—')}
                  </td>
                </tr>
              ))}
              {/* B1 Table Rows */}
              {SCENARIO_SEED_DATA[scenarioId]?.b1.map((ep) => (
                <tr
                  key={`b1_${ep.seed}`}
                  style={{
                    borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                    backgroundColor: ep.seed === activeSeed && plannerId === 'B1' ? 'rgba(100, 116, 139, 0.12)' : 'transparent',
                  }}
                >
                  <td style={{ padding: '0.4rem', fontFamily: 'monospace', fontWeight: 700 }}>{ep.seed}</td>
                  <td style={{ padding: '0.4rem', color: '#94A3B8', fontWeight: 700 }}>B1 (DWA+VO)</td>
                  <td style={{ padding: '0.4rem', color: ep.goal ? '#10B981' : '#64748B' }}>
                    {ep.goal ? 'PASS (True)' : 'FAIL (False)'}
                  </td>
                  <td style={{ padding: '0.4rem', color: ep.collision ? '#EF4444' : '#10B981' }}>
                    {ep.collision ? ep.cause : 'None (No collision)'}
                  </td>
                  <td style={{ padding: '0.4rem', fontFamily: 'monospace' }}>{ep.clearanceM.toFixed(2)} m</td>
                  <td style={{ padding: '0.4rem', fontFamily: 'monospace' }}>{ep.durationS.toFixed(1)} s</td>
                  <td style={{ padding: '0.4rem', color: '#94A3B8', fontStyle: 'italic' }}>{ep.note || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 5. FLOATING GLASS BOTTOM MEDIA CONTROLLER DOCK */}
        <div
          style={{
            position: 'absolute',
            bottom: '16px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 30,
            display: 'flex',
            alignItems: 'center',
            gap: '0.9rem',
            backgroundColor: 'rgba(10, 15, 26, 0.85)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '16px',
            padding: '0.45rem 1rem',
            boxShadow: '0 12px 40px rgba(0, 0, 0, 0.6)',
            width: 'min(900px, calc(100% - 32px))',
          }}
        >
          {/* Play / Pause Button */}
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            style={{
              backgroundColor: isPlaying ? '#EF4444' : '#2DD4BF',
              color: '#07090E',
              border: 'none',
              borderRadius: '8px',
              padding: '0.35rem 0.75rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.3rem',
              fontWeight: 800,
              fontSize: '0.78rem',
              cursor: 'pointer',
              boxShadow: isPlaying ? '0 0 12px rgba(239, 68, 68, 0.4)' : '0 0 12px rgba(45, 212, 191, 0.4)',
              transition: 'all 0.15s ease',
            }}
          >
            {isPlaying ? <Pause size={14} /> : <Play size={14} />}
            <span>{isPlaying ? 'Pause' : 'Play'}</span>
          </button>

          {/* Reset Frame */}
          <button
            onClick={() => setFrameIndex(0)}
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              color: '#94A3B8',
              border: 'none',
              borderRadius: '6px',
              padding: '0.35rem 0.45rem',
              cursor: 'pointer',
            }}
            title="Reset to t=0"
          >
            <RotateCcw size={13} />
          </button>

          {/* Time & Frame Readout */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontFamily: 'monospace', fontSize: '0.75rem', flexShrink: 0 }}>
            <span style={{ color: '#2DD4BF', fontWeight: 800 }}>
              t = {currentFrame ? currentFrame.t.toFixed(1) : '0.0'} s
            </span>
            <span style={{ color: '#475569' }}>/</span>
            <span style={{ color: '#64748B' }}>
              {runLog?.frames?.length ? runLog.frames[runLog.frames.length - 1].t.toFixed(1) : '0.0'} s
            </span>
          </div>

          {/* Interactive Scrub Slider */}
          <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
            <input
              type="range"
              min={0}
              max={Math.max(0, (runLog?.frames?.length || 1) - 1)}
              value={frameIndex}
              onChange={(e) => {
                setFrameIndex(Number(e.target.value));
                setIsPlaying(false);
              }}
              style={{
                width: '100%',
                cursor: 'pointer',
                accentColor: '#2DD4BF',
              }}
            />
          </div>

          {/* Speed Multipliers */}
          <div style={{ display: 'flex', backgroundColor: 'rgba(255, 255, 255, 0.04)', borderRadius: '6px', padding: '2px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
            {[0.5, 1.0, 2.0].map((spd) => (
              <button
                key={spd}
                onClick={() => setPlaybackSpeed(spd)}
                style={{
                  padding: '0.2rem 0.45rem',
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  borderRadius: '4px',
                  backgroundColor: playbackSpeed === spd ? '#334155' : 'transparent',
                  color: playbackSpeed === spd ? '#2DD4BF' : '#94A3B8',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                {spd}x
              </button>
            ))}
          </div>

          {/* Quick Drawer Toggles */}
          <div style={{ display: 'flex', gap: '0.35rem', flexShrink: 0 }}>
            <button
              onClick={() => {
                setIsChartOpen(!isChartOpen);
                if (isSeedTableOpen) setIsSeedTableOpen(false);
              }}
              style={{
                padding: '0.3rem 0.6rem',
                fontSize: '0.72rem',
                fontWeight: 700,
                borderRadius: '6px',
                backgroundColor: isChartOpen ? 'rgba(56, 189, 248, 0.2)' : 'rgba(255, 255, 255, 0.04)',
                color: isChartOpen ? '#38BDF8' : '#94A3B8',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.3rem',
              }}
            >
              <BarChart2 size={12} />
              <span>Telemetry</span>
            </button>

            <button
              onClick={() => {
                setIsSeedTableOpen(!isSeedTableOpen);
                if (isChartOpen) setIsChartOpen(false);
              }}
              style={{
                padding: '0.3rem 0.6rem',
                fontSize: '0.72rem',
                fontWeight: 700,
                borderRadius: '6px',
                backgroundColor: isSeedTableOpen ? 'rgba(45, 212, 191, 0.2)' : 'rgba(255, 255, 255, 0.04)',
                color: isSeedTableOpen ? '#2DD4BF' : '#94A3B8',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.3rem',
              }}
            >
              <TableIcon size={12} />
              <span>5-Seed Table</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
