/**
 * HowItWorksStrip - Five-Step Plain English Architecture Strip
 * Step 1: See -> Step 2: Predict -> Step 3: Judge Risk -> Step 4: Replan -> Step 5: Drive
 * Grade 8 English, single-sentence explanations, visual indicators.
 */

import React from 'react';
import { Eye, GitBranch, Shield, Navigation, Car } from 'lucide-react';

interface PipelineStep {
  step: number;
  label: string;
  icon: React.ReactNode;
  summary: string;
}

const STEPS: PipelineStep[] = [
  {
    step: 1,
    label: 'See',
    icon: <Eye size={18} color="#2DD4BF" />,
    summary: 'Fuses camera, LiDAR, and radar to spot hidden objects behind stalls and vehicles.',
  },
  {
    step: 2,
    label: 'Predict',
    icon: <GitBranch size={18} color="#2DD4BF" />,
    summary: 'Estimates multiple possible future moves for cattle, rickshaws, and pedestrians.',
  },
  {
    step: 3,
    label: 'Judge risk',
    icon: <Shield size={18} color="#2DD4BF" />,
    summary: 'Wraps each obstacle in a dynamic safety cushion that expands under uncertainty.',
  },
  {
    step: 4,
    label: 'Replan',
    icon: <Navigation size={18} color="#2DD4BF" />,
    summary: 'Selects the smoothest safe detour in under 10 milliseconds without stalling.',
  },
  {
    step: 5,
    label: 'Drive',
    icon: <Car size={18} color="#2DD4BF" />,
    summary: 'Sends smooth steering and braking commands through Stateflow supervisory control.',
  },
];

export const HowItWorksStrip: React.FC = () => {
  return (
    <section id="how-it-works" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
        <span
          style={{
            fontSize: '0.75rem',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            color: '#2DD4BF',
            width: 'fit-content',
          }}
        >
          System Pipeline
        </span>
        <h2 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#FFFFFF', margin: 0 }}>
          How ADAPTIVE-PATH navigates unstructured roads
        </h2>
        <p style={{ color: '#94A3B8', fontSize: '0.95rem', margin: 0, maxWidth: '640px' }}>
          From raw sensor perception to physical vehicle control in five coordinated steps.
        </p>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '1rem',
        }}
      >
        {STEPS.map((s) => (
          <div
            key={s.step}
            style={{
              background: '#111318',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '8px',
              padding: '1.25rem 1rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
              position: 'relative',
            }}
          >
            {/* Top row: step number + icon */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '6px',
                  background: 'rgba(45, 212, 191, 0.12)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {s.icon}
              </div>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748B', fontFamily: 'monospace' }}>
                0{s.step}
              </span>
            </div>

            {/* Step label */}
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#FFFFFF', margin: 0 }}>
              {s.label}
            </h3>

            {/* Explanation */}
            <p style={{ margin: 0, fontSize: '0.825rem', color: '#94A3B8', lineHeight: 1.5 }}>
              {s.summary}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
};
