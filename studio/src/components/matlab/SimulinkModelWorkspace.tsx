/**
 * Simulink Model Inspection Workspace for MATLAB Validation Studio.
 * Renders faithful block-diagram architecture of 'adaptive_path_controller_wp_a.slx',
 * input/output signal bus connections, solver config (ode1 fixed-step 0.05s / 20 Hz),
 * and physical vehicle model parameters under ADR-004E Option C.
 */

import React, { useState } from 'react';
import { Cpu, Layers, Activity, ShieldCheck, Box, Sliders, ExternalLink } from 'lucide-react';

export const SimulinkModelWorkspace: React.FC = () => {
  const [activeSubsystem, setActiveSubsystem] = useState<'all' | 'steer' | 'jerk' | 'bicycle'>('all');

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
      {/* Header with Model Identity & Hash */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
          paddingBottom: '0.85rem',
          marginBottom: '1rem',
          flexWrap: 'wrap',
          gap: '0.75rem',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
            <Cpu size={18} color="#38bdf8" />
            <h2 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0, color: '#f8fafc' }}>
              Simulink Model Workspace: adaptive_path_controller_wp_a.slx
            </h2>
            <span
              style={{
                fontSize: '0.65rem',
                padding: '0.15rem 0.45rem',
                borderRadius: '4px',
                background: 'rgba(56, 189, 248, 0.15)',
                color: '#38bdf8',
                fontWeight: 700,
                border: '1px solid rgba(56, 189, 248, 0.3)',
              }}
            >
              R2024b Verified Plant
            </span>
          </div>
          <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.25rem', fontFamily: 'monospace' }}>
            SHA-256: 5FFC628B00394B86A66C359FB658C869048C2707B9F99F9005102250710555B6
          </div>
        </div>

        {/* Solver & Sample Rate Badges */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div
            style={{
              background: '#070b14',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '6px',
              padding: '0.35rem 0.65rem',
              fontSize: '0.72rem',
              color: '#cbd5e1',
            }}
          >
            <span style={{ color: '#64748b' }}>Solver: </span>
            <strong style={{ color: '#38bdf8' }}>ode1 (Euler fixed-step)</strong>
          </div>
          <div
            style={{
              background: '#070b14',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '6px',
              padding: '0.35rem 0.65rem',
              fontSize: '0.72rem',
              color: '#cbd5e1',
            }}
          >
            <span style={{ color: '#64748b' }}>Step / Rate: </span>
            <strong style={{ color: '#10b981' }}>0.050s / 20 Hz</strong>
          </div>
        </div>
      </div>

      {/* Subsystem Focus Filter Tabs */}
      <div style={{ display: 'flex', gap: '0.45rem', marginBottom: '1rem', fontSize: '0.72rem' }}>
        <button
          onClick={() => setActiveSubsystem('all')}
          style={{
            background: activeSubsystem === 'all' ? '#0284c7' : 'rgba(255, 255, 255, 0.04)',
            color: activeSubsystem === 'all' ? '#ffffff' : '#94a3b8',
            border: 'none',
            borderRadius: '5px',
            padding: '0.3rem 0.65rem',
            cursor: 'pointer',
            fontWeight: 700,
          }}
        >
          Full Model Schematic
        </button>
        <button
          onClick={() => setActiveSubsystem('steer')}
          style={{
            background: activeSubsystem === 'steer' ? '#0284c7' : 'rgba(255, 255, 255, 0.04)',
            color: activeSubsystem === 'steer' ? '#ffffff' : '#94a3b8',
            border: 'none',
            borderRadius: '5px',
            padding: '0.3rem 0.65rem',
            cursor: 'pointer',
            fontWeight: 700,
          }}
        >
          Steering Slew Limiter (±0.80 rad/s)
        </button>
        <button
          onClick={() => setActiveSubsystem('jerk')}
          style={{
            background: activeSubsystem === 'jerk' ? '#0284c7' : 'rgba(255, 255, 255, 0.04)',
            color: activeSubsystem === 'jerk' ? '#ffffff' : '#94a3b8',
            border: 'none',
            borderRadius: '5px',
            padding: '0.3rem 0.65rem',
            cursor: 'pointer',
            fontWeight: 700,
          }}
        >
          Jerk Saturation Limiter (10 m/s³)
        </button>
        <button
          onClick={() => setActiveSubsystem('bicycle')}
          style={{
            background: activeSubsystem === 'bicycle' ? '#0284c7' : 'rgba(255, 255, 255, 0.04)',
            color: activeSubsystem === 'bicycle' ? '#ffffff' : '#94a3b8',
            border: 'none',
            borderRadius: '5px',
            padding: '0.3rem 0.65rem',
            cursor: 'pointer',
            fontWeight: 700,
          }}
        >
          Kinematic Bicycle Integrator (L = 2.8m)
        </button>
      </div>

      {/* Faithful Simulink Schematic Diagram (SVG High-Resolution Engineering Layout) */}
      <div
        style={{
          background: '#070b14',
          borderRadius: '8px',
          border: '1px solid rgba(255, 255, 255, 0.06)',
          padding: '1.25rem',
          position: 'relative',
          overflowX: 'auto',
        }}
      >
        <svg
          viewBox="0 0 920 220"
          style={{ width: '100%', minWidth: '760px', height: 'auto', display: 'block' }}
          aria-label="Simulink Model Architecture Diagram: adaptive_path_controller_wp_a.slx"
        >
          <defs>
            <marker id="arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 1 L 10 5 L 0 9 z" fill="#38bdf8" />
            </marker>
            <marker id="arrow-violet" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 1 L 10 5 L 0 9 z" fill="#a855f7" />
            </marker>
          </defs>

          {/* BLOCK 1: Input Port (TCP Demux) */}
          <g transform="translate(20, 45)">
            <rect x="0" y="0" width="120" height="130" rx="6" fill="#0f172a" stroke="#38bdf8" strokeWidth="1.5" />
            <text x="60" y="24" fill="#38bdf8" fontSize="11" fontWeight="700" textAnchor="middle">Inport Bus</text>
            <text x="60" y="42" fill="#94a3b8" fontSize="9" textAnchor="middle">TCP 127.0.0.1:5556</text>
            
            <rect x="15" y="60" width="90" height="24" rx="4" fill="#1e293b" />
            <text x="60" y="76" fill="#f8fafc" fontSize="10" fontFamily="monospace" textAnchor="middle">u_a (accel)</text>

            <rect x="15" y="94" width="90" height="24" rx="4" fill="#1e293b" />
            <text x="60" y="110" fill="#f8fafc" fontSize="10" fontFamily="monospace" textAnchor="middle">u_steer (rad)</text>
          </g>

          {/* Connection wires from Inport */}
          <line x1="140" y1="117" x2="200" y2="75" stroke="#38bdf8" strokeWidth="2" markerEnd="url(#arrow)" />
          <line x1="140" y1="151" x2="200" y2="155" stroke="#38bdf8" strokeWidth="2" markerEnd="url(#arrow)" />

          {/* BLOCK 2: Longitudinal Jerk Saturation Limiter */}
          <g transform="translate(200, 30)">
            <rect
              x="0"
              y="0"
              width="180"
              height="80"
              rx="6"
              fill={activeSubsystem === 'jerk' ? '#1e293b' : '#0f172a'}
              stroke={activeSubsystem === 'jerk' ? '#10b981' : '#38bdf8'}
              strokeWidth={activeSubsystem === 'jerk' ? 2 : 1.2}
            />
            <text x="90" y="22" fill="#f8fafc" fontSize="11" fontWeight="700" textAnchor="middle">Jerk Slew Limiter</text>
            <text x="90" y="38" fill="#94a3b8" fontSize="9" textAnchor="middle">|da/dt| ≤ 10.0 m/s³</text>
            <text x="90" y="54" fill="#cbd5e1" fontSize="9" fontFamily="monospace" textAnchor="middle">a_max: +3.0 / a_min: -6.0</text>
            <text x="90" y="70" fill="#38bdf8" fontSize="8.5" textAnchor="middle">Discrete Rate Filter (ode1)</text>
          </g>

          {/* BLOCK 3: Steering Rate Limiter (±0.80 rad/s) */}
          <g transform="translate(200, 125)">
            <rect
              x="0"
              y="0"
              width="180"
              height="80"
              rx="6"
              fill={activeSubsystem === 'steer' ? '#1e293b' : '#0f172a'}
              stroke={activeSubsystem === 'steer' ? '#f59e0b' : '#38bdf8'}
              strokeWidth={activeSubsystem === 'steer' ? 2 : 1.2}
            />
            <text x="90" y="22" fill="#f8fafc" fontSize="11" fontWeight="700" textAnchor="middle">Steer Rate Slew Limiter</text>
            <text x="90" y="38" fill="#f59e0b" fontSize="9.5" fontWeight="700" textAnchor="middle">|dδ/dt| ≤ 0.80 rad/s</text>
            <text x="90" y="54" fill="#cbd5e1" fontSize="9" fontFamily="monospace" textAnchor="middle">Δδ_max = 0.040 rad/step</text>
            <text x="90" y="70" fill="#94a3b8" fontSize="8.5" textAnchor="middle">Physical Actuator Bounds</text>
          </g>

          {/* Wires into Bicycle Model */}
          <line x1="380" y1="70" x2="450" y2="90" stroke="#38bdf8" strokeWidth="2" markerEnd="url(#arrow)" />
          <line x1="380" y1="165" x2="450" y2="135" stroke="#38bdf8" strokeWidth="2" markerEnd="url(#arrow)" />

          {/* BLOCK 4: Kinematic Bicycle Model Subsystem */}
          <g transform="translate(450, 45)">
            <rect
              x="0"
              y="0"
              width="240"
              height="130"
              rx="8"
              fill={activeSubsystem === 'bicycle' ? '#1e293b' : '#0f172a'}
              stroke={activeSubsystem === 'bicycle' ? '#a855f7' : '#818cf8'}
              strokeWidth="2"
            />
            <text x="120" y="24" fill="#a855f7" fontSize="12" fontWeight="800" textAnchor="middle">
              Kinematic Bicycle Plant
            </text>
            <text x="120" y="42" fill="#94a3b8" fontSize="9.5" textAnchor="middle">
              Wheelbase L = 2.80 m · Width = 1.88 m
            </text>

            <rect x="18" y="54" width="204" height="64" rx="4" fill="#070b14" stroke="rgba(255,255,255,0.08)" />
            <text x="26" y="70" fill="#cbd5e1" fontSize="9" fontFamily="monospace">ẋ = v · cos(ψ)</text>
            <text x="26" y="86" fill="#cbd5e1" fontSize="9" fontFamily="monospace">ẏ = v · sin(ψ)</text>
            <text x="26" y="102" fill="#cbd5e1" fontSize="9" fontFamily="monospace">ψ̇ = (v / L) · tan(δ)</text>
            <text x="130" y="86" fill="#38bdf8" fontSize="9" fontFamily="monospace">v̇ = a_bounded</text>
          </g>

          {/* Wires into Outport Bus */}
          <line x1="690" y1="110" x2="760" y2="110" stroke="#a855f7" strokeWidth="2.5" markerEnd="url(#arrow-violet)" />

          {/* BLOCK 5: Outport Telemetry Bus */}
          <g transform="translate(760, 45)">
            <rect x="0" y="0" width="140" height="130" rx="6" fill="#0f172a" stroke="#a855f7" strokeWidth="1.8" />
            <text x="70" y="24" fill="#a855f7" fontSize="11" fontWeight="700" textAnchor="middle">Outport Bus (Mux)</text>
            <text x="70" y="42" fill="#94a3b8" fontSize="9" textAnchor="middle">Feedback Telemetry</text>

            <rect x="12" y="55" width="116" height="66" rx="4" fill="#1e293b" />
            <text x="20" y="72" fill="#f8fafc" fontSize="9" fontFamily="monospace">m_x, m_y (m)</text>
            <text x="20" y="88" fill="#f8fafc" fontSize="9" fontFamily="monospace">m_yaw (rad)</text>
            <text x="20" y="104" fill="#f8fafc" fontSize="9" fontFamily="monospace">m_v (m/s), m_steer</text>
          </g>
        </svg>
      </div>

      {/* Engineering Parameters Disclosure */}
      <div
        style={{
          marginTop: '1rem',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
          gap: '0.75rem',
          fontSize: '0.74rem',
        }}
      >
        <div style={{ background: '#070b14', padding: '0.65rem 0.85rem', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)' }}>
          <span style={{ color: '#64748b' }}>Wheelbase (L): </span>
          <strong style={{ color: '#f8fafc', fontFamily: 'monospace' }}>2.80 m</strong>
        </div>
        <div style={{ background: '#070b14', padding: '0.65rem 0.85rem', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)' }}>
          <span style={{ color: '#64748b' }}>Track Width (W): </span>
          <strong style={{ color: '#f8fafc', fontFamily: 'monospace' }}>1.88 m</strong>
        </div>
        <div style={{ background: '#070b14', padding: '0.65rem 0.85rem', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)' }}>
          <span style={{ color: '#64748b' }}>Steering Rate Limit: </span>
          <strong style={{ color: '#f59e0b', fontFamily: 'monospace' }}>±0.80 rad/s (45.8°/s)</strong>
        </div>
        <div style={{ background: '#070b14', padding: '0.65rem 0.85rem', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)' }}>
          <span style={{ color: '#64748b' }}>Jerk Limit: </span>
          <strong style={{ color: '#10b981', fontFamily: 'monospace' }}>10.0 m/s³</strong>
        </div>
      </div>
    </div>
  );
};
