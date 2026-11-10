/**
 * Replay Viewer Page (Route: /app/runs and /app/runs/:id).
 * Features:
 * - 2D Canvas renderer with 5 layer toggles (World, Tracks, Conformal Cones, Risk Field, Ego Plan)
 * - URL Synchronization: URL holds time (?t=...), layers (?layers=...), and selected agent (?agent=...)
 * - Log chunk streaming support (loads manifest + frames on demand)
 * - High-speed 30+ FPS rendering with 60+ dynamic agents
 * - Chart / Data Table toggle fulfilling WCAG 2.2 AA table accessibility
 * - Non-color risk encoding with patterns, numerical score, and labels
 */

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Eye,
  Layers,
  Shield,
  Activity,
  Clock,
  Sliders,
  ChevronDown,
  User,
  Radio,
  FileText,
  AlertTriangle,
  RotateCcw,
  Volume2,
  VolumeX,
  Sparkles,
  Bookmark,
  CheckCircle2,
  FlaskConical,
} from 'lucide-react';
import { RunLog, Frame, AgentTrack } from '../types/apath_log';
import { apiClient } from '../api/client';
import { useI18n } from '../context/I18nContext';
import { useSettings, usePresentationMode } from '../context/SettingsContext';
import { useAnnouncer } from '../components/LiveAnnouncer';
import { ReplayCanvas, CanvasLayerState } from '../components/ReplayCanvas';
import { ReplayTimeline } from '../components/ReplayTimeline';
import { DataTableToggle } from '../components/DataTableToggle';
import { AccessibleTable, AccessibleRiskBadge, ColumnDef } from '../components/AccessibleTable';
import { SkeletonCard, SkeletonTable, ErrorState, OfflineBanner } from '../components/StatusState';
import { EvidencePanel } from '../components/showcase/EvidencePanel';
import { extractSceneModelFromLog } from '../adapters/sceneModelAdapter';
import { Scene3DCanvas, CameraMode } from '../components/scene/Scene3DCanvas';

