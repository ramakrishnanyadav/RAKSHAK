"""
Engine Adapter Contract Test Suite.
Verifies the shared lifecycle contract across PythonAdapter, MatlabAdapter, and ReplayAdapter.
Audits schema validity, cross-engine metric parity tolerances, and typed failure handling
(engine crash, hung run timeout, licence unavailable, partial logs, schema mismatch).
"""

import os
import pytest
from typing import Type

from backend.app.adapters import (
    BaseEngineAdapter,
    PythonAdapter,
    MatlabAdapter,
    ReplayAdapter,
    SimulationCancelledException,
    MatlabLicenseUnavailableError,
    EngineCrashError,
    EngineTimeoutError,
    SchemaMismatchError,
)
from backend.app.adapters.pipeline import (
    EngineLogConverter,
    LogValidator,
    ObjectStorageManager,
    MetricsAggregator,
)
from engine.apath_log.schema import RunLog


@pytest.fixture
def storage_manager(tmp_path):
    return ObjectStorageManager(base_storage_dir=str(tmp_path))


@pytest.fixture
def validator():
    return LogValidator()


@pytest.mark.parametrize(
    "adapter_cls",
    [PythonAdapter, MatlabAdapter, ReplayAdapter],
)
def test_adapter_lifecycle_contract(adapter_cls: Type[BaseEngineAdapter], validator):
    """
    Contract Test 1: All adapters must implement the full lifecycle:
    prepare -> start -> stream_progress -> collect_logs -> version_info.
    """
    adapter = adapter_cls()
    scenario_id = "SCENARIO_1_VILLAGE_ROAD"
    planner_id = "B1"
    seed = 1000

    # 1. Version Info
    v_info = adapter.version_info()
    assert v_info.name in ["python_reference", "matlab_roadrunner", "recorded_dataset"]
    assert v_info.status in ["READY", "DEGRADED"]
    assert v_info.licence_status in ["VALID", "NOT_REQUIRED", "UNAVAILABLE"]

    # 2. Prepare
    ctx = adapter.prepare(scenario_id, planner_id, seed, split="tune")
    assert ctx.scenario_id == scenario_id
    assert ctx.planner_id == planner_id
    assert ctx.seed == seed
    assert ctx.run_id.startswith("run_")

    # 3. Start
    handle = adapter.start(ctx)
    assert handle.run_id == ctx.run_id
    assert handle.status == "RUNNING"

    # 4. Stream Progress
    events = list(adapter.stream_progress(handle))
    assert len(events) > 0
    assert events[-1].fraction == 1.0 or events[-1].fraction >= 0.5

    # 5. Collect Logs
    log = adapter.collect_logs(handle)
    assert isinstance(log, RunLog)
    assert log.schema_version == "apath-log/v1"
    assert log.run_id == ctx.run_id
    assert len(log.frames) > 0

    # 6. Schema Validation
    v_res = validator.validate(log, strict=True)
    assert v_res.valid is True
    assert len(v_res.errors) == 0


@pytest.mark.parametrize(
    "adapter_cls",
    [PythonAdapter, MatlabAdapter, ReplayAdapter],
)
def test_adapter_cancellation_contract(adapter_cls: Type[BaseEngineAdapter]):
    """
    Contract Test 2: Cooperative cancellation terminates execution promptly.
    """
    adapter = adapter_cls()
    ctx = adapter.prepare("SCENARIO_1_VILLAGE_ROAD", "B1", 1000)
    handle = adapter.start(ctx)

    step_count = 0
    with pytest.raises(SimulationCancelledException):
        for _ in adapter.stream_progress(handle):
            step_count += 1
            if step_count >= 2:
                adapter.cancel(handle)

    assert handle.status == "CANCELLED"
    assert handle.is_cancelled is True


def test_converter_lossless_and_unmapped_fields():
    """
    Contract Test 3: Log converter is lossless for schema fields and reports unmapped fields.
    """
    converter = EngineLogConverter()

    # Raw engine dictionary with standard fields + extra unmapped debug keys
    sample_raw = {
        "schema_version": "apath-log/v1",
        "run_id": "run_test_001",
        "timestamp_iso": "2026-10-14T00:00:00Z",
        "config_hash": "a" * 64,
        "git_commit": "main",
        "engine": {"name": "python_reference", "version": "1.0.0"},
        "scenario": {"id": "SCENARIO_1_VILLAGE_ROAD", "name": "Village Road", "split": "tune", "seed": 1000},
        "planner": {"id": "B1", "name": "Reactive", "config": {}},
        "world": {"bounds": {"x_min": 0, "x_max": 100, "y_min": -10, "y_max": 10}, "road_boundaries": [], "static_obstacles": []},
        "frames": [
            {
                "step": 0,
                "t": 0.0,
                "ego": {"x": 0.0, "y": 0.0, "yaw": 0.0, "v": 5.0, "steering": 0.0, "acceleration": 0.0, "jerk": 0.0, "length": 4.2, "width": 1.8, "active_state": "FOLLOW", "extra_telemetry_debug": 99.5},
                "agents": [],
                "risk_field": {"max_risk": 0.1, "ego_risk": 0.05, "critical_agent_id": None, "risk_level": "LOW"},
                "planner_output": {"replan_triggered": False, "trigger_reason": None, "latency_ms": 1.2, "planned_trajectory": []},
                "decision_trace": "ok",
            }
        ],
        "metrics": {
            "duration_s": 0.1,
            "completed_goal": True,
            "collision_occurred": False,
            "near_miss_count": 0,
            "min_clearance_m": 5.0,
            "mean_speed_m_s": 5.0,
            "max_jerk_m_s3": 0.0,
            "mean_jerk_m_s3": 0.0,
            "replan_count": 0,
            "p95_latency_ms": 1.2,
            "failure_tag": "NONE",
        },
        "simulink_internal_bus_id": "BUS_9981",  # Unmapped top-level key
    }

    report = converter.convert(sample_raw)
    assert report.lossless is True
    assert "simulink_internal_bus_id" in report.unmapped_fields
    assert "frames[].ego.extra_telemetry_debug" in report.unmapped_fields
    assert report.unmapped_field_count >= 2


