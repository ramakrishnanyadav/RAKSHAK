/**
 * ScenarioPicker - Segmented Scenario Pills & 6-Class IDD Agent Legend
 * Displays: 5 Canonical Scenarios, "Built from" provenance tag, and visual legend.
 */

import React from 'react';

export type ScenarioKey = 'cattle' | 'village' | 'intersection' | 'highway' | 'market';

export interface ScenarioOption {
  key: ScenarioKey;
  label: string;
  builtFrom: string;
  sourceFile: string;
  roadUsers: string[];
  isFlagship?: boolean;
  isWeakSpot?: boolean;
}

export const SCENARIOS: ScenarioOption[] = [
  {
    key: 'cattle',
    label: 'Cattle Crossing',
    builtFrom: 'Synthetic rural corridor + livestock dynamics',
    sourceFile: 'engine/scenarios/scenarios_impl.py',
    roadUsers: ['Cattle', 'Pedestrian'],
    isFlagship: true,
  },
  {
    key: 'village',
    label: 'Village Road',
    builtFrom: 'RoadRunner scene (VillageRoad.xodr) + synthetic traffic mix',
    sourceFile: 'matlab_adapter/roadrunner/VillageRoad.xodr',
    roadUsers: ['Auto-Rickshaw', 'Motorcycle', 'Pedestrian'],
  },
  {
    key: 'intersection',
    label: 'City Junction',
    builtFrom: 'RoadRunner scene (UrbanIntersection.xodr) + synthetic cross-traffic',
    sourceFile: 'matlab_adapter/roadrunner/UrbanIntersection.xodr',
    roadUsers: ['Handcart', 'Auto-Rickshaw', 'Truck'],
    isWeakSpot: true,
  },
  {
    key: 'highway',
    label: 'Highway Merge',
    builtFrom: 'Synthetic multi-lane highway + high-speed truck kinematics',
    sourceFile: 'engine/scenarios/scenarios_impl.py',
    roadUsers: ['Heavy Truck', 'Two-Wheeler'],
  },
  {
    key: 'market',
    label: 'Dense Market',
    builtFrom: 'Synthetic commercial corridor + vendor stalls and pedestrian clusters',
    sourceFile: 'engine/scenarios/scenarios_impl.py',
    roadUsers: ['Pedestrian Crowd', 'Handcart', 'Auto-Rickshaw'],
  },
];

interface ScenarioPickerProps {
  activeKey: ScenarioKey;
  onSelect: (key: ScenarioKey) => void;
}

export const ScenarioPicker: React.FC<ScenarioPickerProps> = ({ activeKey, onSelect }) => {
  const current = SCENARIOS.find((s) => s.key === activeKey) || SCENARIOS[0];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
      {/* Pills Container */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0.5rem',
          background: 'rgba(255, 255, 255, 0.03)',
          padding: '0.375rem',
          borderRadius: '8px',
          border: '1px solid rgba(255, 255, 255, 0.08)',
        }}
        role="tablist"
        aria-label="Scenario selector"
      >
        {SCENARIOS.map((sc) => {
          const isActive = sc.key === activeKey;
          return (
            <button
              key={sc.key}
              role="tab"
              aria-selected={isActive}
              onClick={() => onSelect(sc.key)}
              style={{
                flex: '1 1 auto',
                minWidth: '130px',
                padding: '0.5rem 0.85rem',
                borderRadius: '6px',
                border: 'none',
                background: isActive ? '#262A36' : 'transparent',
                color: isActive ? '#FFFFFF' : '#94A3B8',
                cursor: 'pointer',
                fontSize: '0.875rem',
                fontWeight: isActive ? 600 : 500,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.45rem',
                transition: 'all 0.15s ease',
              }}
            >
              <span>{sc.label}</span>
              {sc.isFlagship && (
                <span
                  style={{
                    fontSize: '0.65rem',
                    background: 'rgba(45, 212, 191, 0.15)',
                    color: '#2DD4BF',
                    padding: '0.1rem 0.35rem',
                    borderRadius: '4px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                  }}
                >
                  Flagship
                </span>
              )}
              {sc.isWeakSpot && (
                <span
                  style={{
                    fontSize: '0.65rem',
                    background: 'rgba(245, 158, 11, 0.15)',
                    color: '#FBBF24',
                    padding: '0.1rem 0.35rem',
                    borderRadius: '4px',
                    fontWeight: 600,
                  }}
                >
                  Hard Case
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Scenario "Built from" Provenance Bar + Road Users Legend */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.75rem',
          fontSize: '0.775rem',
          color: '#94A3B8',
          padding: '0.5rem 0.75rem',
          background: 'rgba(0, 0, 0, 0.2)',
          borderRadius: '6px',
          border: '1px solid rgba(255, 255, 255, 0.05)',
        }}
      >
        {/* Built from tag */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <span style={{ color: '#64748B', fontWeight: 600 }}>Built from:</span>
          <span style={{ color: '#CBD5E1', fontWeight: 500 }}>{current.builtFrom}</span>
          <span
            style={{
              fontSize: '0.7rem',
              color: '#2DD4BF',
              background: 'rgba(45, 212, 191, 0.08)',
              padding: '0.05rem 0.35rem',
              borderRadius: '3px',
              fontFamily: 'monospace',
            }}
            title={`Source code / scene file: ${current.sourceFile}`}
          >
            source: {current.sourceFile}
          </span>
        </div>

        {/* 6 IDD-style Road User Classes Legend */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
          <span style={{ color: '#64748B', fontWeight: 600 }}>Classes:</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: '#2DD4BF' }} />
            <span style={{ color: '#CBD5E1' }}>Ego (Teal)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: '#A16207' }} />
            <span style={{ color: '#CBD5E1' }}>Cattle</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: '#15803D' }} />
            <span style={{ color: '#CBD5E1' }}>Auto</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: '#92400E' }} />
            <span style={{ color: '#CBD5E1' }}>Handcart</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: '#38BDF8' }} />
            <span style={{ color: '#CBD5E1' }}>Pedestrian</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: '#475569' }} />
            <span style={{ color: '#CBD5E1' }}>Truck</span>
          </div>
        </div>
      </div>
    </div>
  );
};

// Backward-compatible alias
export const ScenarioPills = ScenarioPicker;

