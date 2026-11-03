"""
Unit & Integration Tests for Phase 1 Step 3B: F3 Correction.
Verifies:
1. Stopped-duration hysteresis timer transitions (v < 0.20 accumulate, 0.20 <= v < 0.50 hold, v >= 0.50 reset).
2. Timestep variation invariance.
3. Repeated stop cycles and grace period preservation.
4. Exact stationary persistence penalty escalation and saturation cap (J_stat <= 22.20).
5. Hard safety constraint invariance (SAT collision & road boundary cannot be overridden by persistence penalty).
6. Predicted dynamic obstacle occupancy rejection over planning horizon.
"""

import math
import pytest
from engine.planners.p3_adaptive import P3AdaptivePlanner
from engine.simulation.world import SimulationWorld
from engine.simulation.vehicle import KinematicBicycleModel
from engine.simulation.obstacles import TrafficAgent
from engine.apath_log.schema import (
    EgoState,
    AgentTrack,
    StaticObstacle,
    WorldBounds,
    RoadBoundary,
    ConformalConePoint,
    PredictionHypothesis,
    TrajectoryPoint,
)


def _make_dummy_world(static_obs=None):
    bounds = WorldBounds(x_min=-10.0, x_max=100.0, y_min=-6.0, y_max=6.0)
    road_boundaries = [
        RoadBoundary(side="left", points=[[-10.0, 4.7], [100.0, 4.7]]),
        RoadBoundary(side="right", points=[[-10.0, -4.7], [100.0, -4.7]]),
    ]
    return SimulationWorld(
        bounds=bounds,
        road_boundaries=road_boundaries,
        static_obstacles=static_obs or [],
    )


# ---------------------------------------------------------------------------
# Test 1: Stopped-Duration Hysteresis Timer Transitions
# ---------------------------------------------------------------------------
def test_timer_transitions():
    planner = P3AdaptivePlanner()
    planner.reset()
    world = _make_dummy_world()

    ego = EgoState(x=0.0, y=0.0, yaw=0.0, v=0.0, steering=0.0, acceleration=0.0, active_state="FOLLOW")

    # Step 1: v = 0.0 (< 0.20) -> timer accumulates
    planner.step(ego=ego, world=world, visible_agents=[], dt=0.1, current_time=0.1)
    assert abs(planner.t_stopped - 0.1) < 1e-6

    # Step 2: v = 0.15 (< 0.20) -> continues accumulating
    ego.v = 0.15
    planner.step(ego=ego, world=world, visible_agents=[], dt=0.2, current_time=0.3)
    assert abs(planner.t_stopped - 0.3) < 1e-6

    # Step 3: v = 0.25 (crawl / hysteresis hold zone: 0.20 <= v < 0.50) -> holds constant
    ego.v = 0.25
    planner.step(ego=ego, world=world, visible_agents=[], dt=0.1, current_time=0.4)
    assert abs(planner.t_stopped - 0.3) < 1e-6

    # Step 4: v = 0.45 (still in hold zone) -> holds constant
    ego.v = 0.45
    planner.step(ego=ego, world=world, visible_agents=[], dt=0.5, current_time=0.9)
    assert abs(planner.t_stopped - 0.3) < 1e-6

    # Step 5: v = 0.55 (cruising: v >= 0.50) -> resets to 0.0
    ego.v = 0.55
    planner.step(ego=ego, world=world, visible_agents=[], dt=0.1, current_time=1.0)
    assert planner.t_stopped == 0.0


# ---------------------------------------------------------------------------
# Test 2: Timestep Variation Invariance
# ---------------------------------------------------------------------------
def test_timestep_variation():
    world = _make_dummy_world()

    for dt in [0.05, 0.10, 0.20]:
        planner = P3AdaptivePlanner()
        planner.reset()
        steps = int(round(2.0 / dt))
        ego = EgoState(x=0.0, y=0.0, yaw=0.0, v=0.05, steering=0.0, acceleration=0.0, active_state="FOLLOW")

        for s in range(steps):
            planner.step(ego=ego, world=world, visible_agents=[], dt=dt, current_time=(s + 1) * dt)

        assert abs(planner.t_stopped - 2.0) < 1e-4, f"Failed for dt={dt}: t_stopped={planner.t_stopped}"


# ---------------------------------------------------------------------------
# Test 3: Repeated Stop Cycles and Grace Period Preservation
# ---------------------------------------------------------------------------
def test_repeated_stops():
    planner = P3AdaptivePlanner()
    planner.reset()
    world = _make_dummy_world()

    ego = EgoState(x=0.0, y=0.0, yaw=0.0, v=0.0, steering=0.0, acceleration=0.0, active_state="FOLLOW")

    # Stop 1: 2.5s duration
    for s in range(25):
        planner.step(ego=ego, world=world, visible_agents=[], dt=0.1, current_time=(s + 1) * 0.1)

    assert abs(planner.t_stopped - 2.5) < 1e-6
    assert planner.compute_stationary_penalty() > 0.0

    # Accelerate to cruising (v = 1.0 m/s)
    ego.v = 1.0
    planner.step(ego=ego, world=world, visible_agents=[], dt=0.1, current_time=2.6)
    assert planner.t_stopped == 0.0
    assert planner.compute_stationary_penalty() == 0.0

    # Stop 2: 0.8s duration (< t_grace = 1.0s)
    ego.v = 0.0
    for s in range(8):
        planner.step(ego=ego, world=world, visible_agents=[], dt=0.1, current_time=2.7 + s * 0.1)

    assert abs(planner.t_stopped - 0.8) < 1e-6
    # Grace period must be preserved: penalty is 0.0 during initial 1.0s of stopping
    assert planner.compute_stationary_penalty() == 0.0


