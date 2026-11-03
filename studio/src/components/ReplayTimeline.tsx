/**
 * Accessible Replay Timeline and Telemetry Traces Component.
 * Features:
 * - Play / Pause and frame stepping (0.1s and 1.0s)
 * - Multi-speed selector (0.25x, 0.5x, 1x, 2x, 4x)
 * - Timeline slider with discrete pins for replan triggers
 * - Mini Sparkline traces for Risk Field, Clearance, Speed, and Jerk
 * - Aria-live narration triggers for replan events (WCAG 2.2 AA hard requirement)
 */

import React, { useEffect, useRef } from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  RotateCcw,
  AlertCircle,
  Activity,
  Gauge,
  ShieldAlert,
} from 'lucide-react';
import { RunLog, Frame } from '../types/apath_log';
import { useAnnouncer } from './LiveAnnouncer';
import { AccessibleRiskBadge } from './AccessibleTable';

interface ReplayTimelineProps {
  runLog: RunLog;
  currentFrameIndex: number;
  isPlaying: boolean;
  speed: number;
  onPlayPause: () => void;
  onStepFrame: (delta: number) => void;
  onSeekFrame: (index: number) => void;
  onSetSpeed: (speed: number) => void;
  onReset: () => void;
}

export const ReplayTimeline: React.FC<ReplayTimelineProps> = ({
  runLog,
  currentFrameIndex,
  isPlaying,
  speed,
  onPlayPause,
  onStepFrame,
  onSeekFrame,
  onSetSpeed,
  onReset,
}) => {
  const { announce } = useAnnouncer();
  const lastAnnouncedReplanIndex = useRef<number>(-1);

  const totalFrames = runLog.frames.length;
  const currentFrame = runLog.frames[currentFrameIndex] || runLog.frames[0];
  const totalDuration = runLog.metrics?.duration_s || (totalFrames > 0 ? totalFrames * 0.1 : 0);

  // Announce replan events to screen reader via aria-live
  useEffect(() => {
    if (!currentFrame) return;

    if (
      currentFrame.planner_output.replan_triggered &&
      lastAnnouncedReplanIndex.current !== currentFrameIndex
    ) {
      lastAnnouncedReplanIndex.current = currentFrameIndex;
      const timeStr = currentFrame.t.toFixed(1);
      const riskVal = currentFrame.risk_field.ego_risk.toFixed(2);
      const reason = currentFrame.decision_trace || currentFrame.risk_field.risk_level;
      const message = `Replanned at ${timeStr} s: ${reason}, risk ${riskVal}`;
      announce(message, 'assertive', true);
    }
  }, [currentFrameIndex, currentFrame, announce]);

  // Collect replan frame indices for visual timeline markers
  const replanIndices = runLog.frames
    .map((f, i) => (f.planner_output.replan_triggered ? i : -1))
    .filter((idx) => idx !== -1);

  // Generate SVG trace points for telemetry (normalized 0 to 100 height)
  const svgWidth = 800;
  const svgHeight = 44;
  const numPts = Math.min(runLog.frames.length, 100);
  const step = Math.max(1, Math.floor(runLog.frames.length / numPts));

  const sampledFrames = runLog.frames.filter((_, i) => i % step === 0);

  // Risk points
  const riskPoints = sampledFrames
    .map((f, i) => {
      const x = (i / (sampledFrames.length - 1)) * svgWidth;
      const y = svgHeight - f.risk_field.ego_risk * (svgHeight - 6) - 3;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  // Helper to compute clearance distance to nearest obstacle
  const computeFrameClearance = (f: Frame | undefined, defaultVal = 3.5): number => {
    if (!f || !f.agents || f.agents.length === 0) return defaultVal;
    let minD = 50.0;
    for (const ag of f.agents) {
      const d = Math.hypot(ag.x - f.ego.x, ag.y - f.ego.y);
      if (d < minD) minD = d;
    }
    return minD;
  };

  // Clearance points (normalized, max 10m)
  const clearancePoints = sampledFrames
    .map((f, i) => {
      const x = (i / (sampledFrames.length - 1)) * svgWidth;
      const clr = computeFrameClearance(f);
      const normClearance = Math.min(10, clr) / 10;
      const y = svgHeight - normClearance * (svgHeight - 6) - 3;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  const currentScrubPct =
    totalFrames > 1 ? (currentFrameIndex / (totalFrames - 1)) * 100 : 0;

  return (
    <div
      className="glass-panel"
      role="region"
      aria-label="Simulation playback controls and telemetry timeline"
      style={{
        marginTop: '1rem',
        padding: '1rem 1.25rem',
        border: '1px solid var(--border-default)',
      }}
    >
      {/* Upper Control Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '0.85rem',
          flexWrap: 'wrap',
          gap: '0.75rem',
        }}
      >
        {/* Playback Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
          <button
            onClick={onReset}
            className="btn-secondary"
            title="Reset to beginning (Home)"
            aria-label="Reset simulation to beginning (0.0 seconds)"
            style={{ padding: '0.45rem', minHeight: 'var(--min-target-size)', minWidth: 'var(--min-target-size)' }}
          >
            <RotateCcw size={16} aria-hidden="true" />
          </button>

          <button
            onClick={() => onStepFrame(-1)}
            className="btn-secondary"
            title="Step Back 0.1s (Left Arrow)"
            aria-label="Step backward 1 frame (0.1 seconds)"
            style={{ padding: '0.45rem', minHeight: 'var(--min-target-size)', minWidth: 'var(--min-target-size)' }}
          >
            <SkipBack size={16} aria-hidden="true" />
          </button>

          <button
            onClick={onPlayPause}
            className="btn-primary"
            title="Play / Pause (Space)"
            aria-label={isPlaying ? 'Pause replay simulation' : 'Play replay simulation'}
            style={{
              padding: '0.45rem 1rem',
              minHeight: 'var(--min-target-size)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem',
              fontWeight: 700,
            }}
          >
            {isPlaying ? <Pause size={16} aria-hidden="true" /> : <Play size={16} aria-hidden="true" />}
            <span>{isPlaying ? 'Pause' : 'Play'}</span>
          </button>

          <button
            onClick={() => onStepFrame(1)}
            className="btn-secondary"
            title="Step Forward 0.1s (Right Arrow)"
            aria-label="Step forward 1 frame (0.1 seconds)"
            style={{ padding: '0.45rem', minHeight: 'var(--min-target-size)', minWidth: 'var(--min-target-size)' }}
          >
            <SkipForward size={16} aria-hidden="true" />
          </button>

          {/* Speed Selector (0.25x - 4x) */}
          <div
            role="group"
            aria-label="Playback speed"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              background: 'var(--bg-surface-elevated)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-sm)',
              padding: '2px',
              marginLeft: '0.4rem',
            }}
          >
            {[0.25, 0.5, 1.0, 2.0, 4.0].map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => onSetSpeed(s)}
                aria-pressed={speed === s}
                aria-label={`Playback speed ${s}x`}
                style={{
                  background: speed === s ? 'var(--accent-primary)' : 'transparent',
                  color: speed === s ? '#ffffff' : 'var(--text-secondary)',
                  border: 'none',
                  borderRadius: '3px',
                  padding: '2px 7px',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  minHeight: 'var(--min-target-size)',
                }}
              >
                {s}x
              </button>
            ))}
          </div>
        </div>

        {/* Live Telemetry Chips */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
          {/* Time Counter */}
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.875rem',
              background: 'var(--bg-surface-elevated)',
              padding: '0.25rem 0.6rem',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>
              {currentFrame ? currentFrame.t.toFixed(1) : '0.0'}s
            </span>
            <span style={{ color: 'var(--text-secondary)' }}> / {totalDuration.toFixed(1)}s</span>
          </div>

          {/* Speed */}
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.8rem',
              background: 'var(--bg-surface-elevated)',
              padding: '0.25rem 0.6rem',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.3rem',
            }}
          >
            <Gauge size={13} aria-hidden="true" />
            <span>{currentFrame ? (currentFrame.ego.v * 3.6).toFixed(1) : '0.0'} km/h</span>
          </div>

          {/* Clearance to nearest obstacle */}
          <div
            title="Distance to closest obstacle hazard"
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.8rem',
              background: 'var(--bg-surface-elevated)',
              padding: '0.25rem 0.6rem',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.3rem',
            }}
          >
            <span>Buffer:</span>
            <strong>
              {computeFrameClearance(currentFrame).toFixed(1)}m
            </strong>
          </div>

          {/* Non-color pattern risk badge */}
          {currentFrame && (
            <AccessibleRiskBadge
              score={currentFrame.risk_field.ego_risk}
              label={currentFrame.risk_field.risk_level}
            />
          )}
        </div>
      </div>

      {/* Synchronized Telemetry SVG Sparkline Trace */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: '48px',
          background: 'rgba(0,0,0,0.25)',
          borderRadius: 'var(--radius-sm)',
          overflow: 'hidden',
          marginBottom: '0.5rem',
          border: '1px solid var(--border-subtle)',
        }}
        aria-hidden="true"
      >
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          preserveAspectRatio="none"
          style={{ width: '100%', height: '100%', display: 'block' }}
        >
          {/* Clearance trace (teal) */}
          <polyline
            fill="none"
            stroke="var(--accent-teal)"
            strokeWidth="1.5"
            strokeDasharray="2,2"
            opacity="0.6"
            points={clearancePoints}
          />
          {/* Risk trace (orange/red) */}
          <polyline
            fill="none"
            stroke="var(--risk-high)"
            strokeWidth="2"
            points={riskPoints}
          />
          {/* Current playhead vertical line */}
          <line
            x1={(currentScrubPct / 100) * svgWidth}
            y1={0}
            x2={(currentScrubPct / 100) * svgWidth}
            y2={svgHeight}
            stroke="#ffffff"
            strokeWidth="2"
          />
        </svg>

        {/* Legend overlay */}
        <div
          style={{
            position: 'absolute',
            top: '2px',
            right: '6px',
            fontSize: '0.65rem',
            fontFamily: 'var(--font-mono)',
            display: 'flex',
            gap: '0.6rem',
            pointerEvents: 'none',
          }}
        >
          <span style={{ color: 'var(--risk-high)' }}>— Collision Risk</span>
          <span style={{ color: 'var(--accent-teal)' }}>- - Hazard Buffer</span>
        </div>
      </div>

      {/* Main Timeline Slider with Discrete Replan Pins */}
      <div style={{ position: 'relative', width: '100%', display: 'flex', alignItems: 'center' }}>
        <input
          type="range"
          min={0}
          max={Math.max(0, totalFrames - 1)}
          value={currentFrameIndex}
          onChange={(e) => onSeekFrame(parseInt(e.target.value, 10))}
          className="timeline-slider"
          aria-label={`Simulation timeline scrubber. Current time ${(currentFrameIndex * 0.1).toFixed(1)} seconds of ${totalDuration.toFixed(1)} seconds.`}
          aria-valuemin={0}
          aria-valuemax={totalFrames - 1}
          aria-valuenow={currentFrameIndex}
          aria-valuetext={`${(currentFrameIndex * 0.1).toFixed(1)} seconds`}
          style={{
            width: '100%',
            cursor: 'pointer',
            height: '18px',
          }}
        />

        {/* Replan Trigger Pin Markers */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            height: '10px',
            pointerEvents: 'none',
            overflow: 'hidden',
          }}
          aria-hidden="true"
        >
          {replanIndices.map((idx) => (
            <div
              key={idx}
              title={`Adaptive replan triggered at ${(idx * 0.1).toFixed(1)}s`}
              style={{
                position: 'absolute',
                left: `${(idx / Math.max(1, totalFrames - 1)) * 100}%`,
                top: '0px',
                width: '3px',
                height: '10px',
                background: 'var(--risk-medium)',
                borderRadius: '1px',
              }}
            />
          ))}
        </div>
      </div>

      {/* Replan Decision Trace Notification Banner */}
      {currentFrame?.planner_output.replan_triggered && (
        <div
          role="status"
          style={{
            marginTop: '0.65rem',
            padding: '0.4rem 0.75rem',
            background: 'rgba(59, 130, 246, 0.12)',
            border: '1px solid rgba(59, 130, 246, 0.3)',
            borderRadius: 'var(--radius-sm)',
            fontSize: '0.8rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <Activity size={15} color="var(--accent-primary)" aria-hidden="true" />
          <span style={{ fontWeight: 700, color: 'var(--accent-primary)' }}>
            Adaptive Replan Triggered:
          </span>
          <span style={{ color: 'var(--text-primary)' }}>
            {currentFrame.decision_trace ||
              `Risk exceeded threshold (${currentFrame.risk_field.ego_risk.toFixed(2)})`}
          </span>
        </div>
      )}
    </div>
  );
};