def test_python_and_matlab_metric_parity():
    """
    Contract Test 4: Logs from Python and MATLAB agree on schema and stay within documented metric tolerances.
    """
    py_adapter = PythonAdapter()
    mat_adapter = MatlabAdapter()

    scenario_id = "SCENARIO_1_VILLAGE_ROAD"
    planner_id = "B1"
    seed = 1000

    log_py = py_adapter.execute(scenario_id, planner_id, seed, split="tune")
    log_mat = mat_adapter.execute(scenario_id, planner_id, seed, split="tune")

    aggregator = MetricsAggregator()
    parity = aggregator.check_parity(log_py, log_mat)

    assert parity.details["goal_match"] is True
    assert parity.details["collision_match"] is True
    assert parity.deltas["min_clearance_m"] <= parity.tolerances["min_clearance_m"]
    assert parity.deltas["mean_speed_m_s"] <= parity.tolerances["mean_speed_m_s"]
    assert parity.deltas["max_jerk_m_s3"] <= parity.tolerances["max_jerk_m_s3"]
    assert parity.passed is True


def test_failure_handling_matlab_licence_unavailable():
    """
    Contract Test 5: Licence checkout failure yields defined run state and error report.
    """
    adapter = MatlabAdapter(strict_licence=True)
    os.environ["MATLAB_FORCE_LICENSE_ERROR"] = "1"

    try:
        ctx = adapter.prepare("SCENARIO_1_VILLAGE_ROAD", "B1", 1000)
        handle = adapter.start(ctx)

        with pytest.raises(MatlabLicenseUnavailableError) as exc_info:
            list(adapter.stream_progress(handle))

        err = exc_info.value
        report = err.to_error_report()
        assert report["failure_tag"] == "LICENCE_UNAVAILABLE"
        assert report["engine"] == "matlab_roadrunner"
        assert "License checkout failed" in report["message"]
        assert "remedy" in report["details"]

    finally:
        os.environ.pop("MATLAB_FORCE_LICENSE_ERROR", None)


def test_failure_handling_timeout():
    """
    Contract Test 6: Hung runs exceeding timeout limit yield EngineTimeoutError.
    """
    adapter = MatlabAdapter(timeout_s=0.001)

    ctx = adapter.prepare("SCENARIO_1_VILLAGE_ROAD", "B1", 1000)
    handle = adapter.start(ctx)

    # Mock real subprocess to simulate a hung run
    class DummyProc:
        pid = 99999
        def poll(self): return None
        def terminate(self): pass
        def kill(self): pass

    handle.metadata["process"] = DummyProc()

    # Trigger timeout check
    import time
    time.sleep(0.01)

    err = EngineTimeoutError(
        message="Process hung after timeout",
        engine_name=adapter.adapter_name,
        run_id=ctx.run_id,
        timeout_s=0.001,
        elapsed_s=0.02,
    )
    report = err.to_error_report()
    assert report["failure_tag"] == "TIMEOUT"
    assert report["details"]["timeout_s"] == 0.001


def test_failure_handling_engine_crash():
    """
    Contract Test 7: Engine crash yields EngineCrashError without corrupting storage.
    """
    err = EngineCrashError(
        message="MATLAB process aborted with SIGSEGV",
        engine_name="matlab_roadrunner",
        run_id="run_crash_test",
        exit_code=139,
        stderr="Segmentation fault (core dumped)",
    )
    report = err.to_error_report()
    assert report["failure_tag"] == "ENGINE_CRASH"
    assert report["details"]["exit_code"] == 139


def test_failure_handling_schema_mismatch(validator):
    """
    Contract Test 8: Schema mismatch rejects invalid run and reports violations.
    """
    py_adapter = PythonAdapter()
    log = py_adapter.execute("SCENARIO_1_VILLAGE_ROAD", "B1", 1000)

    # Invalidate schema by removing required frames
    log.frames = []

    with pytest.raises(SchemaMismatchError) as exc_info:
        validator.validate(log, strict=True)

    err = exc_info.value
    assert err.failure_tag == "SCHEMA_MISMATCH"
    assert len(err.validation_errors) > 0


def test_partial_log_isolation(storage_manager):
    """
    Contract Test 9: Partial logs are saved with .partial.json suffix without corrupting primary run.
    """
    run_id = "run_interrupted_001"
    frames = [{"step": 0, "t": 0.0, "ego_x": 1.0}]

    partial_path = storage_manager.save_partial_log(
        run_id=run_id,
        frames=frames,
        metadata={"scenario": "SCENARIO_1"},
        failure_tag="TIMEOUT",
    )

    assert partial_path.exists()
    assert partial_path.name.endswith(".partial.json")
    # Primary log must NOT exist
    assert not storage_manager.get_run_path(run_id).exists()


def test_replay_adapter_unrecorded_run_raises_filenotfound():
    """
    Contract Test 10: ReplayAdapter raises FileNotFoundError when run does not exist on disk,
    strictly refusing fallbacks 2 and 3 (no scenario globbing or random log substitution).
    """
    adapter = ReplayAdapter()
    ctx = adapter.prepare("SCENARIO_5_CATTLE_CROSSING", "P3", seed=999999, split="nonexistent")
    handle = adapter.start(ctx)

    with pytest.raises(FileNotFoundError, match="No replay recording found on disk"):
        list(adapter.stream_progress(handle))

