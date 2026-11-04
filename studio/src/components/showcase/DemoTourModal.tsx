/**
 * DemoTourModal - 3-Minute Guided Walkthrough for Judges
 * Step-by-step tour covering:
 *  0:00 Cattle crossing (B1 crash vs P3 avoidance)
 *  0:40 Layers on (Sensors, predictions, safety margin)
 *  1:10 Village & market scenes
 *  1:40 Our data (IDD, Mendeley, MathWorks, Synthetic with honest statuses)
 *  2:10 City junction shown as a weak spot
 *  2:35 Results row
 *  2:55 "Simulation only" close
 */

import React, { useState } from 'react';
import { X, ChevronRight, ChevronLeft, CheckCircle, Clock } from 'lucide-react';

interface DemoTourModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectScenario: (key: 'cattle' | 'village' | 'intersection' | 'highway' | 'market') => void;
  onToggleLayer: (layer: 'sensors' | 'predictions' | 'risk', value: boolean) => void;
  onSeekTime: (time: number) => void;
  onPlayReplay: () => void;
}

interface TourStep {
  timestamp: string;
  title: string;
  subtitle: string;
  description: string;
  targetId?: string;
  setup: (
    selectScen: (s: any) => void,
    toggleLayer: (l: any, v: boolean) => void,
    seek: (t: number) => void,
    play: () => void
  ) => void;
}

const TOUR_STEPS: TourStep[] = [
  {
    timestamp: '0:00',
    title: 'The Flagship Moment: Livestock on Rural Road',
    subtitle: 'Step 1 of 7 • Cattle Crossing',
    description:
      'Notice the standard planner (left) assumes the cow moves predictably, crashing at 5.1s. ADAPTIVE-PATH (right) anticipates livestock hesitation, smoothly decelerates to 8 km/h, and safely steers clear.',
    targetId: 'demo-stage',
    setup: (selectScen, toggleLayer, seek, play) => {
      selectScen('cattle');
      toggleLayer('predictions', true);
      toggleLayer('risk', true);
      toggleLayer('sensors', true);
      seek(4.5);
      play();
      const el = document.getElementById('demo-stage');
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    },
  },
  {
    timestamp: '0:40',
    title: 'Multi-Sensor Perception & Dynamic Safety Bounds',
    subtitle: 'Step 2 of 7 • Perception Layers',
    description:
      'Camera (green cone), LiDAR (dash ring), and Radar (blue beam) fuse detections. The conformal safety cushion dynamically expands as obstacle trajectory uncertainty increases.',
    targetId: 'demo-stage',
    setup: (selectScen, toggleLayer, seek, play) => {
      selectScen('cattle');
      toggleLayer('sensors', true);
      toggleLayer('predictions', true);
      toggleLayer('risk', true);
      seek(2.5);
      play();
      const el = document.getElementById('demo-stage');
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    },
  },
  {
    timestamp: '1:10',
    title: 'Unstructured Traffic: Village Road & Dense Market',
    subtitle: 'Step 3 of 7 • Diverse Road Users',
    description:
      'Auto-rickshaws, handcarts, and pedestrians share narrow corridors without lane markings. The Stateflow supervisor dynamically commands FOLLOW, SLOW, or BYPASS behaviors.',
    targetId: 'demo-stage',
    setup: (selectScen, toggleLayer, seek, play) => {
      selectScen('village');
      toggleLayer('predictions', true);
      toggleLayer('risk', true);
      toggleLayer('sensors', true);
      seek(1.0);
      play();
      const el = document.getElementById('demo-stage');
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    },
  },
  {
    timestamp: '1:40',
    title: 'Transparent Data Provenance: Real vs. Simulated',
    subtitle: 'Step 4 of 7 • Data Audit',
    description:
      'We audit all problem statement datasets honestly: 0 real IDD sequences bundled due to license constraints (adapter fully implemented), 9 MathWorks assets, and 75 synthetic episodes.',
    targetId: 'our-data',
    setup: () => {
      const el = document.getElementById('our-data');
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    },
  },
  {
    timestamp: '2:10',
    title: 'Honest Weak Spot: City Junction Challenge',
    subtitle: 'Step 5 of 7 • Limitations',
    description:
      'In multi-vehicle cross-traffic occlusions, P3 achieves 40% completion due to conservative stop livelocks. We report our failure modes openly rather than masking edge cases.',
    targetId: 'demo-stage',
    setup: (selectScen, toggleLayer, seek, play) => {
      selectScen('intersection');
      toggleLayer('predictions', true);
      toggleLayer('risk', true);
      toggleLayer('sensors', true);
      seek(0.0);
      play();
      const el = document.getElementById('demo-stage');
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    },
  },
  {
    timestamp: '2:35',
    title: 'Validation B Benchmark: 3x Collision Reduction',
    subtitle: 'Step 6 of 7 • Traceable Numbers',
    description:
      'Across 25 episodes in runs/val_b_manifest.json, collisions are cut from 60% down to 20%, completion reaches 56%, and mean minimum clearance improves by 32cm.',
    targetId: 'results',
    setup: () => {
      const el = document.getElementById('results');
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    },
  },
  {
    timestamp: '2:55',
    title: 'Research Scope & MathWorks Co-Simulation',
    subtitle: 'Step 7 of 7 • Simulation Only Close',
    description:
      'Simulation only. Not certified for road deployment. Ready for RoadRunner 3D co-simulation and Simulink Stateflow integration. One-command reproduction via python scripts/reproduce_all.py.',
    targetId: 'demo-stage',
    setup: () => {
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    },
  },
];

