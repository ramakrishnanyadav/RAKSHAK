import { describe, it, expect } from 'vitest';
import {
  BENCHMARK_SCENARIOS,
  LEGACY_SCENARIO_COMPATIBILITY_MAP,
} from '../pages/Scenarios';

const CANONICAL_SCENARIO_IDS = [
  'SCENARIO_1_VILLAGE_ROAD',
  'SCENARIO_2_URBAN_INTERSECTION',
  'SCENARIO_3_HIGHWAY_MERGE',
  'SCENARIO_4_DENSE_MARKET',
  'SCENARIO_5_CATTLE_CROSSING',
];

const OBSOLETE_LEGACY_IDS = [
  'SCENARIO_1_UNSTRUCTURED_ROUNDABOUT',
  'SCENARIO_2_WRONG_WAY_AUTO',
  'SCENARIO_3_MONSOON_POTHOLE',
  'SCENARIO_4_MIXED_CROWD',
  'SCENARIO_6_BRAKING_TRUCK',
];

describe('Canonical Scenario Registry Parity', () => {
  it('exposes exactly 5 canonical scenarios', () => {
    expect(BENCHMARK_SCENARIOS).toHaveLength(5);
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
      expect(CANONICAL_SCENARIO_IDS).toContain(canonicalTarget);
    }
  });
});
