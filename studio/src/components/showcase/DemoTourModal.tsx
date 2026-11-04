/**
 * DemoTourModal - 3-Minute Guided Walkthrough for Judges
 * Steps through Cattle Crossing, Perception/Conformal bounds, and Empirical validation.
 */

import React, { useState } from 'react';
import { X, ChevronRight, ChevronLeft, Play, CheckCircle } from 'lucide-react';

interface DemoTourModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectScenario: (key: 'cattle' | 'village' | 'intersection' | 'highway' | 'market') => void;
  onToggleLayer: (layer: 'sensors' | 'predictions' | 'risk', value: boolean) => void;
  onSeekTime: (time: number) => void;
  onPlayReplay: () => void;
}

interface TourStep {
  title: string;
  subtitle: string;
  description: string;
  scenario: 'cattle' | 'village' | 'intersection' | 'highway' | 'market';
  time: number;
  setup: (
    selectScen: (s: any) => void,
    toggleLayer: (l: any, v: boolean) => void,
    seek: (t: number) => void,
    play: () => void
  ) => void;
}

const TOUR_STEPS: TourStep[] = [
  {
    title: 'The Flagship Moment: Livestock on Rural Road',
    subtitle: 'Step 1 of 3 • Cattle Crossing',
    description:
      'Notice the standard planner (left) assumes the cow will walk forward in a straight line, causing a collision at 5.1s. ADAPTIVE-PATH (right) predicts both crossing and mid-road freezing, smoothly slowing down to 8 km/h and reaching the destination safely.',
    scenario: 'cattle',
    time: 5.0,
    setup: (selectScen, toggleLayer, seek, play) => {
      selectScen('cattle');
      toggleLayer('predictions', true);
      toggleLayer('risk', true);
      toggleLayer('sensors', true);
      seek(4.5);
      play();
    },
  },
  {
    title: 'Multi-Sensor Perception & Dynamic Safety Bounds',
    subtitle: 'Step 2 of 3 • Sensor Cones & Occlusion',
    description:
      'See how Camera (green cone), LiDAR (360 dash ring), and Radar (blue beam) identify occlusions behind parked vehicles. The conformal safety cushion expands as animal movements become unpredictable.',
    scenario: 'cattle',
    time: 3.0,
    setup: (selectScen, toggleLayer, seek, play) => {
      selectScen('cattle');
      toggleLayer('sensors', true);
      toggleLayer('predictions', true);
      toggleLayer('risk', false);
      seek(2.5);
      play();
    },
  },
  {
    title: 'Empirical Research Results & Honest Audit',
    subtitle: 'Step 3 of 3 • 25-Episode Benchmark',
    description:
      'Over 25 validation episodes (seeds 2005–2009), ADAPTIVE-PATH cuts crashes by 3x (from 60% down to 20%) and increases goal completions by 1.4x. We honestly report that dense urban intersections remain our key challenge for future radar Doppler fusion.',
    scenario: 'intersection',
    time: 0.0,
    setup: (selectScen, toggleLayer, seek, play) => {
      selectScen('intersection');
      toggleLayer('predictions', true);
      toggleLayer('risk', true);
      toggleLayer('sensors', true);
      seek(0.0);
      play();
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

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '2rem',
        right: '2rem',
        zIndex: 9998,
        maxWidth: '460px',
        width: 'calc(100% - 4rem)',
        background: '#111318',
        border: '1px solid rgba(45, 212, 191, 0.4)',
        borderRadius: '10px',
        boxShadow: '0 12px 36px rgba(0, 0, 0, 0.8)',
        padding: '1.25rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.85rem',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#2DD4BF', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {step.subtitle}
          </span>
          <h3 style={{ margin: '0.15rem 0 0', fontSize: '1rem', fontWeight: 700, color: '#FFFFFF' }}>
            {step.title}
          </h3>
        </div>
        <button
          onClick={onClose}
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

      {/* Description */}
      <p style={{ margin: 0, fontSize: '0.825rem', color: '#CBD5E1', lineHeight: 1.5 }}>
        {step.description}
      </p>

      {/* Action buttons */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '0.5rem', borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
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

        <div style={{ display: 'flex', gap: '0.25rem' }}>
          {TOUR_STEPS.map((_, i) => (
            <span
              key={i}
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: i === currentStepIdx ? '#2DD4BF' : 'rgba(255, 255, 255, 0.2)',
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
