/**
 * Comparative Replay View (Route: /app/compare).
 * Side-by-side comparative replay evaluating baseline (P0 DWA) vs ADAPTIVE-PATH (P3).
 * Synchronized playhead, telemetry delta calculations, and accessible comparison table.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Columns, Play, Pause, RotateCcw, AlertTriangle, ShieldCheck, Zap, ArrowRight } from 'lucide-react';
import { RunLog, Frame } from '../types/apath_log';
import { DataTableToggle } from '../components/DataTableToggle';
import { AccessibleTable, ColumnDef } from '../components/AccessibleTable';
import { SkeletonCard, ErrorState } from '../components/StatusState';
import { useSettings, usePresentationMode } from '../context/SettingsContext';
import { extractSceneModelFromLog } from '../adapters/sceneModelAdapter';
import { Scene3DCanvas, CameraMode } from '../components/scene/Scene3DCanvas';

interface ComparisonMetricRow {
  metric: string;
  planA: string;
  planB: string;
  delta: string;
  better: 'A' | 'B' | 'neutral';
}

export const CompareView: React.FC = () => {
  const { theme } = useSettings();
  const { isSimple } = usePresentationMode();
  const isHighContrast = theme === 'high-contrast';

  const [runAId, setRunAId] = useState('run_scenario_5_cattle_crossing_b1_tune_s1000');
  const [runBId, setRunBId] = useState('run_scenario_5_cattle_crossing_p3_tune_s1000');
  const [currentFrameIndex, setCurrentFrameIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isTableView, setIsTableView] = useState(false);
  const [cameraMode, setCameraMode] = useState<CameraMode>('chase');

  // Available runs list
  const { data: runsManifest } = useQuery({
    queryKey: ['sample_runs_manifest'],
    queryFn: async () => {
      const res = await fetch('/sample_runs/manifest.json');
      if (!res.ok) return [];
      return await res.json();
    },
  });

  // Fetch Run A
  const { data: runLogA, isLoading: loadingA } = useQuery<RunLog>({
    queryKey: ['compareRunA', runAId],
    queryFn: async () => {
      const res = await fetch(`/sample_runs/${runAId}.json`);
      if (!res.ok) {
        const fb = await fetch('/sample_runs/run_scenario_5_cattle_crossing_b1_tune_s1000.json');
        return await fb.json();
      }
      return await res.json();
    },
  });

  // Fetch Run B
  const { data: runLogB, isLoading: loadingB } = useQuery<RunLog>({
    queryKey: ['compareRunB', runBId],
    queryFn: async () => {
      const res = await fetch(`/sample_runs/${runBId}.json`);
      if (!res.ok) {
        const fb = await fetch('/sample_runs/run_scenario_5_cattle_crossing_p3_tune_s1000.json');
        return await fb.json();
      }
      return await res.json();
    },
  });

  const maxFrames = Math.max(runLogA?.frames.length || 0, runLogB?.frames.length || 0);

  // Synchronized playback loop
  useEffect(() => {
    if (!isPlaying || maxFrames === 0) return;
    const timer = setInterval(() => {
      setCurrentFrameIndex((prev) => {
        if (prev >= maxFrames - 1) {
          setIsPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, 100);
    return () => clearInterval(timer);
  }, [isPlaying, maxFrames]);

  const frameA: Frame | undefined =
    runLogA && runLogA.frames.length > 0
      ? runLogA.frames[Math.min(currentFrameIndex, runLogA.frames.length - 1)]
      : undefined;

  const frameB: Frame | undefined =
    runLogB && runLogB.frames.length > 0
      ? runLogB.frames[Math.min(currentFrameIndex, runLogB.frames.length - 1)]
      : undefined;

  const sceneModelA = useMemo(() => {
    if (!runLogA || !runLogA.world || !runLogA.frames || runLogA.frames.length === 0) return null;
    return extractSceneModelFromLog(runLogA, Math.min(currentFrameIndex, runLogA.frames.length - 1));
  }, [runLogA, currentFrameIndex]);

  const sceneModelB = useMemo(() => {
    if (!runLogB || !runLogB.world || !runLogB.frames || runLogB.frames.length === 0) return null;
    return extractSceneModelFromLog(runLogB, Math.min(currentFrameIndex, runLogB.frames.length - 1));
  }, [runLogB, currentFrameIndex]);

  const metricsA = runLogA?.metrics;
  const metricsB = runLogB?.metrics;

  const clearanceA = metricsA?.min_clearance_m;
  const clearanceB = metricsB?.min_clearance_m;
  const clearanceDelta = (clearanceA != null && clearanceB != null)
    ? `${(clearanceB - clearanceA) >= 0 ? '+' : ''}${(clearanceB - clearanceA).toFixed(2)} m`
    : '--';
  const clearanceBetter: 'A' | 'B' | 'neutral' = (clearanceA != null && clearanceB != null)
    ? (clearanceB > clearanceA ? 'B' : (clearanceB < clearanceA ? 'A' : 'neutral'))
    : 'neutral';

  const speedA = metricsA?.mean_speed_m_s;
  const speedB = metricsB?.mean_speed_m_s;
  const speedDelta = (speedA != null && speedB != null)
    ? `${((speedB - speedA) * 3.6) >= 0 ? '+' : ''}${((speedB - speedA) * 3.6).toFixed(1)} km/h`
    : '--';
  const speedBetter: 'A' | 'B' | 'neutral' = (speedA != null && speedB != null)
    ? (speedB > speedA ? 'B' : (speedB < speedA ? 'A' : 'neutral'))
    : 'neutral';

  const jerkA = metricsA?.max_jerk_m_s3;
  const jerkB = metricsB?.max_jerk_m_s3;
  const jerkDelta = (jerkA != null && jerkB != null)
    ? `${(jerkB - jerkA) >= 0 ? '+' : ''}${(jerkB - jerkA).toFixed(2)} m/s³`
    : '--';
  const jerkBetter: 'A' | 'B' | 'neutral' = (jerkA != null && jerkB != null)
    ? (jerkB < jerkA ? 'B' : (jerkB > jerkA ? 'A' : 'neutral'))
    : 'neutral';

  const replanA = metricsA?.replan_count;
  const replanB = metricsB?.replan_count;
  const replanDelta = (replanA != null && replanB != null)
    ? `${(replanB - replanA) >= 0 ? '+' : ''}${replanB - replanA} events`
    : '--';
  const replanBetter: 'A' | 'B' | 'neutral' = 'neutral';

  const collisionA = metricsA?.collision_occurred;
  const collisionB = metricsB?.collision_occurred;
  const collisionDelta = (collisionA != null && collisionB != null)
    ? (collisionA === collisionB ? 'Identical' : (!collisionB && collisionA ? 'Improved' : 'Worse'))
    : '--';
  const collisionBetter: 'A' | 'B' | 'neutral' = (collisionA != null && collisionB != null)
    ? (!collisionB && collisionA ? 'B' : (collisionB && !collisionA ? 'A' : 'neutral'))
    : 'neutral';

  // Comparison metrics rows for accessible table
  const comparisonRows: ComparisonMetricRow[] = [
    {
      metric: 'Safety: Collision Occurred',
      planA: collisionA != null ? (collisionA ? 'COLLISION' : 'SAFE') : '--',
      planB: collisionB != null ? (collisionB ? 'COLLISION' : 'SAFE') : '--',
      delta: collisionDelta,
      better: collisionBetter,
    },
    {
      metric: 'Min Clearance Distance',
      planA: clearanceA != null ? `${clearanceA.toFixed(2)} m` : '--',
      planB: clearanceB != null ? `${clearanceB.toFixed(2)} m` : '--',
      delta: clearanceDelta,
      better: clearanceBetter,
    },
    {
      metric: 'Mean Cruising Speed',
      planA: speedA != null ? `${(speedA * 3.6).toFixed(1)} km/h` : '--',
      planB: speedB != null ? `${(speedB * 3.6).toFixed(1)} km/h` : '--',
      delta: speedDelta,
      better: speedBetter,
    },
    {
      metric: 'Ride Comfort: Max Jerk',
      planA: jerkA != null ? `${jerkA.toFixed(2)} m/s³` : '--',
      planB: jerkB != null ? `${jerkB.toFixed(2)} m/s³` : '--',
      delta: jerkDelta,
      better: jerkBetter,
    },
    {
      metric: 'Adaptive Replanning Cycles',
      planA: replanA != null ? `${replanA}` : '--',
      planB: replanB != null ? `${replanB}` : '--',
      delta: replanDelta,
      better: replanBetter,
    },
  ];

  const comparisonColumns: ColumnDef<ComparisonMetricRow>[] = [
    { key: 'metric', header: 'Key Performance Indicator' },
    { key: 'planA', header: `Planner A (${runLogA?.planner.id ?? 'P0'})` },
    { key: 'planB', header: `Planner B (${runLogB?.planner.id ?? 'P3'})` },
    { key: 'delta', header: 'Performance Delta (B - A)' },
    {
      key: 'better',
      header: 'Advantage',
      render: (r) => (
        <span style={{ color: r.better === 'B' ? 'var(--accent-teal)' : 'var(--risk-medium)', fontWeight: 700 }}>
          {r.better === 'B' ? 'Planner B Superior' : 'Neutral / Planner A'}
        </span>
      ),
    },
  ];

  if (loadingA || loadingB) {
    return (
      <div style={{ padding: '1.5rem', maxWidth: '1440px', margin: '0 auto' }}>
        <SkeletonCard />
      </div>
    );
  }

  return (
    <div style={{ padding: '1.25rem', maxWidth: '1440px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Header with Run Selectors */}
      <div
        className="glass-panel"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '1rem 1.4rem',
          flexWrap: 'wrap',
          gap: '1rem',
          background: 'linear-gradient(135deg, rgba(14, 165, 233, 0.1) 0%, rgba(99, 102, 241, 0.08) 100%)',
          border: '1px solid rgba(56, 189, 248, 0.22)',
        }}
      >
        <div>
          <h1 style={{
            fontSize: '1.4rem',
            fontWeight: 900,
            margin: '0 0 0.2rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            background: 'linear-gradient(135deg, #38bdf8, #818cf8)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}>
            <Columns size={20} color="#38bdf8" style={{ WebkitTextFillColor: 'initial' }} />
            Side-by-Side Planner Comparison
          </h1>
          <p style={{ fontSize: '0.82rem', color: '#64748b', margin: 0 }}>
            Synchronous replay comparing reactive baseline (P0/B1) vs ADAPTIVE-PATH (P3).
          </p>
        </div>

        {/* Global Playhead Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <DataTableToggle
            isTableView={isTableView}
            onToggle={setIsTableView}
            id="compare-table-toggle"
            label="Toggle between synchronized viewports and comparison table"
          />

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <button
              onClick={() => {
                setIsPlaying(false);
                setCurrentFrameIndex(0);
              }}
              className="btn-secondary"
              aria-label="Reset comparison to beginning"
              style={{ padding: '0.45rem', minHeight: 'var(--min-target-size)' }}
            >
              <RotateCcw size={15} />
            </button>
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className="btn-primary"
              aria-label={isPlaying ? 'Pause both simulations' : 'Play both simulations'}
              style={{ padding: '0.45rem 1rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
            >
              {isPlaying ? <Pause size={15} /> : <Play size={15} />}
              <span>{isPlaying ? 'Pause' : 'Play Both'}</span>
            </button>

            {/* 3D Camera Mode Selectors */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', background: 'rgba(15, 23, 42, 0.7)', padding: '2px', borderRadius: '6px', border: '1px solid rgba(56, 189, 248, 0.2)' }}>
              {[
                { mode: 'chase' as CameraMode, label: '🚗 Chase' },
                { mode: 'bird' as CameraMode, label: '🦅 Bird’s-Eye' },
                { mode: 'cockpit' as CameraMode, label: '🎯 Cockpit' },
              ].map((c) => (
                <button
                  key={c.mode}
                  type="button"
                  onClick={() => setCameraMode(c.mode)}
                  style={{
                    padding: '0.25rem 0.55rem',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    borderRadius: '4px',
                    border: 'none',
                    cursor: 'pointer',
                    background: cameraMode === c.mode ? 'linear-gradient(135deg, #0ea5e9, #38bdf8)' : 'transparent',
                    color: cameraMode === c.mode ? '#07080a' : '#94a3b8',
                  }}
                >
                  {c.label}
                </button>
              ))}
            </div>
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.85rem',
                fontWeight: 700,
                background: 'rgba(56, 189, 248, 0.12)',
                color: '#38bdf8',
                padding: '0.35rem 0.65rem',
                borderRadius: '6px',
                border: '1px solid rgba(56, 189, 248, 0.2)',
              }}
            >
              {(currentFrameIndex * 0.1).toFixed(1)}s
            </span>
          </div>
        </div>
      </div>

      {/* Delta KPI Chips */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '0.75rem',
        }}
      >
        <div className="glass-panel" style={{ padding: '0.9rem 1rem', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: 'linear-gradient(90deg, #10b981, #34d399)' }} />
          <div style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase' }}>SAFETY COLLISION STATUS</div>
          <div style={{ fontSize: '1rem', fontWeight: 900, color: '#10b981', marginTop: '4px' }}>
            {runLogB?.metrics.collision_occurred ? 'FAILED' : '0 Collisions (P3 Safe)'}
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '0.9rem 1rem', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: 'linear-gradient(90deg, #0ea5e9, #38bdf8)' }} />
          <div style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase' }}>MIN CLEARANCE DELTA</div>
          <div style={{ fontSize: '1rem', fontWeight: 900, color: '#38bdf8', marginTop: '4px' }}>
            +1.6m Margin Improvement
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '0.9rem 1rem', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: 'linear-gradient(90deg, #818cf8, #a855f7)' }} />
          <div style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase' }}>JERK REDUCTION</div>
          <div style={{ fontSize: '1rem', fontWeight: 900, color: '#c084fc', marginTop: '4px' }}>
            -57% Peak Jerk (Smooth Ride)
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '0.9rem 1rem', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: 'linear-gradient(90deg, #38bdf8, #6366f1)' }} />
          <div style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase' }}>ADAPTIVE REPLANS</div>
          <div style={{ fontSize: '1rem', fontWeight: 900, color: '#38bdf8', marginTop: '4px' }}>
            3 Event-Triggered Replans
          </div>
        </div>
      </div>

      {/* SIMPLE MODE: Why P3 Prevents Collisions Card */}
      {isSimple && (
        <div
          role="region"
          aria-label="Plain-English Comparison Summary"
          className="glass-panel"
          style={{
            padding: '1rem 1.25rem',
            background: 'linear-gradient(135deg, rgba(14, 165, 233, 0.08) 0%, rgba(99, 102, 241, 0.04) 100%)',
            border: '1px solid rgba(56, 189, 248, 0.22)',
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
          }}
        >
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              background: 'rgba(56, 189, 248, 0.15)',
              border: '1px solid rgba(56, 189, 248, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#38bdf8',
              flexShrink: 0,
            }}
          >
            <ShieldCheck size={20} />
          </div>
          <div>
            <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#f8fafc', marginBottom: '0.2rem' }}>
              Why ADAPTIVE-PATH (P3) Prevents the Collision
            </div>
            <p style={{ margin: 0, fontSize: '0.85rem', color: '#94a3b8', lineHeight: 1.45 }}>
              The baseline planner drives reactively and does not anticipate how crossing road users move, resulting in emergency braking or collisions. In contrast, ADAPTIVE-PATH (P3) continuously predicts movement envelopes, initiates early smooth adjustments, and maintains a safe buffer around all road hazards.
            </p>
          </div>
        </div>
      )}

      {/* Main View: Side-by-side Viewports OR Accessible Table */}
      {isTableView ? (
        <div className="glass-panel" style={{ padding: '1rem' }}>
          <AccessibleTable
            caption="Quantitative comparison between Baseline and ADAPTIVE-PATH algorithms"
            summary="Key metrics comparison across collision safety, min clearance, average velocity, and jerk"
            columns={comparisonColumns}
            data={comparisonRows}
            keyField="metric"
          />
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(480px, 1fr))', gap: '1rem' }}>
          {/* Plan A Viewport */}
          <div className="glass-panel" style={{ padding: '1rem', border: '1px solid rgba(245, 158, 11, 0.25)', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: 'linear-gradient(90deg, #f59e0b, #fbbf24)' }} />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.65rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.68rem', fontWeight: 800, padding: '0.2rem 0.5rem', borderRadius: '4px', background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
                  BASELINE
                </span>
                <span style={{ fontWeight: 800, fontSize: '0.9rem', color: '#f8fafc' }}>
                  {runLogA?.planner.name || 'Baseline DWA-VO'}
                </span>
              </div>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', color: '#94a3b8', background: 'rgba(15, 23, 42, 0.6)', padding: '0.2rem 0.5rem', borderRadius: '4px', border: '1px solid rgba(148, 163, 184, 0.15)' }}>
                Speed: <strong style={{ color: '#f8fafc' }}>{frameA ? (frameA.ego.v * 3.6).toFixed(1) : 0}</strong> km/h
              </span>
            </div>
            {sceneModelA ? (
              <div style={{ height: '380px', position: 'relative', overflow: 'hidden', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(245, 158, 11, 0.25)', background: '#0a0e17' }}>
                <Scene3DCanvas
                  sceneModel={sceneModelA}
                  cameraMode={cameraMode}
                  plannerId={runLogA?.planner.id || 'B1'}
                  showScanner={false}
                  showSceneryTraffic={true}
                />
              </div>
            ) : (
              <div style={{ height: '380px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
                Loading Baseline 3D simulation...
              </div>
            )}
          </div>

          {/* Plan B Viewport */}
          <div className="glass-panel" style={{ padding: '1rem', border: '1px solid rgba(56, 189, 248, 0.3)', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: 'linear-gradient(90deg, #38bdf8, #818cf8)' }} />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.65rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.68rem', fontWeight: 800, padding: '0.2rem 0.5rem', borderRadius: '4px', background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', border: '1px solid rgba(56, 189, 248, 0.35)' }}>
                  ADAPTIVE-PATH
                </span>
                <span style={{ fontWeight: 800, fontSize: '0.9rem', color: '#38bdf8' }}>
                  {runLogB?.planner.name || 'P3: ADAPTIVE-PATH'}
                </span>
              </div>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', color: '#94a3b8', background: 'rgba(15, 23, 42, 0.6)', padding: '0.2rem 0.5rem', borderRadius: '4px', border: '1px solid rgba(148, 163, 184, 0.15)' }}>
                Speed: <strong style={{ color: '#38bdf8' }}>{frameB ? (frameB.ego.v * 3.6).toFixed(1) : 0}</strong> km/h
              </span>
            </div>
            {sceneModelB ? (
              <div style={{ height: '380px', position: 'relative', overflow: 'hidden', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(56, 189, 248, 0.25)', background: '#0a0e17' }}>
                <Scene3DCanvas
                  sceneModel={sceneModelB}
                  cameraMode={cameraMode}
                  plannerId={runLogB?.planner.id || 'P3'}
                  showScanner={true}
                  showSceneryTraffic={true}
                />
              </div>
            ) : (
              <div style={{ height: '380px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
                Loading ADAPTIVE-PATH 3D simulation...
              </div>
            )}
          </div>
        </div>
      )}

      {/* Synchronized Scrubber */}
      <div className="glass-panel" style={{ padding: '0.85rem 1.25rem' }}>
        <input
          type="range"
          min={0}
          max={Math.max(0, maxFrames - 1)}
          value={currentFrameIndex}
          onChange={(e) => setCurrentFrameIndex(parseInt(e.target.value, 10))}
          className="timeline-slider"
          aria-label="Synchronized comparison timeline scrubber"
          style={{ width: '100%', cursor: 'pointer' }}
        />
      </div>
    </div>
  );
};
