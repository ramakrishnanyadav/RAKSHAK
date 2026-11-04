/**
 * DetailsDrawer - Slide-over Technical & MathWorks Integration Drawer
 * Full benchmark reproduction steps, MathWorks toolchain status, and known limitations.
 */

import React, { useState } from 'react';
import { X, Copy, Check, Terminal, Cpu, FileText, ExternalLink, ShieldAlert } from 'lucide-react';
import { Link } from 'react-router-dom';

interface DetailsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DetailsDrawer: React.FC<DetailsDrawerProps> = ({ isOpen, onClose }) => {
  const [copied, setCopied] = useState(false);
  const reproCommand = 'python scripts/reproduce_all.py';

  const handleCopy = () => {
    navigator.clipboard.writeText(reproCommand);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen) return null;

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
          maxWidth: '520px',
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
            Re-runs the exact 25 episodes (seeds 2005–2009) and regenerates runs/val_b_manifest.json.
          </span>
        </div>

        {/* 2. MathWorks Toolchain Integration */}
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
            <span>MathWorks & Stateflow Architecture</span>
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
            <div>• <strong>MATLAB Adapter:</strong> <code>matlab_adapter/run_matlab_validation.m</code></div>
            <div>• <strong>Simulink Compatibility:</strong> Zero C++ wrapper dependencies, clean JSON telemetry I/O.</div>
          </div>
        </div>

        {/* 3. Known Limitations */}
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
            <li>Urban intersections with multi-vehicle occlusions remain challenging.</li>
          </ul>
        </div>

        {/* 4. Action Links */}
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
