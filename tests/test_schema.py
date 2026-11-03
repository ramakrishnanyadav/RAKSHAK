"""
Tests for apath-log v1 Schema Validation.
"""

import pytest
from engine.apath_log.schema import (
    RunLog,
    Frame,
    EgoState,
    AgentTrack,
    PredictionHypothesis,
    ConformalConePoint,
    RiskFieldSummary,
    PlannerOutput,
    RunMetrics,
    WorldMap,
    EngineInfo,
    ScenarioMetadata,
    PlannerMetadata,
)


def test_schema_valid_creation():
    frame = Frame(
        step=0,
        t=0.0,
        ego=EgoState(x=0.0, y=0.0, yaw=0.0, v=5.0, steering=0.0, acceleration=0.0),
        agents=[
            AgentTrack(
                id="ag1",
                class_name="auto_rickshaw",
                x=10.0,
                y=0.0,
                yaw=0.0,
                v_x=4.0,
                v_y=0.0,
                length=2.8,
                width=1.3,
                prediction_hypotheses=[
                    PredictionHypothesis(weight=1.0, intent="continue", trajectory=[])
                ],
                conformal_envelope=[
                    ConformalConePoint(t_rel=0.5, radius_m=0.8, coverage_p=0.95)
                ],
            )
        ],
        risk_field=RiskFieldSummary(max_risk=0.2, ego_risk=0.1, risk_level="LOW"),
        planner_output=PlannerOutput(replan_triggered=False),
        decision_trace="Normal following.",
    )

    metrics = RunMetrics(
        duration_s=10.0,
        completed_goal=True,
        collision_occurred=False,
        near_miss_count=0,
        min_clearance_m=2.5,
        mean_speed_m_s=6.5,
        max_jerk_m_s3=1.2,
        mean_jerk_m_s3=0.4,
        replan_count=4,
        p95_latency_ms=12.5,
        failure_tag=None,
    )

    run_log = RunLog(
        schema_version="apath-log/v1",
        run_id="test_run_01",
        timestamp_iso="2026-10-14T04:00:00Z",
        config_hash="abc123hash",
        engine=EngineInfo(name="python_reference", version="1.0.0"),
        scenario=ScenarioMetadata(
            id="SCENARIO_5_CATTLE_CROSSING",
            name="Sudden Cattle Crossing",
            split="tune",
            seed=1000,
        ),
        planner=PlannerMetadata(id="P3", name="Planner 3: Risk-Adaptive"),
        world=WorldMap(),
        frames=[frame],
        metrics=metrics,
    )

    # Validate JSON serialization round-trip
    json_str = run_log.model_dump_json()
    assert "apath-log/v1" in json_str
    reloaded = RunLog.model_validate_json(json_str)
    assert reloaded.run_id == "test_run_01"
    assert len(reloaded.frames) == 1
    assert reloaded.frames[0].agents[0].class_name == "auto_rickshaw"