export const DemoTourModal: React.FC<DemoTourModalProps> = ({
  isOpen,
  onClose,
  onSelectScenario,
  onToggleLayer,
  onSeekTime,
  onPlayReplay,
}) => {
  const [currentStepIdx, setCurrentStepIdx] = useState(0);

  if (!isOpen) return null;

  const step = TOUR_STEPS[currentStepIdx];

  const handleNext = () => {
    if (currentStepIdx < TOUR_STEPS.length - 1) {
      const nextIdx = currentStepIdx + 1;
      setCurrentStepIdx(nextIdx);
      TOUR_STEPS[nextIdx].setup(onSelectScenario, onToggleLayer, onSeekTime, onPlayReplay);
    } else {
      onClose();
    }
  };

  const handlePrev = () => {
    if (currentStepIdx > 0) {
      const prevIdx = currentStepIdx - 1;
      setCurrentStepIdx(prevIdx);
      TOUR_STEPS[prevIdx].setup(onSelectScenario, onToggleLayer, onSeekTime, onPlayReplay);
    }
  };

  const handleJumpToStep = (idx: number) => {
    setCurrentStepIdx(idx);
    TOUR_STEPS[idx].setup(onSelectScenario, onToggleLayer, onSeekTime, onPlayReplay);
  };

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '2rem',
        right: '2rem',
        zIndex: 9998,
        maxWidth: '480px',
        width: 'calc(100% - 4rem)',
        background: '#111318',
        border: '1px solid rgba(45, 212, 191, 0.4)',
        borderRadius: '10px',
        boxShadow: '0 12px 36px rgba(0, 0, 0, 0.85)',
        padding: '1.25rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.85rem',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem',
              background: 'rgba(45, 212, 191, 0.1)',
              color: '#2DD4BF',
              padding: '0.2rem 0.45rem',
              borderRadius: '4px',
              fontSize: '0.75rem',
              fontWeight: 700,
            }}
          >
            <Clock size={12} />
            <span>{step.timestamp}</span>
          </div>
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#94A3B8' }}>
            {step.subtitle}
          </span>
        </div>
        <button
          onClick={onClose}
          aria-label="Close tour"
          style={{
            background: 'transparent',
            border: 'none',
            color: '#94A3B8',
            cursor: 'pointer',
            padding: '0.25rem',
          }}
        >
          <X size={16} />
        </button>
      </div>

      <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#FFFFFF' }}>
        {step.title}
      </h3>

      {/* Description */}
      <p style={{ margin: 0, fontSize: '0.825rem', color: '#CBD5E1', lineHeight: 1.5 }}>
        {step.description}
      </p>

      {/* Action buttons & Timeline dots */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingTop: '0.65rem',
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
        }}
      >
        <button
          onClick={handlePrev}
          disabled={currentStepIdx === 0}
          style={{
            background: 'transparent',
            border: 'none',
            color: currentStepIdx === 0 ? '#4B5563' : '#94A3B8',
            cursor: currentStepIdx === 0 ? 'default' : 'pointer',
            fontSize: '0.8rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.25rem',
          }}
        >
          <ChevronLeft size={14} /> Back
        </button>

        <div style={{ display: 'flex', gap: '0.35rem' }}>
          {TOUR_STEPS.map((s, i) => (
            <button
              key={i}
              onClick={() => handleJumpToStep(i)}
              title={`${s.timestamp}: ${s.title}`}
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: i === currentStepIdx ? '#2DD4BF' : 'rgba(255, 255, 255, 0.2)',
                border: 'none',
                padding: 0,
                cursor: 'pointer',
              }}
            />
          ))}
        </div>

        <button
          onClick={handleNext}
          style={{
            background: '#2DD4BF',
            color: '#090A0D',
            border: 'none',
            borderRadius: '6px',
            padding: '0.35rem 0.75rem',
            fontSize: '0.8rem',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.25rem',
          }}
        >
          {currentStepIdx === TOUR_STEPS.length - 1 ? (
            <>Finish <CheckCircle size={14} /></>
          ) : (
            <>Next <ChevronRight size={14} /></>
          )}
        </button>
      </div>
    </div>
  );
};

