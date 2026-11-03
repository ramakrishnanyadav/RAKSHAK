"""
Tests for Non-Negotiable Determinism:
Identical configuration + seed MUST yield identical frames and log metrics.
"""

from engine.runner import SimulationRunner


def test_simulation_determinism():
    runner = SimulationRunner(dt=0.1)

    log_1 = runner.run(
        scenario_id="SCENARIO_5_CATTLE_CROSSING",
        planner_id="P3",
        seed=1005,
        split="tune",
        max_duration_s=4.0,
    )

    log_2 = runner.run(
        scenario_id="SCENARIO_5_CATTLE_CROSSING",
        planner_id="P3",
        seed=1005,
        split="tune",
        max_duration_s=4.0,
    )

    assert log_1.config_hash == log_2.config_hash
    assert len(log_1.frames) == len(log_2.frames)
    assert log_1.metrics.duration_s == log_2.metrics.duration_s
    assert log_1.metrics.min_clearance_m == log_2.metrics.min_clearance_m

    for i in range(len(log_1.frames)):
        f1 = log_1.frames[i]
        f2 = log_2.frames[i]
        assert f1.t == f2.t
        assert f1.ego.x == f2.ego.x
        assert f1.ego.y == f2.ego.y
        assert f1.ego.v == f2.ego.v
        assert f1.planner_output.replan_triggered == f2.planner_output.replan_triggered