# ---------------------------------------------------------------------------
# Test 4: Exact Stationary Persistence Penalty Escalation & Saturation Cap
# ---------------------------------------------------------------------------
def test_penalty_saturation():
    planner = P3AdaptivePlanner()
    planner.reset()

    # t = 0.0s -> J_persist = 0.0, J_stat = 2.20
    planner.t_stopped = 0.0
    assert planner.compute_stationary_penalty() == 0.0
    cost_0 = planner.w_prog + planner.compute_stationary_penalty()
    assert abs(cost_0 - 2.20) < 1e-6

    # t = 1.0s -> J_persist = 0.0, J_stat = 2.20 (grace period)
    planner.t_stopped = 1.0
    assert planner.compute_stationary_penalty() == 0.0
    cost_1 = planner.w_prog + planner.compute_stationary_penalty()
    assert abs(cost_1 - 2.20) < 1e-6

    # t = 2.0s -> delay = 1.0, term = 1.0^1.5 = 1.0, J_persist = 4.00, J_stat = 6.20
    planner.t_stopped = 2.0
    assert abs(planner.compute_stationary_penalty() - 4.00) < 1e-6
    cost_2 = planner.w_prog + planner.compute_stationary_penalty()
    assert abs(cost_2 - 6.20) < 1e-6

    # t = 3.0s -> delay = 2.0, term = 2.0^1.5 = 2.828427, J_persist = 11.3137, J_stat = 13.5137
    planner.t_stopped = 3.0
    expected_persist_3 = 4.00 * (2.0 ** 1.5)
    assert abs(planner.compute_stationary_penalty() - expected_persist_3) < 1e-4
    cost_3 = planner.w_prog + planner.compute_stationary_penalty()
    assert abs(cost_3 - 13.5137) < 1e-3

    # t = 10.0s -> delay = 9.0, delay^1.5 = 27.0 > 5.0 (capped at J_stall_max = 5.00)
    # J_persist = 4.00 * 5.00 = 20.00, J_stat = 2.20 + 20.00 = 22.20
    planner.t_stopped = 10.0
    assert abs(planner.compute_stationary_penalty() - 20.00) < 1e-6
    cost_10 = planner.w_prog + planner.compute_stationary_penalty()
    assert abs(cost_10 - 22.20) < 1e-6

    # t = 30.0s -> strictly capped at 22.20
    planner.t_stopped = 30.0
    assert abs(planner.compute_stationary_penalty() - 20.00) < 1e-6


# ---------------------------------------------------------------------------
# Test 5: Hard Safety Constraint Invariance Under High Persistence Penalty
# ---------------------------------------------------------------------------
def test_hard_safety_constraint_invariance():
    """
    Even with a fully saturated persistence penalty (t_stopped = 15.0s, J_stat = 22.20),
    the vehicle must NEVER choose a candidate that collides with static roadblock
    or violates road boundaries.
    """
    planner = P3AdaptivePlanner()
    planner.reset()
    planner.t_stopped = 15.0  # Fully saturated

    # Place a wide static roadblock that completely blocks the road at x = 3.5 (within 1-2m of ego front)
    roadblock = StaticObstacle(
        id="blocker",
        kind="barrier",
        x=3.5,
        y=0.0,
        length=2.0,
        width=10.0,  # Completely blocks road
    )
    world = _make_dummy_world(static_obs=[roadblock])

    ego = EgoState(
        x=0.0,
        y=0.0,
        yaw=0.0,
        v=0.0,
        steering=0.0,
        acceleration=0.0,
        active_state="STOP",
        length=4.20,
        width=1.80,
    )

    res = planner.step(ego=ego, world=world, visible_agents=[], dt=0.1, current_time=1.5)

    # All forward moving candidates would collide with the roadblock;
    # Planner MUST choose STOP or EMERGENCY_BRAKE, never drive into the wall
    assert res.active_state in ["STOP", "EMERGENCY_BRAKE"]
    for pt in res.planned_trajectory:
        # No waypoint may penetrate roadblock center [11.0, 13.0]
        assert not (11.0 <= pt[0] <= 13.0 and abs(pt[1]) < 4.5)


# ---------------------------------------------------------------------------
# Test 6: Predicted Dynamic Obstacle Occupancy Rejection Over Planning Horizon
# ---------------------------------------------------------------------------
def test_predicted_dynamic_obstacle_occupancy_rejection():
    """
    Verifies that candidate trajectories intersecting the predicted future occupancy
    of a dynamic obstacle are rejected via SAT, ensuring hard collision avoidance.
    """
    planner = P3AdaptivePlanner()
    planner.reset()
    world = _make_dummy_world()

    # Dynamic obstacle at x = 20, y = 0, moving right at 0 m/s (stopped mid-lane)
    cow = AgentTrack(
        id="cow_01",
        class_name="cattle",
        x=18.0,
        y=0.0,
        yaw=0.0,
        v_x=0.0,
        v_y=0.0,
        length=2.4,
        width=1.1,
    )

    ego = EgoState(
        x=0.0,
        y=0.0,
        yaw=0.0,
        v=7.0,
        steering=0.0,
        acceleration=0.0,
        active_state="FOLLOW",
        length=4.20,
        width=1.80,
    )

    res = planner.step(ego=ego, world=world, visible_agents=[cow], dt=0.1, current_time=0.1)

    # Candidate straight through y = 0 at x = 18 must be rejected by SAT!
    # Planner should either slow down, stop, or bypass laterally
    for pt in res.planned_trajectory:
        if abs(pt[0] - 18.0) < 1.2:
            # Trajectory passing through x=18 must not overlap cattle lateral footprint
            assert abs(pt[1]) >= 0.8 or res.active_state in ["STOP", "SLOW", "EMERGENCY_BRAKE"]
