"""
Tests for all 6 Planners: B0, B1, B2, P1, P2, P3.
"""

import pytest
from engine.planners import create_planner
from engine.scenarios.registry import build_scenario
from engine.simulation.world import SimulationWorld
from engine.apath_log.schema import EgoState, AgentTrack


@pytest.mark.parametrize("planner_id", ["B0", "B1", "B2", "P1", "P2", "P3", "P2-ML", "P3-ML"])
def test_all_planners_step(planner_id):
    planner = create_planner(planner_id)
    world, ego, _ = build_scenario("SCENARIO_5_CATTLE_CROSSING", seed=1000, split="tune")

    # Step simulation world once
    world.step(0.1)
    visible_agents = [
        AgentTrack(
            id=ag.id,
            class_name=ag.class_name,
            x=ag.x,
            y=ag.y,
            yaw=ag.yaw,
            v_x=ag.v_x,
            v_y=ag.v_y,
            length=ag.profile.length,
            width=ag.profile.width,
        )
        for ag in world.dynamic_agents
    ]

    res = planner.step(
        ego=ego,
        world=world,
        visible_agents=visible_agents,
        dt=0.1,
        current_time=0.1,
    )

    assert isinstance(res.steer, float)
    assert isinstance(res.accel, float)
    assert res.active_state in ["FOLLOW", "SLOW", "YIELD", "STOP", "BYPASS", "EMERGENCY_BRAKE"]
    assert len(res.planned_trajectory) > 0
    assert res.decision_trace != ""
