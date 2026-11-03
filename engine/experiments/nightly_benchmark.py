"""
Nightly Benchmark Regression Runner.
Evaluates motion planners against pre-registered golden metric bounds and tolerances.
Fails with a non-zero exit code if any primary metric worsens beyond acceptable tolerance.
"""

import sys
import os
import json
from pathlib import Path

# Ensure repository root is on sys.path
REPO_ROOT = Path(__file__).resolve().parent.parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from typing import Dict, Any, List, Tuple
from engine.runner import SimulationRunner
from engine.scenarios.registry import SCENARIOS_CATALOG


GOLDEN_TOLERANCES: Dict[str, Dict[str, float]] = {
    "P3": {
        "max_collision_rate": 0.05,
        "min_mean_clearance_m": 0.85,
        "max_p95_latency_ms": 35.0, # Ceiling on CPU runner
        "max_peak_jerk_m_s3": 45.0,
    },
    "P2": {
        "max_collision_rate": 0.10,
        "min_mean_clearance_m": 0.70,
        "max_p95_latency_ms": 35.0,
        "max_peak_jerk_m_s3": 50.0,
    },
    "B1": {
        "max_collision_rate": 0.30,
        "min_mean_clearance_m": 0.40,
        "max_p95_latency_ms": 30.0,
        "max_peak_jerk_m_s3": 60.0,
    },
}


class NightlyBenchmarkSuite:
    def __init__(self, dt: float = 0.1):
        self.runner = SimulationRunner(dt=dt)

    def run_eval(
        self,
        planner_id: str = "P3",
        scenarios: List[str] = None,
        seeds: List[int] = None,
        override_planner = None,
    ) -> Dict[str, Any]:
        """
        Runs evaluation over test scenarios and seeds.
        Allows passing an override_planner instance for regression testing.
        """
        eval_scenarios = scenarios or ["SCENARIO_1_VILLAGE_ROAD", "SCENARIO_5_CATTLE_CROSSING"]
        eval_seeds = seeds or [1001, 1002, 1003, 1004, 1005]

        total_runs = len(eval_scenarios) * len(eval_seeds)
        collisions = 0
        clearances = []
        latencies = []
        jerks = []

        for sc in eval_scenarios:
            for s in eval_seeds:
                log = self.runner.run(
                    scenario_id=sc,
                    planner_id=planner_id,
                    seed=s,
                    split="frozen_test",
                    max_duration_s=2.5,
                )
                if log.metrics.collision_occurred:
                    collisions += 1
                clearances.append(log.metrics.min_clearance_m)
                latencies.append(log.metrics.p95_latency_ms)
                jerks.append(log.metrics.max_jerk_m_s3)

        collision_rate = collisions / max(1, total_runs)
        mean_clearance = sum(clearances) / max(1, len(clearances))
        p95_lat = sorted(latencies)[int(0.95 * len(latencies))] if latencies else 0.0
        peak_jerk = max(jerks) if jerks else 0.0

        metrics = {
            "total_runs": total_runs,
            "collision_rate": round(collision_rate, 4),
            "mean_clearance_m": round(mean_clearance, 3),
            "p95_latency_ms": round(p95_lat, 2),
            "peak_jerk_m_s3": round(peak_jerk, 2),
        }

        # Check tolerances
        bounds = GOLDEN_TOLERANCES.get(planner_id, GOLDEN_TOLERANCES["P3"])
        violations = []

        if collision_rate > bounds["max_collision_rate"]:
            violations.append(
                f"Collision rate {collision_rate:.3f} exceeded tolerance {bounds['max_collision_rate']:.3f}"
            )
        if mean_clearance < bounds["min_mean_clearance_m"]:
            violations.append(
                f"Mean clearance {mean_clearance:.3f}m dropped below tolerance {bounds['min_mean_clearance_m']:.3f}m"
            )
        if p95_lat > bounds["max_p95_latency_ms"]:
            violations.append(
                f"P95 latency {p95_lat:.1f}ms exceeded tolerance {bounds['max_p95_latency_ms']:.1f}ms"
            )
        if peak_jerk > bounds["max_peak_jerk_m_s3"]:
            violations.append(
                f"Peak jerk {peak_jerk:.1f}m/s^3 exceeded tolerance {bounds['max_peak_jerk_m_s3']:.1f}m/s^3"
            )

        passed = len(violations) == 0

        return {
            "planner_id": planner_id,
            "passed": passed,
            "metrics": metrics,
            "bounds": bounds,
            "violations": violations,
        }


def main():
    suite = NightlyBenchmarkSuite()
    result = suite.run_eval(planner_id="P3")

    print("=======================================================")
    print("      ADAPTIVE-PATH NIGHTLY BENCHMARK REGRESSION       ")
    print("=======================================================")
    print(f"Planner: {result['planner_id']}")
    print(f"Total Runs: {result['metrics']['total_runs']}")
    print(f"Collision Rate: {result['metrics']['collision_rate']} (Limit: {result['bounds']['max_collision_rate']})")
    print(f"Mean Clearance: {result['metrics']['mean_clearance_m']}m (Limit: {result['bounds']['min_mean_clearance_m']}m)")
    print(f"P95 Latency: {result['metrics']['p95_latency_ms']}ms (Limit: {result['bounds']['max_p95_latency_ms']}ms)")
    print(f"Peak Jerk: {result['metrics']['peak_jerk_m_s3']}m/s^3 (Limit: {result['bounds']['max_peak_jerk_m_s3']}m/s^3)")
    print("-------------------------------------------------------")

    if result["passed"]:
        print("RESULT: SUCCESS - All primary metrics within golden tolerance bounds.")
        sys.exit(0)
    else:
        print("RESULT: FAILED - Benchmark regressions detected!")
        for v in result["violations"]:
            print(f"  [VIOLATION] {v}")
        sys.exit(1)


if __name__ == "__main__":
    main()
