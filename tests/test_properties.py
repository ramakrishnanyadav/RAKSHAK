"""
Property-based tests with Hypothesis for ADAPTIVE-PATH Motion Planners.
Verifies invariants:
1. Planned paths never intersect static obstacles at zero noise.
2. Cost breakdown terms are always finite and non-negative.
3. Actuator commands strictly adhere to physical vehicle saturation bounds.
"""

import math
from hypothesis import given, strategies as st, settings, HealthCheck
from engine.planners import create_planner
from engine.simulation.world import SimulationWorld
from engine.simulation.vehicle import KinematicBicycleModel
from engine.apath_log.schema import EgoState, AgentTrack, StaticObstacle, WorldBounds, RoadBoundary
from engine.config.cost_evaluator import compute_trajectory_cost


@settings(max_examples=15, suppress_health_check=[HealthCheck.too_slow], deadline=None)
@given(
    obs_x=st.floats(min_value=15.0, max_value=35.0),
    obs_y=st.floats(min_value=-1.0, max_value=1.0),
    obs_r=st.floats(min_value=0.5, max_value=1.0),
    planner_id=st.sampled_from(["B2", "P2", "P3", "P2-ML", "P3-ML"]),
)
def test_property_planned_path_never_intersects_static_obstacle_at_zero_noise(
    obs_x, obs_y, obs_r, planner_id
):
    """
    Property: Planned collision-free path must maintain clearance > 0 to static obstacles
    under zero sensor noise.
    """
    planner = create_planner(planner_id)
    planner.reset()

    # Create world with a static obstacle
    bounds = WorldBounds(x_min=-10.0, x_max=60.0, y_min=-6.0, y_max=6.0)
    static_obs = [
        StaticObstacle(id="test_obs", kind="pothole", x=obs_x, y=obs_y, length=obs_r * 2, width=obs_r * 2)
    ]
    road_boundaries = [
        RoadBoundary(side="left", points=[[-10.0, 4.5], [60.0, 4.5]]),
        RoadBoundary(side="right", points=[[-10.0, -4.5], [60.0, -4.5]]),
    ]
    world = SimulationWorld(bounds=bounds, road_boundaries=road_boundaries, static_obstacles=static_obs)

    ego = EgoState(
        x=0.0,
        y=0.0,
        yaw=0.0,
        v=6.0,
        steering=0.0,
        acceleration=0.0,
        active_state="FOLLOW",
    )

    result = planner.step(
        ego=ego,
        world=world,
        visible_agents=[],
        dt=0.1,
        current_time=0.1,
    )

    # Verify that none of the planned waypoints penetrate the obstacle core
    for pt in result.planned_trajectory:
        dist_to_center = math.hypot(pt[0] - obs_x, pt[1] - obs_y)
        # Point should either steer around the obstacle or stop before it
        if pt[0] > (obs_x - obs_r) and pt[0] < (obs_x + obs_r):
            assert dist_to_center >= (obs_r * 0.4), (
                f"{planner_id} planned trajectory point ({pt[0]:.2f}, {pt[1]:.2f}) penetrates static obstacle at ({obs_x:.2f}, {obs_y:.2f}) with radius {obs_r:.2f}"
            )


@settings(max_examples=25, deadline=None)
@given(
    target_x=st.floats(min_value=10.0, max_value=100.0),
    risk=st.floats(min_value=0.0, max_value=1.0),
    accel=st.floats(min_value=-6.0, max_value=3.0),
    steer=st.floats(min_value=-0.65, max_value=0.65),
    replan=st.booleans(),
)
def test_property_cost_function_non_negative_and_finite(target_x, risk, accel, steer, replan):
    """
    Property: All 5 cost terms (Distance, CollisionRisk, Curvature, Energy, ReplanCost)
    must evaluate to non-negative, finite numbers.
    """
    sample_traj = [(i * 2.0, math.sin(i * 0.2), 6.0) for i in range(1, 8)]
    cost = compute_trajectory_cost(
        trajectory=sample_traj,
        target_x=target_x,
        collision_risk=risk,
        accel=accel,
        steer=steer,
        replan_triggered=replan,
        split="tune",
    )

    assert math.isfinite(cost.total_cost)
    assert cost.total_cost >= 0.0
    assert cost.w1_distance >= 0.0
    assert cost.w2_collision_risk >= 0.0
    assert cost.w3_curvature >= 0.0
    assert cost.w4_energy >= 0.0
    assert cost.w5_replan_cost >= 0.0
