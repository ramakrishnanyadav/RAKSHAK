/**
 * DetailsDrawer - Slide-over Technical & MathWorks Integration Drawer
 * Full benchmark reproduction steps, MathWorks toolchain status,
 * ablation reconciliation, licenses, and known limitations.
 */

import React, { useState } from 'react';
import { X, Copy, Check, Terminal, Cpu, ExternalLink, ShieldAlert, GitCompare, BookOpen, AlertCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ProvenancePayload } from './types';

interface DetailsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  provenance?: ProvenancePayload | null;
}

export const DetailsDrawer: React.FC<DetailsDrawerProps> = ({ isOpen, onClose, provenance }) => {
  const [copied, setCopied] = useState(false);
  const reproCommand = 'python scripts/reproduce_all.py';

  const handleCopy = () => {
    navigator.clipboard.writeText(reproCommand);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen) return null;

  const reconciliation = provenance?.reconciliation;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Technical Details and Reproduction"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        justifyContent: 'flex-end',
        background: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(4px)',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '560px',
          height: '100%',
          background: '#0B0C0F',
          borderLeft: '1px solid rgba(255, 255, 255, 0.1)',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '-10px 0 30px rgba(0,0,0,0.5)',
          overflowY: 'auto',
          padding: '1.75rem',
          gap: '1.75rem',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drawer Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: '0.75rem', color: '#2DD4BF', fontWeight: 700, letterSpacing: '0.05em' }}>
              SIH26037 • MATHWORKS
            </div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#FFFFFF', margin: '0.2rem 0 0' }}>
              Technical Details & Reproduction
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close details drawer"
            style={{
              background: 'transparent',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '6px',
              color: '#94A3B8',
              padding: '0.35rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* 1. Reproducibility Command */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#CBD5E1', fontSize: '0.85rem', fontWeight: 600 }}>
            <Terminal size={14} color="#2DD4BF" />
            <span>One-Command Benchmark Reproduction</span>
          </div>
          <div
            style={{
              background: '#14161C',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '6px',
              padding: '0.75rem 1rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontFamily: 'monospace',
              fontSize: '0.825rem',
            }}
          >
            <span style={{ color: '#2DD4BF' }}>{reproCommand}</span>
            <button
              onClick={handleCopy}
              style={{
                background: 'transparent',
                border: 'none',
                color: copied ? '#2DD4BF' : '#94A3B8',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.3rem',
                fontSize: '0.75rem',
              }}
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
          <span style={{ fontSize: '0.75rem', color: '#64748B' }}>
            Re-runs the exact 25 episodes (seeds 2005–2009) and regenerates runs/val_b_manifest.json in ~12 seconds.
          </span>
        </div>

        {/* 2. Ablation Reconciliation (Frozen Test vs. Validation B) */}
        <div
          style={{
            background: '#111318',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '8px',
            padding: '1.25rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#FFFFFF', fontSize: '0.9rem', fontWeight: 700 }}>
            <GitCompare size={15} color="#2DD4BF" />
            <span>Ablation Reconciliation</span>
          </div>
          <p style={{ margin: 0, fontSize: '0.825rem', color: '#94A3B8', lineHeight: 1.5 }}>
            Separation between independent frozen benchmarks and the 5-scenario tuning split:
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div
              style={{
                background: 'rgba(239, 68, 68, 0.05)',
                border: '1px solid rgba(239, 68, 68, 0.2)',
                borderRadius: '6px',
                padding: '0.75rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.35rem',
              }}
            >
              <div style={{ fontSize: '0.7rem', color: '#F87171', fontWeight: 700 }}>FROZEN BENCHMARK (TEST SPLIT)</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#FFFFFF' }}>0.0%</div>
              <div style={{ fontSize: '0.725rem', color: '#94A3B8', lineHeight: 1.4 }}>
                Independent frozen test suite where stationary persistence was disabled.
              </div>
              <div style={{ fontSize: '0.65rem', color: '#64748B', fontFamily: 'monospace', marginTop: '0.25rem' }}>
                engine/experiments/results/frozen_test_results.json
              </div>
            </div>

            <div
              style={{
                background: 'rgba(45, 212, 191, 0.05)',
                border: '1px solid rgba(45, 212, 191, 0.2)',
                borderRadius: '6px',
                padding: '0.75rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.35rem',
              }}
            >
              <div style={{ fontSize: '0.7rem', color: '#2DD4BF', fontWeight: 700 }}>VALIDATION B (TUNING SPLIT)</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#FFFFFF' }}>56.0%</div>
              <div style={{ fontSize: '0.725rem', color: '#94A3B8', lineHeight: 1.4 }}>
                14/25 goals completed in the 5 canonical scenarios (same for both P3 Baseline and Corrected).
              </div>
              <div style={{ fontSize: '0.65rem', color: '#64748B', fontFamily: 'monospace', marginTop: '0.25rem' }}>
                runs/val_b_manifest.json
              </div>
            </div>
          </div>
        </div>

        {/* 3. MathWorks Toolchain Integration */}
        <div
          style={{
            background: '#111318',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '8px',
            padding: '1.25rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#FFFFFF', fontSize: '0.9rem', fontWeight: 700 }}>
            <Cpu size={15} color="#2DD4BF" />
            <span>Runs in MATLAB / Simulink / RoadRunner</span>
          </div>
          <p style={{ margin: 0, fontSize: '0.825rem', color: '#94A3B8', lineHeight: 1.5 }}>
            The trajectory planner couples to a Stateflow decision automaton implementing 5 supervisory modes:
            <code style={{ color: '#2DD4BF', marginLeft: '0.25rem' }}>FOLLOW</code>,{' '}
            <code style={{ color: '#FBBF24' }}>SLOW</code>,{' '}
            <code style={{ color: '#38BDF8' }}>BYPASS</code>,{' '}
            <code style={{ color: '#FB923C' }}>STOP</code>, and{' '}
            <code style={{ color: '#F87171' }}>EMERGENCY BRAKE</code>.
          </p>
          <div style={{ fontSize: '0.8rem', color: '#CBD5E1', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <div>• <strong>Stateflow Bridge:</strong> <code>engine/stateflow_bridge.py</code></div>
            <div>• <strong>RoadRunner 3D Scenes:</strong> <code>matlab_adapter/roadrunner/*.xodr, *.xosc</code></div>
            <div>• <strong>MATLAB Validation Harness:</strong> <code>matlab_adapter/run_matlab_validation.m</code></div>
            <div>• <strong>Simulink Log Exporter:</strong> <code>matlab_adapter/apath_log_v1_export.m</code></div>
          </div>
        </div>

        {/* 4. Licenses & Attribution */}
        <div
          style={{
            background: '#111318',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '8px',
            padding: '1.25rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.6rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#FFFFFF', fontSize: '0.9rem', fontWeight: 700 }}>
            <BookOpen size={15} color="#2DD4BF" />
            <span>Dataset Licenses & Attributions</span>
          </div>
          <div style={{ fontSize: '0.8rem', color: '#94A3B8', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <div>
              <strong style={{ color: '#CBD5E1' }}>Indian Driving Dataset (IDD):</strong> CC BY-NC-SA 4.0. CVIT, IIIT Hyderabad & Intel.
            </div>
            <div>
              <strong style={{ color: '#CBD5E1' }}>Mendeley Data:</strong> CC BY 4.0. Individual repository contributors.
            </div>
            <div>
              <strong style={{ color: '#CBD5E1' }}>MathWorks:</strong> Automated Driving Toolbox & RoadRunner (Commercial & Academic Licensing).
            </div>
            <div>
              <strong style={{ color: '#CBD5E1' }}>ADAPTIVE-PATH:</strong> MIT License for hackathon submission code.
            </div>
          </div>
        </div>

        {/* 5. Not Used / Future Work List */}
        <div
          style={{
            background: '#111318',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '8px',
            padding: '1.25rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#CBD5E1', fontSize: '0.85rem', fontWeight: 700 }}>
            <AlertCircle size={15} color="#FBBF24" />
            <span>Not Yet Ingested / Future Work</span>
          </div>
          <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.8rem', color: '#94A3B8', lineHeight: 1.5 }}>
            <li>Mendeley crowd-sourced traffic videos (planned for physical gap tuning).</li>
            <li>Hardware-in-the-loop (HIL) drive-by-wire CAN bus interface.</li>
            <li>3D LiDAR voxel segmentation for non-flat road surfaces and potholes.</li>
          </ul>
        </div>

        {/* 6. Known Limitations */}
        <div
          style={{
            background: 'rgba(239, 68, 68, 0.05)',
            border: '1px solid rgba(239, 68, 68, 0.2)',
            borderRadius: '8px',
            padding: '1.25rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#F87171', fontSize: '0.85rem', fontWeight: 700 }}>
            <ShieldAlert size={15} />
            <span>Scope & Limitations</span>
          </div>
          <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.8rem', color: '#CBD5E1', lineHeight: 1.5 }}>
            <li>Validated in simulated 2D road environments with synthetic sensor error models.</li>
            <li>Not certified for road deployment or commercial autonomous operation.</li>
            <li>Urban intersections with multi-vehicle occlusions remain challenging (40% completion).</li>
          </ul>
        </div>

        {/* 7. Action Links */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: 'auto' }}>
          <Link
            to="/app"
            onClick={onClose}
            style={{
              background: '#2DD4BF',
              color: '#090A0D',
              textDecoration: 'none',
              borderRadius: '6px',
              padding: '0.65rem 1rem',
              fontWeight: 700,
              fontSize: '0.85rem',
              textAlign: 'center',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
            }}
          >
            <span>Open Full Research Studio (/app)</span>
            <ExternalLink size={15} />
          </Link>
          <span style={{ fontSize: '0.75rem', color: '#64748B', textAlign: 'center' }}>
            Access all 6 experimental planners, live runner, and ablation sweeps.
          </span>
        </div>
      </div>
    </div>
  );
};

