"""
Unit tests for Behaviour State Machine:
FOLLOW, SLOW, YIELD, STOP, BYPASS, EMERGENCY_BRAKE, and Minimal-Risk Manoeuvre (MRM).
"""

import pytest
from engine.behaviour.state_machine import BehaviourStateMachine
from engine.apath_log.schema import EgoState, AgentTrack, ConformalConePoint


def make_ego(v=7.0, x=0.0, y=0.0):
    return EgoState(x=x, y=y, yaw=0.0, v=v, steering=0.0, acceleration=0.0, active_state="FOLLOW")


def test_behaviour_nominal_follow():
    sm = BehaviourStateMachine(nominal_speed_m_s=8.0)
    ego = make_ego(v=8.0)
    decision = sm.step(ego=ego, agents=[], static_obstacles=[], current_risk=0.10, dt=0.1)
    assert decision.active_state == "FOLLOW"
    assert decision.target_speed_m_s == 8.0
    assert decision.lateral_bias_m == 0.0


def test_behaviour_slow_on_elevated_risk():
    sm = BehaviourStateMachine(nominal_speed_m_s=8.0)
    ego = make_ego(v=8.0)
    # High risk ahead
    decision = sm.step(ego=ego, agents=[], static_obstacles=[], current_risk=0.45, dt=0.1)
    assert decision.active_state == "SLOW"
    assert decision.target_speed_m_s < 8.0
    assert decision.replan_requested


def test_behaviour_yield_to_oncoming_threat():
    sm = BehaviourStateMachine(nominal_speed_m_s=8.0)
    ego = make_ego(v=6.0)

    # Oncoming heavy truck heading opposite with negative vx
    oncoming_truck = AgentTrack(
        id="truck_1",
        class_name="truck",
        x=20.0,
        y=0.4,
        yaw=3.14,
        v_x=-5.0,
        v_y=0.0,
        length=8.0,
        width=2.5,
    )
    decision = sm.step(ego=ego, agents=[oncoming_truck], static_obstacles=[], current_risk=0.5, dt=0.1)
    assert decision.active_state == "YIELD"
    assert decision.lateral_bias_m < 0.0  # Steer toward shoulder to yield


def test_behaviour_bypass_stationary_obstacle():
    sm = BehaviourStateMachine(nominal_speed_m_s=8.0)
    ego = make_ego(v=4.0)

    # Stationary cow blocking center lane at x=10.0
    cow = AgentTrack(
        id="cow_1",
        class_name="cattle",
        x=10.0,
        y=0.0,
        yaw=0.0,
        v_x=0.0,
        v_y=0.0,
        length=2.2,
        width=1.0,
    )
    decision = sm.step(ego=ego, agents=[cow], static_obstacles=[], current_risk=0.5, dt=0.1)
    assert decision.active_state in ["BYPASS", "SLOW"]
    if decision.active_state == "BYPASS":
        assert abs(decision.lateral_bias_m) > 0.5


def test_behaviour_emergency_brake_and_conservative_mrm():
    sm = BehaviourStateMachine(uncertainty_mrm_threshold=2.6)
    ego = make_ego(v=6.0)

    # Agent with huge epistemic prediction uncertainty >= 2.8m
    uncertain_agent = AgentTrack(
        id="vru_1",
        class_name="two_wheeler",
        x=15.0,
        y=0.5,
        yaw=0.0,
        v_x=4.0,
        v_y=0.0,
        length=2.0,
        width=0.8,
        conformal_envelope=[ConformalConePoint(t_rel=1.0, radius_m=2.9, coverage_p=0.95)],
    )

    decision = sm.step(ego=ego, agents=[uncertain_agent], static_obstacles=[], current_risk=0.3, dt=0.1)
    assert decision.active_state == "EMERGENCY_BRAKE"
    assert decision.trigger_reason == "UNCERTAINTY_EXCEEDED_MRM"
    assert decision.target_speed_m_s == 0.0
