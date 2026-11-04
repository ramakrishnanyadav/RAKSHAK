/**
 * ScenarioPills - Five Canonical Unstructured Indian Road Scenarios
 * Segmented selection pills with road user tags and clear descriptions.
 */

import React from 'react';

export type ScenarioKey = 'cattle' | 'village' | 'intersection' | 'highway' | 'market';

interface ScenarioPillsProps {
  activeKey: ScenarioKey;
  onSelect: (key: ScenarioKey) => void;
}

interface ScenarioOption {
  key: ScenarioKey;
  label: string;
  roadUsers: string[];
  isFlagship?: boolean;
  isWeakSpot?: boolean;
}

const SCENARIOS: ScenarioOption[] = [
  {
    key: 'cattle',
    label: 'Cattle Crossing',
    roadUsers: ['Cattle', 'Pedestrian'],
    isFlagship: true,
  },
  {
    key: 'village',
    label: 'Village Road',
    roadUsers: ['Auto-Rickshaw', 'Motorcycle'],
  },
  {
    key: 'intersection',
    label: 'City Junction',
    roadUsers: ['Handcart', 'Auto-Rickshaw', 'Truck'],
    isWeakSpot: true,
  },
  {
    key: 'highway',
    label: 'Highway Merge',
    roadUsers: ['Heavy Truck', 'Two-Wheeler'],
  },
  {
    key: 'market',
    label: 'Dense Market',
    roadUsers: ['Pedestrian Crowd', 'Handcart'],
  },
];

export const ScenarioPills: React.FC<ScenarioPillsProps> = ({ activeKey, onSelect }) => {
  const current = SCENARIOS.find((s) => s.key === activeKey) || SCENARIOS[0];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
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

      {/* Active Scenario Road User Chips */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '0.75rem', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Active Road Users:
        </span>
        {current.roadUsers.map((ru) => (
          <span
            key={ru}
            style={{
              fontSize: '0.75rem',
              color: '#CBD5E1',
              background: '#1A1D26',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              padding: '0.15rem 0.5rem',
              borderRadius: '4px',
            }}
          >
            {ru}
          </span>
        ))}
      </div>
    </div>
  );
};
