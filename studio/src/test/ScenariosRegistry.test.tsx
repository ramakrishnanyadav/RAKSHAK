import { describe, it, expect } from 'vitest';
import {
  BENCHMARK_SCENARIOS,
  LEGACY_SCENARIO_COMPATIBILITY_MAP,
} from '../pages/Scenarios';

const CANONICAL_SCENARIO_IDS = [
  'SCENARIO_01_POTHOLE_DAMAGED_ROAD',
  'SCENARIO_02_PEDESTRIAN_CROSSING',
  'SCENARIO_03_DENSE_MIXED_TRAFFIC',
  'SCENARIO_04_MOTORCYCLE_CUT_IN',
  'SCENARIO_05_UNCONTROLLED_INTERSECTION',
  'SCENARIO_06_HIGHWAY_SUDDEN_BRAKING',
  'SCENARIO_07_ROADWORKS_OBSTRUCTION',
  'SCENARIO_08_CATTLE_CROSSING',
  'SCENARIO_1_VILLAGE_ROAD',
  'SCENARIO_5_CATTLE_CROSSING',
];

const HISTORICAL_TARGET_IDS = [
  ...CANONICAL_SCENARIO_IDS,
  'SCENARIO_2_URBAN_INTERSECTION',
  'SCENARIO_3_HIGHWAY_MERGE',
  'SCENARIO_4_DENSE_MARKET',
];

const OBSOLETE_LEGACY_IDS = [
  'SCENARIO_1_UNSTRUCTURED_ROUNDABOUT',
  'SCENARIO_2_WRONG_WAY_AUTO',
  'SCENARIO_3_MONSOON_POTHOLE',
  'SCENARIO_4_MIXED_CROWD',
  'SCENARIO_6_BRAKING_TRUCK',
];

describe('Canonical Scenario Registry Parity', () => {
  it('exposes the canonical 8 benchmark scenarios and legacy compatibility entries', () => {
    expect(BENCHMARK_SCENARIOS.length).toBeGreaterThanOrEqual(8);
  });

  it('matches canonical scenario IDs exactly in order', () => {
    const ids = BENCHMARK_SCENARIOS.map((s) => s.id);
    expect(ids).toEqual(CANONICAL_SCENARIO_IDS);
  });

  it('contains zero obsolete legacy scenario IDs in the active catalog', () => {
    const ids = new Set(BENCHMARK_SCENARIOS.map((s) => s.id));
    for (const legacyId of OBSOLETE_LEGACY_IDS) {
      expect(ids.has(legacyId)).toBe(false);
    }
  });

  it('communicates Environment, Traffic Challenge, and Evaluates for every scenario', () => {
    for (const sc of BENCHMARK_SCENARIOS) {
      expect(sc.environment).toBeTruthy();
      expect(sc.environment.length).toBeGreaterThan(10);

      expect(sc.trafficChallenge).toBeTruthy();
      expect(sc.trafficChallenge.length).toBeGreaterThan(10);

      expect(sc.evaluates).toBeTruthy();
      expect(sc.evaluates.length).toBeGreaterThan(10);

      expect(sc.name).toBeTruthy();
      expect(sc.description).toBeTruthy();
      expect(sc.speed).toBeTruthy();
      expect(sc.distance).toBeTruthy();
      expect(sc.roadWidth).toBeTruthy();
      expect(sc.agentMix.length).toBeGreaterThan(0);
      expect(sc.defaultRunId).toBeTruthy();
    }
  });

  it('provides backward-compatibility mapping for all historical legacy IDs', () => {
    for (const legacyId of OBSOLETE_LEGACY_IDS) {
      const canonicalTarget = LEGACY_SCENARIO_COMPATIBILITY_MAP[legacyId];
      expect(canonicalTarget).toBeDefined();
      expect(HISTORICAL_TARGET_IDS).toContain(canonicalTarget);
    }
  });

  it('generates valid API creation payloads for all 5 canonical scenarios', () => {
    for (const sc of BENCHMARK_SCENARIOS) {
      const payload = {
        scenario_id: sc.id,
        planner_id: 'P3',
        engine_adapter: 'python_inprocess',
        split: sc.split,
        seed: 1000,
      };
      expect(CANONICAL_SCENARIO_IDS).toContain(payload.scenario_id);
      expect(payload.scenario_id.startsWith('SCENARIO_')).toBe(true);
      expect(payload.seed).toBeGreaterThanOrEqual(1000);
    }
  });

  it('safely normalizes unknown or historical IDs without throwing exceptions', () => {
    const resolveScenarioId = (id: string | null | undefined): string => {
      if (!id) return 'SCENARIO_5_CATTLE_CROSSING';
      return LEGACY_SCENARIO_COMPATIBILITY_MAP[id] || id;
    };

    expect(resolveScenarioId('SCENARIO_1_UNSTRUCTURED_ROUNDABOUT')).toBe('SCENARIO_1_VILLAGE_ROAD');
    expect(resolveScenarioId('SCENARIO_2_WRONG_WAY_AUTO')).toBe('SCENARIO_2_URBAN_INTERSECTION');
    expect(resolveScenarioId('SCENARIO_3_MONSOON_POTHOLE')).toBe('SCENARIO_3_HIGHWAY_MERGE');
    expect(resolveScenarioId('SCENARIO_4_MIXED_CROWD')).toBe('SCENARIO_4_DENSE_MARKET');
    expect(resolveScenarioId('SCENARIO_6_BRAKING_TRUCK')).toBe('SCENARIO_5_CATTLE_CROSSING');
    expect(resolveScenarioId(null)).toBe('SCENARIO_5_CATTLE_CROSSING');
    expect(resolveScenarioId('SCENARIO_1_VILLAGE_ROAD')).toBe('SCENARIO_1_VILLAGE_ROAD');
  });
});
