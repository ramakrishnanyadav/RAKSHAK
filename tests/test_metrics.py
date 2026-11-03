"""
Comprehensive Test Suite for Authoritative Metric Computation.
Verifies exact compliance with docs/METRICS.md (Version 2.2.0) and resolves F7.
"""

import math
import pytest
import numpy as np

from engine.metrics import (
    compute_frame_metrics,
    compute_2d_ttc,
    compute_variable_timestep_jerk,
    get_oriented_box_corners,
    sat_polygons_intersect,
    polygon_polygon_clearance,
    compute_bootstrap_confidence_interval,
)
from engine.apath_log.schema import (
    Frame,
    EgoState,
    AgentTrack,
    PlannedPose,
    PlannerOutput,
    CostBreakdown,
    RiskFieldSummary,
)
from backend.app.adapters.pipeline.aggregator import MetricsAggregator


# ---------------------------------------------------------------------------
# Test 1: Hand-Calculated Variable-Timestep Jerk (docs/METRICS.md Section 5.1)
# ---------------------------------------------------------------------------
def test_variable_timestep_jerk_hand_calculation():
    """
    Hand-calculated test case:
    t0 = 0.00s, v0 = 10.00 m/s
    t1 = 0.10s, v1 = 9.80 m/s (dt1 = 0.10s) -> a1 = -2.000 m/s^2
    t2 = 0.25s, v2 = 9.20 m/s (dt2 = 0.15s) -> a2 = -4.000 m/s^2
    Interval denominator: 0.5 * (0.10 + 0.15) = 0.125s
    Unfiltered jerk j2 = (-4.000 - (-2.000)) / 0.125 = -16.000 m/s^3
    """
    times = [0.00, 0.10, 0.25]
    speeds = [10.00, 9.80, 9.20]

    # Without smoothing filter (window=1 for pure numerical differentiation)
    max_j, mean_j, rms_j = compute_variable_timestep_jerk(times, speeds, filter_window=1)
    assert abs(max_j - 16.000) < 1e-3
    assert abs(mean_j - 16.000) < 1e-3
    assert abs(rms_j - 16.000) < 1e-3


# ---------------------------------------------------------------------------
# Test 2: Hand-Calculated 2D TTC Scenarios (docs/METRICS.md Section 5.2)
# ---------------------------------------------------------------------------
def test_2d_ttc_scenario_a_direct_head_on_contact():
    """
    Scenario A (Direct Head-On Closing):
    Ego: p_e = (10.00, 0.00), v_e = (8.00, 0.00), R_e = 2.10m
    Cow: p_o = (25.00, 0.00), v_o = (0.00, 0.00), R_o = 1.10m
    R_eff = 3.20m, r = 15.00m, v_rel = 8.00 m/s
    TTC_2D = (240.0 - 51.20) / 128.0 = 1.475s
    """
    ttc = compute_2d_ttc(
        ego_pos=(10.00, 0.00),
        ego_vel=(8.00, 0.00),
        obs_pos=(25.00, 0.00),
        obs_vel=(0.00, 0.00),
        r_ego=2.10,
        r_obs=1.10,
    )
    assert ttc is not None
    assert abs(ttc - 1.475) < 1e-3


def test_2d_ttc_scenario_b_parallel_diverging():
    """
    Scenario B (Parallel Diverging Vehicles):
    Ego: p_e = (10.00, 0.00), v_e = (4.00, 0.00)
    Lead: p_o = (25.00, 0.00), v_o = (7.00, 0.00)
    v_rel = -3.00 m/s -> r . v_rel = -45.0 < 0 (Diverging)
    TTC must be None.
    """
    ttc = compute_2d_ttc(
        ego_pos=(10.00, 0.00),
        ego_vel=(4.00, 0.00),
        obs_pos=(25.00, 0.00),
        obs_vel=(7.00, 0.00),
        r_ego=2.10,
        r_obs=1.10,
    )
    assert ttc is None


def test_2d_ttc_scenario_c_lateral_pass_miss():
    """
    Scenario C (Lateral Pass with Wide Clearance):
    Ego: p_e = (0.00, 0.00), v_e = (10.00, 0.00)
    Stationary: p_o = (20.00, 4.00), v_o = (0.00, 0.00), R_eff = 2.00m
    d_CPA = 4.00m > R_eff = 2.00m -> D < 0 -> Missing
    TTC must be None.
    """
    ttc = compute_2d_ttc(
        ego_pos=(0.00, 0.00),
        ego_vel=(10.00, 0.00),
        obs_pos=(20.00, 4.00),
        obs_vel=(0.00, 0.00),
        r_ego=1.00,
        r_obs=1.00,
    )
    assert ttc is None


def test_2d_ttc_initial_overlap():
    """If vehicles already physically overlap (C <= 0), TTC is exactly 0.000s."""
    ttc = compute_2d_ttc(
        ego_pos=(10.00, 0.00),
        ego_vel=(5.00, 0.00),
        obs_pos=(11.00, 0.00),
        obs_vel=(0.00, 0.00),
        r_ego=2.10,
        r_obs=1.10,
    )
    assert ttc == 0.000


