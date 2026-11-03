"""
Nightly Benchmark Regression and Broken Planner Regression Tests.
ACCEPTANCE CRITERION: A deliberately broken planner change MUST be caught by the nightly regression.
"""

import time
import pytest
from typing import List, Tuple, Optional
from engine.experiments.nightly_benchmark import NightlyBenchmarkSuite, GOLDEN_TOLERANCES
from engine.planners.base import BasePlanner, PlannerStepResult
from engine.apath_log.schema import EgoState, AgentTrack, CostBreakdown


class BrokenRegressionPlanner(BasePlanner):
    """
    A deliberately broken planner that introduces both a high-latency spike
    and path degradation to test nightly regression gate enforcement.
    """
    def __init__(self, params=None):
        super().__init__("BROKEN", "BrokenRegressionPlanner", params)

    def reset(self):
        pass

    def step(
        self,
        ego: EgoState,
        world,
        visible_agents: List[AgentTrack],
        dt: float,
        current_time: float,
    ) -> PlannerStepResult:
        # Deliberately inject a 40ms compute delay exceeding the 35ms P95 ceiling
        time.sleep(0.04)
        path = [(ego.x + i * 1.5, ego.y, 10.0) for i in range(10)]
        return PlannerStepResult(
            steer=0.0,
            accel=2.0,
            active_state="FOLLOW",
            planned_trajectory=path,
            replan_triggered=False,
            trigger_reason=None,
            cost_breakdown=CostBreakdown(
                distance=0.0,
                collision_risk=999.0,
                curvature=0.0,
                energy=0.0,
                replan=0.0,
            ),
            decision_trace="Broken planner causing latency and clearance regression",
        )


class TestNightlyBenchmarkRegression:
    def test_p3_passes_nightly_benchmark_tolerances(self):
        """Verify baseline P3 satisfies all golden tolerance constraints."""
        suite = NightlyBenchmarkSuite(dt=0.1)
        res = suite.run_eval(planner_id="P3", seeds=[1001, 1002, 1003])

        assert res["passed"] is True, f"P3 failed nightly tolerances: {res['violations']}"
        assert res["metrics"]["collision_rate"] <= GOLDEN_TOLERANCES["P3"]["max_collision_rate"]
        assert res["metrics"]["mean_clearance_m"] >= GOLDEN_TOLERANCES["P3"]["min_mean_clearance_m"]

    def test_deliberately_broken_planner_is_caught_by_regression(self, monkeypatch):
        """
        Acceptance test: Deliberately breaking the planner causes the nightly
        regression suite to fail with actionable violation messages.
        """
        suite = NightlyBenchmarkSuite(dt=0.1)

        import engine.runner

        def mock_create_planner(planner_id: str, custom_params=None):
            if planner_id == "P3":
                return BrokenRegressionPlanner()
            return engine.runner.create_planner(planner_id, custom_params)

        monkeypatch.setattr(engine.runner, "create_planner", mock_create_planner)

        # Run nightly evaluation
        res = suite.run_eval(planner_id="P3", seeds=[1001, 1002, 1003])

        # Must fail and detect violations
        assert res["passed"] is False, "Nightly benchmark failed to catch the broken planner!"
        assert len(res["violations"]) > 0
        assert any("P95 latency" in v or "latency" in v or "Collision" in v or "Clearance" in v for v in res["violations"])
