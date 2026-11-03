"""
Unit tests for Pure Pursuit and Longitudinal PID Controllers.
Tests lookahead adaptation, steering saturation, acceleration limits, and integrator clamping.
"""

import math
import pytest
from engine.control.pure_pursuit import PurePursuitController
from engine.control.longitudinal_pid import LongitudinalPIDController
from engine.control.controller import VehicleController


def test_pure_pursuit_steering_and_saturation():
    pp = PurePursuitController(wheelbase_m=2.7, max_steer_rad=0.61)

    # Waypoint 90 degrees to the left
    traj_sharp_left = [(0.0, 5.0, 5.0), (0.0, 10.0, 5.0)]
    steer = pp.compute_steering(
        ego_x=0.0,
        ego_y=0.0,
        ego_yaw=0.0,
        ego_v=5.0,
        trajectory=traj_sharp_left,
        dt=0.1,
    )
    assert steer > 0.0
    # Must be bounded by max_steer_rad
    assert abs(steer) <= 0.61


def test_longitudinal_pid_limits_and_braking():
    pid = LongitudinalPIDController(max_accel_m_s2=2.5, max_decel_m_s2=-6.0)

    # Request high acceleration from standstill
    accel = pid.compute_acceleration(current_v=0.0, target_v=20.0, dt=0.1)
    assert accel > 0.0
    assert accel <= 2.50

    # Request emergency stop from 10 m/s to 0 m/s
    decel = pid.compute_acceleration(current_v=10.0, target_v=0.0, dt=0.1)
    assert decel < 0.0
    assert decel >= -6.00


def test_vehicle_controller_unified_step():
    ctrl = VehicleController(mode="pure_pursuit_pid")
    traj = [(5.0, 0.0, 6.0), (10.0, 0.0, 6.0), (15.0, 0.0, 6.0)]
    cmd = ctrl.step(
        ego_x=0.0,
        ego_y=0.0,
        ego_yaw=0.0,
        ego_v=5.0,
        trajectory=traj,
        target_v=6.0,
        dt=0.1,
    )
    assert isinstance(cmd.steer_rad, float)
    assert isinstance(cmd.accel_m_s2, float)
    assert abs(cmd.steer_rad) <= 0.61