# ---------------------------------------------------------------------------
# Test 3: Discrete SAT Collision Detection & Clearance
# ---------------------------------------------------------------------------
def test_sat_collision_and_clearance():
    # Two separated boxes: Ego at (0, 0), Obstacle at (10, 0)
    ego_box = get_oriented_box_corners(0.0, 0.0, 0.0, 4.20, 1.80)
    obs_box = get_oriented_box_corners(10.0, 0.0, 0.0, 2.40, 1.10)
    assert not sat_polygons_intersect(ego_box, obs_box)
    clearance = polygon_polygon_clearance(ego_box, obs_box)
    # Expected clearance: 10.0 - 2.10 (front of ego) - 1.20 (rear of obs) = 6.70m
    assert abs(clearance - 6.70) < 1e-3

    # Overlapping boxes: Ego at (0, 0), Obstacle at (2.5, 0)
    obs_overlap = get_oriented_box_corners(2.5, 0.0, 0.0, 2.40, 1.10)
    assert sat_polygons_intersect(ego_box, obs_overlap)
    assert polygon_polygon_clearance(ego_box, obs_overlap) == 0.0


# ---------------------------------------------------------------------------
# Test 4: Goal Completion Predicate
# ---------------------------------------------------------------------------
def test_goal_completion_predicate():
    def make_frame(t, x, y, v, step=0):
        return Frame(
            step=step,
            t=t,
            dt=0.1,
            ego=EgoState(x=x, y=y, yaw=0.0, v=v, steering=0.0, acceleration=0.0, active_state="FOLLOW"),
            agents=[],
            risk_field=RiskFieldSummary(ego_risk=0.1, max_risk=0.1, risk_level="LOW"),
            planner_output=PlannerOutput(
                planned_trajectory=[PlannedPose(x=x + 1.0, y=y, v=v)],
                cost_breakdown=CostBreakdown(progress_cost=0.1, collision_cost=0.0, comfort_cost=0.0, total_cost=0.1),
            ),
        )

    # Reached x >= 65.0, |y| <= 4.7, v >= 0.5, t <= 20.0, collision_free
    frames_success = [make_frame(0.0, 0.0, 0.0, 5.0), make_frame(10.0, 70.0, 0.5, 6.0)]
    metrics_s = compute_frame_metrics(frames_success)
    assert metrics_s.completed_goal is True
    assert metrics_s.collision_occurred is False
    assert metrics_s.failure_tag is None

    # Failed: low terminal speed (v_term < 0.50)
    frames_stopped = [make_frame(0.0, 0.0, 0.0, 5.0), make_frame(10.0, 70.0, 0.5, 0.1)]
    metrics_stopped = compute_frame_metrics(frames_stopped)
    assert metrics_stopped.completed_goal is False

    # Failed: off-road boundary (|y| > 4.70)
    frames_offroad = [make_frame(0.0, 0.0, 0.0, 5.0), make_frame(10.0, 70.0, 5.2, 5.0)]
    metrics_offroad = compute_frame_metrics(frames_offroad)
    assert metrics_offroad.completed_goal is False
    assert metrics_offroad.failure_tag == "PLANNING"


# ---------------------------------------------------------------------------
# Test 5: Metrics Aggregator & Engine Parity Alignment (F7)
# ---------------------------------------------------------------------------
def test_metrics_aggregator_alignment_with_engine():
    """Verifies that backend MetricsAggregator uses the identical authoritative engine implementation."""
    frames = [
        Frame(
            step=i,
            t=round(i * 0.1, 2),
            dt=0.1,
            ego=EgoState(x=i * 2.0, y=0.0, yaw=0.0, v=5.0, steering=0.0, acceleration=0.0, active_state="FOLLOW"),
            agents=[],
            risk_field=RiskFieldSummary(ego_risk=0.1, max_risk=0.1, risk_level="LOW"),
            planner_output=PlannerOutput(
                planned_trajectory=[PlannedPose(x=i * 2.0 + 1.0, y=0.0, v=5.0)],
                cost_breakdown=CostBreakdown(progress_cost=0.1, collision_cost=0.0, comfort_cost=0.0, total_cost=0.1),
            ),
        )
        for i in range(35)
    ]

    engine_metrics = compute_frame_metrics(frames)
    aggregator_metrics = MetricsAggregator.aggregate_from_frames(frames, duration_s=3.4, goal_reached=True)

    assert engine_metrics.model_dump() == aggregator_metrics.model_dump()
    assert aggregator_metrics.completed_goal is True
    assert aggregator_metrics.collision_occurred is False


# ---------------------------------------------------------------------------
# Test 6: Bootstrap Confidence Intervals
# ---------------------------------------------------------------------------
def test_bootstrap_confidence_interval():
    data = [1.2, 1.4, 1.3, 1.5, 1.6, 1.1, 1.3, 1.4, 1.5, 1.3]
    mean_val, lower_ci, upper_ci = compute_bootstrap_confidence_interval(data, n_bootstraps=500)

    assert lower_ci <= mean_val <= upper_ci
    assert abs(mean_val - 1.36) < 0.05
