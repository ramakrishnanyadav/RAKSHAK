"""
Demonstration Script: Broken Planner Regression Catch.
Simulates a pull request with a broken motion planner (e.g. latency regression or collision).
Demonstrates that the nightly benchmark regression pipeline immediately catches the failure,
exits with code 1, and reports the exact violated metric tolerances.
"""

import sys
import time
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from engine.experiments.nightly_benchmark import NightlyBenchmarkSuite, GOLDEN_TOLERANCES
from engine.planners.base import BasePlanner, PlannerStepResult
from engine.apath_log.schema import EgoState, AgentTrack, CostBreakdown


class BrokenPRPlanner(BasePlanner):
    """Simulates a flawed PR: introduces a 50ms compute delay and ignores collision avoidance."""
    def __init__(self, params=None):
        super().__init__("BROKEN_PR", "BrokenPRPlanner", params)

    def reset(self):
        pass

    def step(self, ego: EgoState, world, visible_agents, dt: float, current_time: float) -> PlannerStepResult:
        time.sleep(0.045) # Exceeds P95 latency limit
        path = [(ego.x + i * 2.0, ego.y, 10.0) for i in range(10)]
        return PlannerStepResult(
            steer=0.0,
            accel=3.0,
            active_state="FOLLOW",
            planned_trajectory=path,
            replan_triggered=False,
            trigger_reason=None,
            cost_breakdown=CostBreakdown(distance=0.0, collision_risk=999.0, curvature=0.0, energy=0.0, replan=0.0),
            decision_trace="Broken PR planner",
        )


def main():
    print("==================================================================")
    print(" SIMULATING PR WITH DELIBERATELY BROKEN PLANNER REGRESSION        ")
    print("==================================================================")
    suite = NightlyBenchmarkSuite(dt=0.1)

    import engine.runner
    engine.runner.create_planner = lambda pid, params=None: BrokenPRPlanner()

    res = suite.run_eval(planner_id="P3", seeds=[1001, 1002, 1003])

    print(f"Total Evaluated Runs: {res['metrics']['total_runs']}")
    print(f"Measured P95 Latency: {res['metrics']['p95_latency_ms']} ms (Tolerance: {res['bounds']['max_p95_latency_ms']} ms)")
    print(f"Measured Mean Clearance: {res['metrics']['mean_clearance_m']} m (Tolerance: {res['bounds']['min_mean_clearance_m']} m)")
    print(f"Regression Gate Passed: {res['passed']}")
    print("------------------------------------------------------------------")

    if not res["passed"]:
        print(">> REGRESSION GATE TRIGGERED: The pipeline successfully caught the broken planner!")
        for v in res["violations"]:
            print(f"   [DEFECT DETECTED] {v}")
        print(">> CI/CD Status: BLOCKED (Exit code 1)")
        return 0 # Demo succeeded in demonstrating failure detection
    else:
        print(">> ERROR: Regression was NOT caught!")
        return 1


if __name__ == "__main__":
    sys.exit(main())