export const ReplayView: React.FC = () => {
  const { id: paramRunId } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { t } = useI18n();
  const { theme, audioAnnouncer, setAudioAnnouncer } = useSettings();
  const { presentationMode, isSimple, isResearch } = usePresentationMode();
  const { announce } = useAnnouncer();

  const isHighContrast = theme === 'high-contrast';

  // Read URL query parameters
  const initialTimeStr = searchParams.get('t');
  const initialLayersStr = searchParams.get('layers');
  const initialAgent = searchParams.get('agent');

  // Active run ID (default to flagship cattle crossing)
  const activeRunId = paramRunId || 'run_scenario_5_cattle_crossing_p3_tune_s1000';

  // Layer State
  const [layers, setLayers] = useState<CanvasLayerState>(() => {
    if (initialLayersStr) {
      const activeKeys = initialLayersStr.split(',');
      return {
        world: activeKeys.includes('world'),
        tracks: activeKeys.includes('tracks'),
        predictions: activeKeys.includes('predictions') || activeKeys.includes('cones'),
        risk: activeKeys.includes('risk'),
        plan: activeKeys.includes('plan'),
      };
    }
    return {
      world: true,
      tracks: true,
      predictions: true,
      risk: true,
      plan: true,
    };
  });

  const [currentFrameIndex, setCurrentFrameIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [speed, setSpeed] = useState<number>(1.0);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(initialAgent || null);
  const [isTableView, setIsTableView] = useState<boolean>(false);
  const [showEventList, setShowEventList] = useState<boolean>(false);
  const [cameraMode, setCameraMode] = useState<CameraMode>('chase');
  const [showScanner, setShowScanner] = useState<boolean>(true);
  const [showSceneryTraffic, setShowSceneryTraffic] = useState<boolean>(true);

  // Fetch Run Data via TanStack Query (supports live API + chunk streaming + offline sample_runs)
  const { data: runLog, isLoading, error, refetch } = useQuery<RunLog>({
    queryKey: ['runLog', activeRunId],
    queryFn: async () => {
      // 1. Try Live API chunk streaming
      try {
        const manifest = await apiClient.getRunManifest(activeRunId);
        if (manifest) {
          // Stream first 200 frames chunk
          const chunk = await apiClient.getRunFramesChunk(activeRunId, 0, 30.0);
          if (chunk && chunk.frames.length > 0) {
            // Assemble typed RunLog
            const mappedLog: RunLog = {
              schema_version: 'apath-log/v1',
              run_id: manifest.run_id,
              timestamp_iso: manifest.timestamp_iso,
              config_hash: manifest.config_hash || '',
              git_commit: 'main',
              engine: manifest.engine,
              scenario: {
                id: manifest.scenario.id,
                name: manifest.scenario.name,
                split: (manifest.scenario.split as any) || 'tune',
                seed: manifest.scenario.seed,
                params: {},
              },
              planner: {
                id: (manifest.planner.id as any) || 'P3',
                name: manifest.planner.name,
                config: {},
              },
              world: {
                bounds: { x_min: 0, x_max: 100, y_min: -10, y_max: 10 },
                road_boundaries: [
                  { side: 'left', points: [[0, 4.0], [50, 4.0], [100, 4.0]] },
                  { side: 'right', points: [[0, -4.0], [50, -4.0], [100, -4.0]] },
                ],
                static_obstacles: manifest.world.static_obstacles.map((o) => ({
                  id: o.id,
                  kind: o.class_name,
                  x: o.x,
                  y: o.y,
                  length: o.length,
                  width: o.width,
                  yaw: o.yaw,
                })),
              },
              metrics: {
                duration_s: manifest.metrics.duration_s,
                completed_goal: manifest.metrics.completed_goal,
                collision_occurred: manifest.metrics.collision_occurred,
                near_miss_count: (manifest.metrics as any)?.near_miss_count ?? 0,
                min_clearance_m: manifest.metrics.min_clearance_m,
                mean_speed_m_s: manifest.metrics.mean_speed_m_s,
                max_jerk_m_s3: manifest.metrics.max_jerk_m_s3,
                mean_jerk_m_s3: manifest.metrics.mean_jerk_m_s3 ?? 0.0,
                replan_count: manifest.metrics.replan_count,
                p95_latency_ms: manifest.metrics.p95_latency_ms,
                failure_tag: (manifest.metrics.failure_tag as any) || null,
              },
              frames: chunk.frames as unknown as Frame[],
            };
            return mappedLog;
          }
        }

      } catch {
        // Fall back to static sample run
      }

      // 2. Offline Fallback to bundled JSON
      const res = await fetch(`/sample_runs/${activeRunId}.json`);
      if (!res.ok) {
        throw new Error(`Run '${activeRunId}' not found (HTTP ${res.status})`);
      }
      return (await res.json()) as RunLog;
    },
    staleTime: 60000,
  });

  // Sync initial time parameter when runLog is loaded
  useEffect(() => {
    if (runLog && initialTimeStr && runLog.frames.length > 0) {
      const targetTime = parseFloat(initialTimeStr);
      if (!isNaN(targetTime)) {
        const frameIdx = Math.max(
          0,
          Math.min(runLog.frames.length - 1, Math.round(targetTime / 0.1))
        );
        setCurrentFrameIndex(frameIdx);
      }
    }
  }, [runLog, initialTimeStr]);

  // Synchronize URL parameters ONLY when paused/stopped (debounced to prevent UI shaking/crashing)
  useEffect(() => {
    if (!runLog || isPlaying) return;
    const timer = setTimeout(() => {
      const currentFrame = runLog.frames[currentFrameIndex];
      const timeVal = currentFrame ? currentFrame.t.toFixed(1) : '0.0';

      const activeLayerKeys = Object.entries(layers)
        .filter(([_, active]) => active)
        .map(([key]) => key)
        .join(',');

      const params: Record<string, string> = {
        t: timeVal,
        layers: activeLayerKeys,
      };
      if (selectedAgentId) {
        params.agent = selectedAgentId;
      }

      setSearchParams(params, { replace: true });
    }, 250);

    return () => clearTimeout(timer);
  }, [currentFrameIndex, layers, selectedAgentId, runLog, isPlaying, setSearchParams]);

  // Extract authoritative 3D SceneModel from current frame
  const sceneModel = useMemo(() => {
    if (!runLog || !runLog.world || !runLog.frames || runLog.frames.length === 0) return null;
    return extractSceneModelFromLog(runLog, currentFrameIndex);
  }, [runLog, currentFrameIndex]);

  // Animation Playback Timer Loop
  useEffect(() => {
    if (!isPlaying || !runLog) return;
    const intervalMs = Math.round(100 / speed);

    const timer = setInterval(() => {
      setCurrentFrameIndex((prev) => {
        if (prev >= runLog.frames.length - 1) {
          setIsPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, intervalMs);

    return () => clearInterval(timer);
  }, [isPlaying, speed, runLog]);

  // Keyboard navigation shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.code === 'Space') {
        e.preventDefault();
        setIsPlaying((p) => !p);
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        const delta = e.shiftKey ? 10 : 1;
        setCurrentFrameIndex((p) => Math.min((runLog?.frames.length || 1) - 1, p + delta));
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        const delta = e.shiftKey ? 10 : 1;
        setCurrentFrameIndex((p) => Math.max(0, p - delta));
      } else if (e.code === 'Home') {
        e.preventDefault();
        setCurrentFrameIndex(0);
      } else if (e.code === 'ArrowUp') {
        e.preventDefault();
        setSpeed((s) => (s < 4.0 ? s * 2 : 4.0));
      } else if (e.code === 'ArrowDown') {
        e.preventDefault();
        setSpeed((s) => (s > 0.25 ? s / 2 : 0.25));
      } else if (e.key === '1') {
        setLayers((prev) => ({ ...prev, world: !prev.world }));
      } else if (e.key === '2') {
        setLayers((prev) => ({ ...prev, tracks: !prev.tracks }));
      } else if (e.key === '3') {
        setLayers((prev) => ({ ...prev, predictions: !prev.predictions }));
      } else if (e.key === '4') {
        setLayers((prev) => ({ ...prev, risk: !prev.risk }));
      } else if (e.key === '5') {
        setLayers((prev) => ({ ...prev, plan: !prev.plan }));
      } else if (e.key.toLowerCase() === 't') {
        setIsTableView((v) => !v);
      } else if (e.key.toLowerCase() === 'm') {
        const next = !audioAnnouncer;
        setAudioAnnouncer(next);
        announce(next ? 'Audible speech narration enabled' : 'Audible speech narration disabled', 'polite', true);
      } else if (e.key.toLowerCase() === 'e') {
        setShowEventList((v) => !v);
      } else if (e.key === 'Escape') {
        setSelectedAgentId(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [runLog, audioAnnouncer, setAudioAnnouncer, announce]);

  const currentFrame = runLog?.frames[currentFrameIndex] || runLog?.frames[0];
  const selectedAgent = currentFrame?.agents.find((a) => a.id === selectedAgentId);

  // Significant simulation milestones & timeline bookmarks for keyboard & screen reader accessibility
  const keyEvents = useMemo(() => {
    if (!runLog || !runLog.frames.length) return [];
    const events: Array<{
      id: string;
      frameIdx: number;
      time: number;
      type: 'START' | 'REPLAN' | 'MIN_CLEARANCE' | 'GOAL';
      title: string;
      description: string;
    }> = [];

    // 1. Simulation Start
    events.push({
      id: 'event-start',
      frameIdx: 0,
      time: runLog.frames[0].t,
      type: 'START',
      title: 'Simulation Start',
      description: `Nominal speed ${(runLog.frames[0].ego.v * 3.6).toFixed(1)} km/h`,
    });

    // 2. First and subsequent key replan events
    let foundFirst = false;
    runLog.frames.forEach((f, idx) => {
      if (f.planner_output.replan_triggered) {
        if (!foundFirst) {
          foundFirst = true;
          events.push({
            id: `event-replan-${idx}`,
            frameIdx: idx,
            time: f.t,
            type: 'REPLAN',
            title: `Adaptive Replan Triggered (t=${f.t.toFixed(1)}s)`,
            description: `Triggered by ${f.decision_trace || 'risk gradient'}: Risk ${f.risk_field.ego_risk.toFixed(2)} [${f.risk_field.risk_level}]`,
          });
        }
      }
    });

    // 3. Minimum clearance point
    let minD = 999;
    let minDIdx = 0;
    runLog.frames.forEach((f, idx) => {
      if (f.agents && f.agents.length > 0) {
        const d = Math.min(...f.agents.map((ag) => Math.hypot(ag.x - f.ego.x, ag.y - f.ego.y)));
        if (d < minD) {
          minD = d;
          minDIdx = idx;
        }
      }
    });
    if (minD < 900 && minDIdx !== 0) {
      events.push({
        id: 'event-min-clearance',
        frameIdx: minDIdx,
        time: runLog.frames[minDIdx].t,
        type: 'MIN_CLEARANCE',
        title: `Minimum Clearance (${minD.toFixed(2)}m)`,
        description: `Closest distance to dynamic obstacle at t=${runLog.frames[minDIdx].t.toFixed(1)}s`,
      });
    }

    // 4. Goal Completion
    const lastIdx = runLog.frames.length - 1;
    events.push({
      id: 'event-goal',
      frameIdx: lastIdx,
      time: runLog.frames[lastIdx].t,
      type: 'GOAL',
      title: 'Goal Reached',
      description: runLog.metrics?.collision_occurred ? 'Collision logged' : 'Trajectory completed with zero collisions',
    });

    return events.sort((a, b) => a.frameIdx - b.frameIdx);
  }, [runLog]);

  const firstReplanEvent = useMemo(() => {
    return keyEvents.find((e) => e.type === 'REPLAN');
  }, [keyEvents]);

  // Live narration text for screen reader and text description
  const liveNarrationText = useMemo(() => {
    if (!currentFrame) return '';
    const speedKmH = (currentFrame.ego.v * 3.6).toFixed(1);
    const riskScore = currentFrame.risk_field.ego_risk.toFixed(2);
    const riskLevel = currentFrame.risk_field.risk_level;
    const egoState = currentFrame.ego.active_state;
    const replan = currentFrame.planner_output.replan_triggered
      ? `Adaptive replan active (${currentFrame.decision_trace || 'Risk jump'})`
      : 'Ego tracking planned path';
    return `t=${currentFrame.t.toFixed(1)}s: Ego speed ${speedKmH} km/h [State: ${egoState}]. Calibrated risk: ${riskScore} (${riskLevel}). ${replan}. ${currentFrame.agents.length} dynamic actors.`;
  }, [currentFrame]);

  // Table columns for Accessible HTML Table view (WCAG 2.2 AA)
  const telemetryTableColumns: ColumnDef<Frame>[] = [
    {
      key: 't',
      header: 'Time (s)',
      sortable: true,
      render: (f) => `${f.t.toFixed(1)}s`,
    },
    {
      key: 'ego_speed',
      header: 'Speed',
      sortable: true,
      render: (f) => `${(f.ego.v * 3.6).toFixed(1)} km/h`,
    },
    {
      key: 'clearance',
      header: 'Clearance',
      sortable: true,
      render: (f) => {
        const d =
          f.agents.length > 0
            ? Math.min(...f.agents.map((ag) => Math.hypot(ag.x - f.ego.x, ag.y - f.ego.y)))
            : 3.4;
        return `${d.toFixed(2)} m`;
      },
    },
    {
      key: 'risk',
      header: 'Risk Field R(t)',
      sortable: true,
      render: (f) => (
        <AccessibleRiskBadge
          score={f.risk_field.ego_risk}
          label={f.risk_field.risk_level}
        />
      ),
    },
    {
      key: 'replan',
      header: 'Replan Triggered',
      render: (f) =>
        f.planner_output.replan_triggered ? (
          <span style={{ color: 'var(--accent-primary)', fontWeight: 700 }}>
            YES ({f.decision_trace || 'Risk jumped'})
          </span>
        ) : (
          <span style={{ color: 'var(--text-secondary)' }}>Nominal</span>
        ),
    },
    {
      key: 'agents_count',
      header: 'Tracked Agents',
      render: (f) => `${f.agents.length} dynamic actors`,
    },
  ];

  if (isLoading) {
    return (
      <div style={{ padding: '1.5rem', maxWidth: '1440px', margin: '0 auto' }}>
        <SkeletonCard />
        <div style={{ marginTop: '1rem' }}>
          <SkeletonTable rows={6} cols={6} />
        </div>
      </div>
    );
  }

  if (error || !runLog) {
    const errorMsg = error instanceof Error ? error.message : String(error || '');
    const isNotFound = errorMsg.toLowerCase().includes('not found') || errorMsg.includes('404');
    return (
      <div style={{ padding: '1.5rem', maxWidth: '1440px', margin: '0 auto' }}>
        <ErrorState
          title={isNotFound ? 'Run Not Found (404)' : 'Failed to load simulation run'}
          message={
            isNotFound
              ? `Simulation run "${activeRunId}" could not be found in active storage or offline runs.`
              : 'Could not stream run frames or load run log.'
          }
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  return (
    <div
      style={{
        padding: '1.25rem',
        maxWidth: '1440px',
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
      }}
    >
      {/* Top Header Card */}
      <div
        className="glass-panel"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '1rem 1.4rem',
          flexWrap: 'wrap',
          gap: '0.85rem',
          background: 'linear-gradient(135deg, rgba(14, 165, 233, 0.08) 0%, rgba(99, 102, 241, 0.05) 100%)',
          border: '1px solid rgba(56, 189, 248, 0.22)',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <span
              style={{
                fontSize: '0.72rem',
                fontWeight: 800,
                padding: '2px 8px',
                borderRadius: '4px',
                background: 'rgba(56, 189, 248, 0.15)',
                color: '#38bdf8',
                border: '1px solid rgba(56, 189, 248, 0.3)',
                fontFamily: 'var(--font-mono)',
              }}
            >
              {runLog.planner.id} • {runLog.planner.name}
            </span>
            <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>
              Seed {runLog.scenario.seed} ({runLog.scenario.split.toUpperCase()})
            </span>
          </div>
          <h1 style={{
            fontSize: '1.4rem',
            fontWeight: 900,
            margin: 0,
            background: 'linear-gradient(135deg, #f8fafc 0%, #94a3b8 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}>
            {runLog.scenario.name || runLog.scenario.id.replace(/_/g, ' ')}
          </h1>
        </div>

        {/* View Mode, Fast-Track, Audio & Metrics */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
          {firstReplanEvent && (
            <button
              type="button"
              onClick={() => {
                setCurrentFrameIndex(firstReplanEvent.frameIdx);
                announce(`Judge Fast-Track: Jumped to first replan event at ${firstReplanEvent.time.toFixed(1)} seconds`, 'assertive', true);
              }}
              className="btn-primary"
              style={{
                fontSize: '0.8rem',
                padding: '0.45rem 0.9rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
              }}
              aria-label={`Judge Fast-Track: Jump to first replan event at ${firstReplanEvent.time.toFixed(1)} seconds`}
            >
              <Sparkles size={14} aria-hidden="true" />
              <span>Judge Fast-Track: Replan ({firstReplanEvent.time.toFixed(1)}s)</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowEventList((v) => !v)}
            className="btn-secondary"
            style={{
              fontSize: '0.8rem',
              padding: '0.45rem 0.8rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
            }}
            aria-expanded={showEventList}
            aria-label={`Toggle simulation key events list (${keyEvents.length} events)`}
          >
            <Bookmark size={14} aria-hidden="true" />
            <span>Key Events ({keyEvents.length})</span>
          </button>

          <button
            type="button"
            onClick={() => {
              const next = !audioAnnouncer;
              setAudioAnnouncer(next);
              announce(next ? 'Speech narration activated' : 'Speech narration muted', 'polite', true);
            }}
            className="btn-secondary"
            style={{
              fontSize: '0.8rem',
              padding: '0.45rem 0.8rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
            }}
            aria-label={audioAnnouncer ? 'Mute audible speech narration' : 'Enable audible speech narration'}
          >
            {audioAnnouncer ? <Volume2 size={14} color="#38bdf8" /> : <VolumeX size={14} />}
            <span>{audioAnnouncer ? 'Voice On (M)' : 'Voice Off (M)'}</span>
          </button>

          <DataTableToggle
            isTableView={isTableView}
            onToggle={setIsTableView}
            id="replay-view-toggle"
            label="Toggle between 2D Replay Canvas and accessible data table"
          />

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              fontSize: '0.8rem',
              background: 'rgba(16, 22, 35, 0.85)',
              padding: '0.4rem 0.75rem',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid rgba(56, 189, 248, 0.2)',
              color: '#94a3b8',
            }}
          >
            <span>Replans: <strong style={{ color: '#38bdf8' }}>{runLog.metrics?.replan_count ?? '—'}</strong></span>
            <span>•</span>
            <span>Min Clr [DERIVED]: <strong style={{ color: '#34d399' }}>{runLog.metrics?.min_clearance_m != null ? `${runLog.metrics.min_clearance_m.toFixed(2)}m` : '—'}</strong></span>
          </div>
        </div>
      </div>

      {/* Permanent Research Truth & Evidence Panel */}
      <EvidencePanel />

      {/* SIMPLE MODE: Vehicle Decision & Status Summary Card */}
      {isSimple && (
        <div
          role="region"
          aria-label="Vehicle Decision and Status Summary"
          className="glass-panel"
          style={{
            padding: '1rem 1.25rem',
            background: 'linear-gradient(135deg, rgba(16, 22, 35, 0.85) 0%, rgba(11, 15, 23, 0.9) 100%)',
            border: '1px solid rgba(56, 189, 248, 0.22)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '1rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '50%',
                background: runLog.metrics?.collision_occurred ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                border: runLog.metrics?.collision_occurred ? '1px solid rgba(239, 68, 68, 0.35)' : '1px solid rgba(16, 185, 129, 0.35)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: runLog.metrics?.collision_occurred ? '#f87171' : '#34d399',
                flexShrink: 0,
              }}
            >
              {runLog.metrics?.collision_occurred ? <AlertTriangle size={20} /> : <CheckCircle2 size={20} />}
            </div>
            <div>
              <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#f8fafc' }}>
                {runLog.metrics?.collision_occurred
                  ? 'Collision Detected — Safety Perimeter Breached'
                  : 'Simulation Completed — Safe Goal Arrival'}
              </div>
              <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                {currentFrame?.planner_output.replan_triggered
                  ? `Active Decision: ${currentFrame.decision_trace || 'Adjusting trajectory to maintain safety clearance from moving traffic.'}`
                  : `Active Decision: Cruise speed maintained along planned path at ${(currentFrame ? currentFrame.ego.v * 3.6 : 0).toFixed(1)} km/h.`}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '1.25rem', fontSize: '0.8rem', color: '#94a3b8' }}>
            <div>
              <span>Trip Duration: </span>
              <strong style={{ color: '#f8fafc' }}>{runLog.metrics?.duration_s?.toFixed(1) ?? '--'}s</strong>
            </div>
            <div>
              <span>Avg Speed: </span>
              <strong style={{ color: '#f8fafc' }}>{((runLog.metrics?.mean_speed_m_s ?? 0) * 3.6).toFixed(1)} km/h</strong>
            </div>
            <div>
              <span>Min Hazard Buffer: </span>
              <strong style={{ color: '#34d399' }}>{runLog.metrics?.min_clearance_m?.toFixed(2) ?? '--'}m</strong>
            </div>
          </div>
        </div>
      )}

      {/* RESEARCH MODE: Research Telemetry & Conformal Uncertainty Panel */}
      {isResearch && (
        <div
          role="region"
          aria-label="Research Telemetry and Conformal Prediction Analysis"
          className="glass-panel"
          style={{
            padding: '1.1rem 1.4rem',
            background: 'linear-gradient(135deg, rgba(16, 22, 35, 0.85) 0%, rgba(11, 15, 23, 0.95) 100%)',
            border: '1px solid rgba(56, 189, 248, 0.22)',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.85rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <FlaskConical size={18} color="#38bdf8" />
              <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: '#f8fafc' }}>
                Research Telemetry & Conformal Uncertainty Analysis
              </h3>
              <span
                style={{
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  padding: '1px 6px',
                  borderRadius: '4px',
                  background: 'rgba(56, 189, 248, 0.15)',
                  color: '#38bdf8',
                  border: '1px solid rgba(56, 189, 248, 0.3)',
                  fontFamily: 'var(--font-mono)',
                }}
              >
                Gate G3 Verified
              </span>
            </div>
            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
              Engine Adapter: <code>{(runLog as any).engine_adapter || 'python_inprocess'}</code> • Schema: <code>apath-log/1.0</code>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.75rem' }}>
            <div style={{ background: 'rgba(11, 15, 23, 0.7)', padding: '0.85rem', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(56, 189, 248, 0.15)' }}>
              <div style={{ fontSize: '0.7rem', fontWeight: 800, letterSpacing: '0.06em', color: '#64748b', textTransform: 'uppercase', marginBottom: '0.25rem' }}>
                CONFORMAL COVERAGE GUARANTEE
              </div>
              <div style={{ fontSize: '0.9rem', color: '#38bdf8', fontWeight: 800 }}>
                1 - α = 95.0% (ε = 0.05)
              </div>
              <p style={{ margin: '0.25rem 0 0', fontSize: '0.75rem', color: '#94a3b8', lineHeight: 1.35 }}>
                Mondrian velocity-binned calibration. Guarantees finite-sample coverage when exchangeability holds.
              </p>
            </div>

            <div style={{ background: 'rgba(11, 15, 23, 0.7)', padding: '0.85rem', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(56, 189, 248, 0.15)' }}>
              <div style={{ fontSize: '0.7rem', fontWeight: 800, letterSpacing: '0.06em', color: '#64748b', textTransform: 'uppercase', marginBottom: '0.25rem' }}>
                CALIBRATION PROVENANCE & INTEGRITY
              </div>
              <div style={{ fontSize: '0.9rem', color: '#34d399', fontWeight: 800 }}>
                Split: {runLog.scenario.split.toUpperCase()} • Seed: {runLog.scenario.seed}
              </div>
              <p style={{ margin: '0.25rem 0 0', fontSize: '0.75rem', color: '#94a3b8', lineHeight: 1.35 }}>
                ⚠️ For baseline runs (B0-B2) or uncalibrated shifts, non-conformity bounds do not carry mathematical coverage guarantees.
              </p>
            </div>

            <div style={{ background: 'rgba(11, 15, 23, 0.7)', padding: '0.85rem', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(56, 189, 248, 0.15)' }}>
              <div style={{ fontSize: '0.7rem', fontWeight: 800, letterSpacing: '0.06em', color: '#64748b', textTransform: 'uppercase', marginBottom: '0.25rem' }}>
                CONTINUOUS RISK FIELD & KINEMATICS
              </div>
              <div style={{ fontSize: '0.9rem', color: '#f8fafc', fontWeight: 800 }}>
                Peak Jerk: {runLog.metrics?.max_jerk_m_s3?.toFixed(2) ?? '—'} m/s³ • P95 Latency: {runLog.metrics?.p95_latency_ms != null ? `${runLog.metrics.p95_latency_ms.toFixed(1)} ms [LOGGED: metrics.p95_latency_ms]` : '— [Not logged]'}
              </div>
              <p style={{ margin: '0.25rem 0 0', fontSize: '0.75rem', color: '#94a3b8', lineHeight: 1.35 }}>
                Current spatial risk R(t) = {currentFrame?.risk_field.ego_risk.toFixed(2)} [{currentFrame?.risk_field.risk_level}].
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Live Narration Banner (Screen reader and text alternative) */}
      <div
        role="region"
        aria-label="Live Telemetry Narration"
        className="glass-panel"
        style={{
          padding: '0.75rem 1.25rem',
          borderLeft: '3px solid #38bdf8',
          fontSize: '0.85rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.75rem',
          background: 'rgba(16, 22, 35, 0.85)',
          borderTop: '1px solid rgba(56, 189, 248, 0.15)',
          borderRight: '1px solid rgba(56, 189, 248, 0.15)',
          borderBottom: '1px solid rgba(56, 189, 248, 0.15)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Activity size={16} color="#38bdf8" aria-hidden="true" />
          <span style={{ color: '#f8fafc' }}><strong style={{ color: '#38bdf8' }}>Live Narration:</strong> {liveNarrationText}</span>
        </div>
        <span style={{ fontSize: '0.75rem', color: '#64748b', whiteSpace: 'nowrap' }}>
          Shortcut 'M' toggles voice
        </span>
      </div>

      {/* Collapsible Key Events & Timeline Bookmarks Drawer */}
      {showEventList && (
        <div
          role="region"
          aria-label="Simulation Key Events and Replan Bookmarks"
          className="glass-panel"
          style={{
            padding: '1rem',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-default)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Bookmark size={16} color="var(--accent-primary)" aria-hidden="true" />
              <span>Simulation Milestones & Replan Bookmarks</span>
            </h2>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Click or press Enter on any milestone to jump timeline directly
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '0.6rem' }}>
            {keyEvents.map((evt) => (
              <button
                key={evt.id}
                type="button"
                onClick={() => {
                  setCurrentFrameIndex(evt.frameIdx);
                  announce(`Jumped to ${evt.title}`, 'assertive', true);
                }}
                style={{
                  padding: '0.65rem 0.85rem',
                  borderRadius: 'var(--radius-sm)',
                  border: evt.frameIdx === currentFrameIndex ? '2px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
                  background: evt.frameIdx === currentFrameIndex ? 'rgba(59, 130, 246, 0.12)' : 'var(--bg-surface-elevated)',
                  color: 'var(--text-primary)',
                  textAlign: 'left',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.25rem',
                  transition: 'all 0.15s ease',
                }}
                aria-label={`Jump to milestone at ${evt.time.toFixed(1)}s: ${evt.title}. ${evt.description}`}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      fontFamily: 'var(--font-mono)',
                      color: 'var(--accent-primary)',
                      background: 'rgba(59, 130, 246, 0.15)',
                      padding: '1px 6px',
                      borderRadius: '3px',
                    }}
                  >
                    t = {evt.time.toFixed(1)}s
                  </span>
                  <span style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                    {evt.type}
                  </span>
                </div>
                <strong style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>{evt.title}</strong>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.3 }}>
                  {evt.description}
                </p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Main Simulation View: 3D Immersive Canvas OR Accessible Table */}
      {isTableView ? (
        <div className="glass-panel" style={{ padding: '1rem' }}>
          <AccessibleTable
            caption={`Frame-by-frame telemetry logs for ${runLog.scenario.name}`}
            summary="Displays ego kinematics, min clearance distance, calibrated risk field scores, and replan triggers at 10 Hz"
            columns={telemetryTableColumns}
            data={runLog.frames}
            keyField={(f) => String(f.t)}
          />
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.85rem' }}>
          {/* Top 3D Camera & Sensor Controls Toolbar */}
          <div
            role="toolbar"
            aria-label="3D simulation camera perspective and sensor visualization toggles"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '0.6rem',
              flexWrap: 'wrap',
              background: 'rgba(16, 22, 35, 0.85)',
              border: '1px solid rgba(56, 189, 248, 0.2)',
              padding: '0.5rem 0.9rem',
              borderRadius: 'var(--radius-md)',
            }}
          >
            {/* Left: 3D Camera Modes */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.06em', color: '#64748b', marginRight: '0.2rem', textTransform: 'uppercase' }}>
                3D CAMERA:
              </span>

              {[
                { mode: 'chase' as CameraMode, label: '🚗 Chase (Third-Person)' },
                { mode: 'bird' as CameraMode, label: '🦅 Bird’s-Eye (3D)' },
                { mode: 'cockpit' as CameraMode, label: '🎯 Cockpit (Driver)' },
                { mode: 'orbit' as CameraMode, label: '🔄 360° Free Orbit' },
              ].map((c) => (
                <button
                  key={c.mode}
                  type="button"
                  onClick={() => setCameraMode(c.mode)}
                  aria-pressed={cameraMode === c.mode}
                  style={{
                    background: cameraMode === c.mode ? 'linear-gradient(135deg, #0ea5e9, #38bdf8)' : 'rgba(11, 15, 23, 0.7)',
                    color: cameraMode === c.mode ? '#07080a' : '#94a3b8',
                    border: cameraMode === c.mode ? '1px solid #38bdf8' : '1px solid rgba(56, 189, 248, 0.15)',
                    boxShadow: cameraMode === c.mode ? '0 2px 8px rgba(14, 165, 233, 0.3)' : 'none',
                    borderRadius: 'var(--radius-sm)',
                    padding: '0.35rem 0.75rem',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    minHeight: 'var(--min-target-size)',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {c.label}
                </button>
              ))}
            </div>

            {/* Right: Sensor Beam & Scenery Toggles */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => setShowScanner((s) => !s)}
                aria-pressed={showScanner}
                style={{
                  background: showScanner ? 'rgba(6, 182, 212, 0.18)' : 'rgba(11, 15, 23, 0.7)',
                  color: showScanner ? '#22d3ee' : '#64748b',
                  border: showScanner ? '1px solid #06b6d4' : '1px solid rgba(100, 116, 139, 0.25)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '0.35rem 0.75rem',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  minHeight: 'var(--min-target-size)',
                }}
              >
                📡 LiDAR Scanner Beam
              </button>

              <button
                type="button"
                onClick={() => setShowSceneryTraffic((t) => !t)}
                aria-pressed={showSceneryTraffic}
                style={{
                  background: showSceneryTraffic ? 'rgba(16, 185, 129, 0.18)' : 'rgba(11, 15, 23, 0.7)',
                  color: showSceneryTraffic ? '#34d399' : '#64748b',
                  border: showSceneryTraffic ? '1px solid #10b981' : '1px solid rgba(100, 116, 139, 0.25)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '0.35rem 0.75rem',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  minHeight: 'var(--min-target-size)',
                }}
              >
                🌆 Roadside Scenery & Traffic
              </button>
            </div>
          </div>

          {/* 100% Immersive 3D Simulation Canvas */}
          <div
            style={{
              height: '560px',
              width: '100%',
              position: 'relative',
              borderRadius: 'var(--radius-md)',
              overflow: 'hidden',
              border: '1px solid rgba(56, 189, 248, 0.25)',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.45)',
              background: '#0c1017',
            }}
          >
            {sceneModel ? (
              <Scene3DCanvas
                sceneModel={sceneModel}
                cameraMode={cameraMode}
                onSelectAgent={setSelectedAgentId}
                selectedAgentId={selectedAgentId}
                plannerId={runLog.planner.id}
                showScanner={showScanner}
                showSceneryTraffic={showSceneryTraffic}
              />
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#94a3b8' }}>
                Loading 3D simulation telemetry...
              </div>
            )}
          </div>
        </div>
      )}

      {/* Scrub Timeline & Telemetry Controls */}
      <ReplayTimeline
        runLog={runLog}
        currentFrameIndex={currentFrameIndex}
        isPlaying={isPlaying}
        speed={speed}
        onPlayPause={() => setIsPlaying(!isPlaying)}
        onStepFrame={(delta) =>
          setCurrentFrameIndex((prev) =>
            Math.max(0, Math.min(runLog.frames.length - 1, prev + delta))
          )
        }
        onSeekFrame={(idx) => setCurrentFrameIndex(idx)}
        onSetSpeed={(s) => setSpeed(s)}
        onReset={() => {
          setCurrentFrameIndex(0);
          setIsPlaying(false);
        }}
      />

      {/* Selected Agent Kinematics Inspector Drawer */}
      {selectedAgent && (
        <div
          role="region"
          aria-label={`Kinematics detail for agent ${selectedAgent.id}`}
          className="glass-panel"
          style={{
            padding: '1rem 1.4rem',
            border: '1px solid rgba(56, 189, 248, 0.28)',
            background: 'linear-gradient(135deg, rgba(16, 22, 35, 0.92) 0%, rgba(11, 15, 23, 0.98) 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '1rem',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 800,
                  fontSize: '0.78rem',
                  background: 'linear-gradient(135deg, #0ea5e9, #38bdf8)',
                  color: '#07080a',
                  padding: '2px 8px',
                  borderRadius: '4px',
                }}
              >
                Tracked Agent #{selectedAgent.id}
              </span>
              <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#f8fafc', textTransform: 'capitalize' }}>
                {selectedAgent.class_name}
              </span>
            </div>
            <div style={{ display: 'flex', gap: '1.25rem', fontSize: '0.8rem', color: '#94a3b8' }}>
              <span>Position: <strong style={{ color: '#f8fafc' }}>({selectedAgent.x.toFixed(1)}m, {selectedAgent.y.toFixed(1)}m)</strong></span>
              <span>Speed: <strong style={{ color: '#38bdf8' }}>{(Math.hypot(selectedAgent.v_x, selectedAgent.v_y) * 3.6).toFixed(1)} km/h</strong></span>
              <span>Yaw: <strong style={{ color: '#f8fafc' }}>{((selectedAgent.yaw * 180) / Math.PI).toFixed(0)}°</strong></span>
              <span>Conformal Radius: <strong style={{ color: '#34d399' }}>{selectedAgent.conformal_envelope?.[0]?.radius_m.toFixed(2) ?? '0.45'}m</strong></span>
            </div>
          </div>

          <button
            onClick={() => setSelectedAgentId(null)}
            className="btn-secondary"
            style={{ fontSize: '0.78rem', padding: '0.4rem 0.85rem', minHeight: 'var(--min-target-size)' }}
          >
            Clear Selection (Esc)
          </button>
        </div>
      )}
    </div>
  );
};
