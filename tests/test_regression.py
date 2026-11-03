"""
Regression & Acceptance Test Suite for ADAPTIVE-PATH.
ACCEPTANCE CRITERIA:
1. All planners run on all 5 required scenarios and emit valid apath-log/v1 documents.
2. Bit-exact determinism: two identical seed runs produce identical SHA-256 hash.
3. Regression against golden run log metrics.
"""

import hashlib
import json
import pytest
from engine.runner import SimulationRunner
from engine.scenarios.registry import SCENARIOS_CATALOG
from engine.apath_log.schema import RunLog


PLANNERS_LIST = ["B0", "B1", "B2", "P1", "P2", "P3", "P2-ML", "P3-ML"]
SCENARIOS_LIST = list(SCENARIOS_CATALOG.keys())


@pytest.mark.parametrize("planner_id", ["B0", "B1", "B2", "P1", "P2", "P3", "P2-ML", "P3-ML"])
@pytest.mark.parametrize("scenario_id", [
    "SCENARIO_1_VILLAGE_ROAD",
    "SCENARIO_2_URBAN_INTERSECTION",
    "SCENARIO_3_HIGHWAY_MERGE",
    "SCENARIO_4_DENSE_MARKET",
    "SCENARIO_5_CATTLE_CROSSING",
])
def test_acceptance_all_planners_run_on_all_scenarios(planner_id, scenario_id):
    """
    Acceptance gate: Every planner runs closed-loop on every scenario
    and generates valid, schema-compliant apath-log/v1.
    """
    runner = SimulationRunner(dt=0.1)
    run_log = runner.run(
        scenario_id=scenario_id,
        planner_id=planner_id,
        seed=1000,
        split="tune",
        max_duration_s=1.5, # Fast execution window for matrix verification
    )

    # 1. Schema version check
    assert run_log.schema_version == "apath-log/v1"
    assert run_log.run_id.startswith("run_")
    assert len(run_log.config_hash) == 64

    # 2. Frames check
    assert len(run_log.frames) > 0
    first_frame = run_log.frames[0]
    assert first_frame.ego.v >= 0.0
    assert first_frame.planner_output.cost_breakdown is not None
    assert first_frame.planner_output.latency_ms >= 0.0

    # 3. Metrics check
    assert run_log.metrics.duration_s > 0.0
    assert run_log.metrics.mean_speed_m_s >= 0.0


def test_bit_identical_determinism_hash():
    """
    Strict determinism test: two runs with identical scenario, planner, and seed
    MUST yield bit-identical serialized frames and config hashes.
    """
    runner = SimulationRunner(dt=0.1)

    log_a = runner.run("SCENARIO_1_VILLAGE_ROAD", "P3-ML", seed=1007, split="tune", max_duration_s=2.5)
    log_b = runner.run("SCENARIO_1_VILLAGE_ROAD", "P3-ML", seed=1007, split="tune", max_duration_s=2.5)

    assert log_a.config_hash == log_b.config_hash
    assert len(log_a.frames) == len(log_b.frames)
    assert log_a.metrics.min_clearance_m == log_b.metrics.min_clearance_m

    def sanitize_frame(f):
        d = f.model_dump()
        d["planner_output"]["latency_ms"] = 0.0
        return d

    frames_a_json = json.dumps([sanitize_frame(f) for f in log_a.frames], sort_keys=True)
    frames_b_json = json.dumps([sanitize_frame(f) for f in log_b.frames], sort_keys=True)

    hash_a = hashlib.sha256(frames_a_json.encode("utf-8")).hexdigest()
    hash_b = hashlib.sha256(frames_b_json.encode("utf-8")).hexdigest()

    assert hash_a == hash_b, "Two runs with identical seeds MUST be bit-identical."


def test_regression_golden_metrics():
    """
    Regression check against golden benchmark bounds for P3 on Village Road.
    """
    runner = SimulationRunner(dt=0.1)
    run_log = runner.run("SCENARIO_1_VILLAGE_ROAD", "P3", seed=1000, split="tune", max_duration_s=3.0)

    # Invariants for P3 on Village Road
    assert not run_log.metrics.collision_occurred
    assert run_log.metrics.min_clearance_m > 0.35
    assert run_log.metrics.replan_count > 0
    assert run_log.metrics.p95_latency_ms < 100.0
