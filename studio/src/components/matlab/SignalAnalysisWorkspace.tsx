/**
 * Synchronized Signal Analysis Workspace for MATLAB Validation Studio.
 * Allows interactive inspection of individual vehicle state signals
 * (X, Y, Yaw, Steering, Velocity, Acceleration, Jerk) comparing Python Reference
 * against Simulink Plant Output with synchronized timeline cursor.
 */

import React, { useState, useMemo } from 'react';
import { ParityPoint } from '../scene/Matlab3DViewport';
import { Sliders, Activity, Info, TrendingUp } from 'lucide-react';

export type SignalKey = 'x' | 'y' | 'yaw' | 'steer' | 'v';

interface SignalAnalysisWorkspaceProps {
  points: ParityPoint[];
  currentStep: number;
  onStepSelect: (step: number) => void;
}

export const SignalAnalysisWorkspace: React.FC<SignalAnalysisWorkspaceProps> = ({
  points,
  currentStep,
  onStepSelect,
}) => {
  const [selectedSignal, setSelectedSignal] = useState<SignalKey>('steer');
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  // Compute signal values, max error, and RMS error
  const { series, unit, label, maxError, rmsError, curError } = useMemo(() => {
    if (points.length === 0) {
      return { series: [], unit: '', label: '', maxError: 0, rmsError: 0, curError: 0 };
    }

    let unitStr = 'm';
    let labelStr = 'Position X';
    let pyFn = (p: ParityPoint) => p.py_x;
    let mFn = (p: ParityPoint) => p.m_x;

    if (selectedSignal === 'y') {
      unitStr = 'm';
      labelStr = 'Lateral Position (Y)';
      pyFn = (p: ParityPoint) => p.py_y;
      mFn = (p: ParityPoint) => p.m_y;
    } else if (selectedSignal === 'yaw') {
      unitStr = 'rad';
      labelStr = 'Heading Angle (ψ)';
      pyFn = (p: ParityPoint) => p.py_yaw;
      mFn = (p: ParityPoint) => p.m_yaw;
    } else if (selectedSignal === 'steer') {
      unitStr = 'rad';
      labelStr = 'Steering Angle (δ)';
      pyFn = (p: ParityPoint) => p.py_steer;
      mFn = (p: ParityPoint) => p.m_steer;
    } else if (selectedSignal === 'v') {
      unitStr = 'm/s';
      labelStr = 'Forward Velocity (v)';
      pyFn = (p: ParityPoint) => p.py_v ?? 10.0;
      mFn = (p: ParityPoint) => p.m_v ?? 10.0;
    }

    let sumSqErr = 0;
    let maxErr = 0;

    const data = points.map((p) => {
      const pyVal = pyFn(p);
      const mVal = mFn(p);
      const err = Math.abs(pyVal - mVal);
      sumSqErr += err * err;
      if (err > maxErr) maxErr = err;
      return {
        step: p.step,
        time: p.time,
        py: pyVal,
        m: mVal,
        err,
      };
    });

    const rms = Math.sqrt(sumSqErr / (points.length || 1));
    const active = data[currentStep] || data[0];

    return {
      series: data,
      unit: unitStr,
      label: labelStr,
      maxError: maxErr,
      rmsError: rms,
      curError: active ? active.err : 0,
    };
  }, [points, selectedSignal, currentStep]);

  // SVG Chart Dimensions & Coordinate Scaling
  const chartBounds = useMemo(() => {
    if (series.length === 0) return { minY: -1, maxY: 1, minT: 0, maxT: 5.0 };
    let minY = Infinity, maxY = -Infinity;
    series.forEach((s) => {
      minY = Math.min(minY, s.py, s.m);
      maxY = Math.max(maxY, s.py, s.m);
    });
    const dy = Math.max(maxY - minY, 0.05);
    return {
      minY: minY - dy * 0.1,
      maxY: maxY + dy * 0.1,
      minT: series[0].time,
      maxT: series[series.length - 1].time || 5.0,
    };
  }, [series]);

  const width = 860;
  const height = 180;
  const padL = 50;
  const padR = 25;
  const padT = 20;
  const padB = 30;

  const getSvgX = (t: number) => {
    const { minT, maxT } = chartBounds;
    const range = Math.max(maxT - minT, 0.1);
    return padL + ((t - minT) / range) * (width - padL - padR);
  };

  const getSvgY = (val: number) => {
    const { minY, maxY } = chartBounds;
    const range = Math.max(maxY - minY, 0.01);
    return height - padB - ((val - minY) / range) * (height - padT - padB);
  };

  // Paths
  const pyPath = useMemo(() => {
    return series.map((s, i) => `${i === 0 ? 'M' : 'L'} ${getSvgX(s.time).toFixed(1)} ${getSvgY(s.py).toFixed(1)}`).join(' ');
  }, [series, chartBounds]);

  const mPath = useMemo(() => {
    return series.map((s, i) => `${i === 0 ? 'M' : 'L'} ${getSvgX(s.time).toFixed(1)} ${getSvgY(s.m).toFixed(1)}`).join(' ');
  }, [series, chartBounds]);

  const currentCursorX = useMemo(() => {
    const active = series[currentStep];
    return active ? getSvgX(active.time) : padL;
  }, [series, currentStep, chartBounds]);

  const activeInspectItem = hoverIndex !== null ? series[hoverIndex] : series[currentStep];

  return (
    <div
      style={{
        background: '#0d1322',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '12px',
        padding: '1.25rem 1.5rem',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.35)',
      }}
    >
      {/* Header & Signal Selector Buttons */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.85rem',
          marginBottom: '1rem',
          borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
          paddingBottom: '0.75rem',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Activity size={17} color="#38bdf8" />
            <h3 style={{ fontSize: '1rem', fontWeight: 800, margin: 0, color: '#f8fafc' }}>
              Signal Analysis: {label}
            </h3>
          </div>
          <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '0.2rem' }}>
            Synchronized comparison of production Python command vs isolated Simulink plant response
          </div>
        </div>

        {/* Signal Selector Pill Buttons */}
        <div style={{ display: 'flex', gap: '0.35rem', fontSize: '0.72rem' }}>
          {[
            { key: 'steer', label: 'Steer (δ)' },
            { key: 'yaw', label: 'Heading (ψ)' },
            { key: 'x', label: 'Pos X' },
            { key: 'y', label: 'Pos Y' },
            { key: 'v', label: 'Velocity (v)' },
          ].map((s) => (
            <button
              key={s.key}
              onClick={() => setSelectedSignal(s.key as SignalKey)}
              style={{
                background: selectedSignal === s.key ? '#38bdf8' : 'rgba(255, 255, 255, 0.05)',
                color: selectedSignal === s.key ? '#070b14' : '#cbd5e1',
                border: 'none',
                borderRadius: '5px',
                padding: '0.3rem 0.6rem',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Signal Error Metrics Bar */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '0.75rem',
          marginBottom: '0.85rem',
          fontSize: '0.74rem',
        }}
      >
        <div style={{ background: '#070b14', padding: '0.45rem 0.75rem', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)' }}>
          <span style={{ color: '#64748b' }}>Max Error: </span>
          <strong style={{ color: maxError > 0.5 ? '#f59e0b' : '#10b981', fontFamily: 'monospace' }}>
            {maxError.toFixed(4)} {unit}
          </strong>
        </div>
        <div style={{ background: '#070b14', padding: '0.45rem 0.75rem', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)' }}>
          <span style={{ color: '#64748b' }}>RMS Error: </span>
          <strong style={{ color: rmsError > 0.3 ? '#f59e0b' : '#38bdf8', fontFamily: 'monospace' }}>
            {rmsError.toFixed(4)} {unit}
          </strong>
        </div>
        <div style={{ background: '#070b14', padding: '0.45rem 0.75rem', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)' }}>
          <span style={{ color: '#64748b' }}>Error @ Step {currentStep}: </span>
          <strong style={{ color: curError > 0.2 ? '#f59e0b' : '#10b981', fontFamily: 'monospace' }}>
            {curError.toFixed(4)} {unit}
          </strong>
        </div>
        <div style={{ background: '#070b14', padding: '0.45rem 0.75rem', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)' }}>
          <span style={{ color: '#64748b' }}>Inspected Time: </span>
          <strong style={{ color: '#f8fafc', fontFamily: 'monospace' }}>
            {activeInspectItem ? `${activeInspectItem.time.toFixed(2)}s` : '0.00s'}
          </strong>
        </div>
      </div>

      {/* SVG Interactive Signal Plot with Cursor Bar */}
      <div
        style={{
          background: '#070b14',
          borderRadius: '8px',
          border: '1px solid rgba(255, 255, 255, 0.06)',
          padding: '0.5rem',
          position: 'relative',
        }}
      >
        <svg
          viewBox={`0 0 ${width} ${height}`}
          style={{ width: '100%', height: 'auto', display: 'block', cursor: 'crosshair' }}
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const clickSvgX = ((e.clientX - rect.left) / rect.width) * width;
            const frac = Math.max(0, Math.min(1, (clickSvgX - padL) / (width - padL - padR)));
            const stepIdx = Math.round(frac * (points.length - 1));
            onStepSelect(stepIdx);
          }}
        >
          {/* Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1.0].map((frac, i) => {
            const y = padT + frac * (height - padT - padB);
            const val = chartBounds.maxY - frac * (chartBounds.maxY - chartBounds.minY);
            return (
              <g key={i}>
                <line x1={padL} y1={y} x2={width - padR} y2={y} stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
                <text x={padL - 8} y={y + 3} fill="#64748b" fontSize="9" textAnchor="end" fontFamily="monospace">
                  {val.toFixed(2)}
                </text>
              </g>
            );
          })}

          {/* Time axis ticks */}
          {[0, 0.25, 0.5, 0.75, 1.0].map((frac, i) => {
            const x = padL + frac * (width - padL - padR);
            const t = chartBounds.minT + frac * (chartBounds.maxT - chartBounds.minT);
            return (
              <g key={i}>
                <line x1={x} y1={padT} x2={x} y2={height - padB} stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
                <text x={x} y={height - padB + 14} fill="#64748b" fontSize="9" textAnchor="middle" fontFamily="monospace">
                  {t.toFixed(1)}s
                </text>
              </g>
            );
          })}

          {/* Python Reference Signal Line (Cyan) */}
          <path d={pyPath} fill="none" stroke="#38bdf8" strokeWidth="2.0" opacity="0.9" />

          {/* Simulink Plant Signal Line (Violet Dashed) */}
          <path d={mPath} fill="none" stroke="#a855f7" strokeWidth="2.2" strokeDasharray="4,3" opacity="0.95" />

          {/* Synchronized Replay Timeline Cursor Bar */}
          <line
            x1={currentCursorX}
            y1={padT}
            x2={currentCursorX}
            y2={height - padB}
            stroke="#ef4444"
            strokeWidth="1.5"
            strokeDasharray="2,2"
          />

          {/* Active Hover / Current Step Node Dots */}
          {activeInspectItem && (
            <>
              <circle
                cx={getSvgX(activeInspectItem.time)}
                cy={getSvgY(activeInspectItem.py)}
                r="4"
                fill="#38bdf8"
                stroke="#070b14"
                strokeWidth="1.5"
              />
              <circle
                cx={getSvgX(activeInspectItem.time)}
                cy={getSvgY(activeInspectItem.m)}
                r="4"
                fill="#a855f7"
                stroke="#070b14"
                strokeWidth="1.5"
              />
            </>
          )}
        </svg>

        {/* Legend */}
        <div
          style={{
            position: 'absolute',
            bottom: '10px',
            right: '15px',
            display: 'flex',
            alignItems: 'center',
            gap: '0.85rem',
            fontSize: '0.68rem',
            background: 'rgba(7, 11, 20, 0.8)',
            padding: '0.2rem 0.5rem',
            borderRadius: '4px',
            pointerEvents: 'none',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <span style={{ width: '10px', height: '2px', background: '#38bdf8' }} />
            <span style={{ color: '#cbd5e1' }}>Python Ref</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <span style={{ width: '10px', height: '2px', background: '#a855f7', borderTop: '1px dashed' }} />
            <span style={{ color: '#cbd5e1' }}>Simulink SIL</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <span style={{ width: '8px', height: '1px', background: '#ef4444', borderTop: '1px dashed' }} />
            <span style={{ color: '#ef4444' }}>Current Step</span>
          </div>
        </div>
      </div>
    </div>
  );
};
