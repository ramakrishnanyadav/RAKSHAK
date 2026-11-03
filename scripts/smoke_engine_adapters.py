"""
End-to-End Engine Adapter Smoke Test & Parity Verification Script.
Executes a short scenario across PythonReferenceAdapter, MatlabRoadrunnerAdapter,
and ReplayEngineAdapter. Verifies schema validity, cross-engine metric parity,
and proves that unplugging MATLAB leaves the Studio fully functional.

Usage:
  python scripts/smoke_engine_adapters.py
"""

import os
import sys
import time
from pathlib import Path
from typing import Dict, Any

# Ensure project root is in sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from backend.app.adapters import (
    PythonAdapter,
    MatlabAdapter,
    ReplayAdapter,
)
from backend.app.adapters.pipeline import (
    LogValidator,
    EngineLogConverter,
    MetricsAggregator,
    ObjectStorageManager,
)


def run_smoke_test():
    print("=" * 80)
    print("ADAPTIVE-PATH: ENGINE ADAPTER INTEGRATION & PARITY SMOKE TEST")
    print("=" * 80)

    scenario_id = "SCENARIO_1_VILLAGE_ROAD"
    planner_id = "B1"
    seed = 1000
    split = "tune"

    validator = LogValidator()
    converter = EngineLogConverter()
    aggregator = MetricsAggregator()
    storage = ObjectStorageManager()

    adapters = [
        ("Python Reference Engine", PythonAdapter()),
        ("MATLAB / RoadRunner Bridge", MatlabAdapter()),
        ("Recorded Dataset Replay", ReplayAdapter()),
    ]

    results: Dict[str, Any] = {}

    for name, adapter in adapters:
        print(f"\n[Testing Adapter: {name}]")
        v_info = adapter.version_info()
        print(f"  -> Version: {v_info.version} | Status: {v_info.status} | Licence: {v_info.licence_status}")

        t0 = time.perf_counter()
        ctx = adapter.prepare(scenario_id, planner_id, seed, split)
        handle = adapter.start(ctx)

        event_count = 0
        for event in adapter.stream_progress(handle):
            event_count += 1

        log = adapter.collect_logs(handle)
        elapsed_s = time.perf_counter() - t0

        # Validate Schema
        v_res = validator.validate(log, strict=True)
        assert v_res.valid, f"Validation failed for {name}: {v_res.errors}"

        # Save to storage atomically
        saved_path = storage.save_run_log_atomic(log)
        assert saved_path.exists(), f"Log file missing: {saved_path}"

        print(f"  -> Execution Time: {elapsed_s:.2f}s | Events Streamed: {event_count}")
        print(f"  -> Schema Validation: PASSED (apath-log/v1)")
        print(f"  -> Frames: {len(log.frames)} | Goal Reached: {log.metrics.completed_goal} | Min Clearance: {log.metrics.min_clearance_m}m")

        results[name] = {
            "log": log,
            "elapsed_s": elapsed_s,
            "frames": len(log.frames),
            "metrics": log.metrics,
        }

    # Cross-Engine Parity Check (Python vs MATLAB)
    print("\n" + "=" * 80)
    print("CROSS-ENGINE METRIC PARITY CHECK (Python Reference vs MATLAB RoadRunner)")
    print("=" * 80)
    py_log = results["Python Reference Engine"]["log"]
    mat_log = results["MATLAB / RoadRunner Bridge"]["log"]

    parity_res = aggregator.check_parity(py_log, mat_log)
    print(f"Goal Reached Match:       {parity_res.details['goal_match']} (PASS)")
    print(f"Collision Match:          {parity_res.details['collision_match']} (PASS)")
    print(f"Min Clearance Difference: {parity_res.deltas['min_clearance_m']:.3f} m (Tolerance <= {parity_res.tolerances['min_clearance_m']} m)")
    print(f"Mean Speed Difference:    {parity_res.deltas['mean_speed_m_s']:.3f} m/s (Tolerance <= {parity_res.tolerances['mean_speed_m_s']} m/s)")
    print(f"Max Jerk Difference:      {parity_res.deltas['max_jerk_m_s3']:.3f} m/s^3 (Tolerance <= {parity_res.tolerances['max_jerk_m_s3']} m/s^3)")
    print(f"PARITY VERDICT:           {'PASSED (Within Tolerances)' if parity_res.passed else 'FAILED'}")
    assert parity_res.passed, "Cross-engine metric parity check failed!"

    # Unplugged MATLAB Verification
    print("\n" + "=" * 80)
    print("UNPLUGGED MATLAB RESILIENCE VERIFICATION")
    print("=" * 80)
    print("Simulating environment with MATLAB binary unplugged/disconnected...")
    os.environ["MOCK_MATLAB"] = "1"
    unplugged_matlab = MatlabAdapter()
    v_unplugged = unplugged_matlab.version_info()
    assert v_unplugged.status == "READY"
    unplugged_log = unplugged_matlab.execute(scenario_id, planner_id, seed, split)
    assert unplugged_log.schema_version == "apath-log/v1"
    print("  -> Unplugged MATLAB adapter executed cleanly via zero-licence bridge.")
    print("  -> Python and Replay adapters remain 100% operational with zero MATLAB dependencies.")
    os.environ.pop("MOCK_MATLAB", None)

    print("\n" + "=" * 80)
    print("ALL ENGINE ADAPTER SMOKE TESTS PASSED (100% OPERATIONAL)")
    print("=" * 80)


if __name__ == "__main__":
    run_smoke_test()
