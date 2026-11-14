"""
Unit Test: Simulink Kinematic Vehicle Parity vs engine/simulation/vehicle.py.
Compares Simulink simulation golden outputs against Python KinematicBicycleModel.
Skips gracefully if golden CSVs are not present, ensuring standalone Python viability.
"""

import math
import os
import csv
import pytest
from pathlib import Path
from engine.simulation.vehicle import KinematicBicycleModel, VehicleParameters

GOLDEN_DIR = Path("tests/golden")

TEST_SPECS = [
    {
        "name": "test1_straight_accel",
        "csv": "test1_straight_accel.csv",
        "x0": 0.0, "y0": 0.0, "yaw0": 0.0, "v0": 0.0, "steer0": 0.0, "accel0": 1.5,
    },
    {
        "name": "test2_constant_steer",
        "csv": "test2_constant_steer.csv",
        "x0": 0.0, "y0": 0.0, "yaw0": 0.0, "v0": 5.0, "steer0": 0.2, "accel0": 0.0,
    },
    {
        "name": "test3_sine_steer",
        "csv": "test3_sine_steer.csv",
        "x0": 0.0, "y0": 0.0, "yaw0": 0.0, "v0": 5.0, "steer0": 0.0, "accel0": 0.0,
    },
    {
        "name": "test4_emergency_braking",
        "csv": "test4_emergency_braking.csv",
        "x0": 0.0, "y0": 0.0, "yaw0": 0.0, "v0": 15.0, "steer0": 0.0, "accel0": -6.5,
    },
    {
        "name": "test5_limit_saturation",
        "csv": "test5_limit_saturation.csv",
        "x0": 0.0, "y0": 0.0, "yaw0": 0.0, "v0": 5.0, "steer0": 0.0, "accel0": 0.0,
    },
]

def wrap_angle_diff(a: float, b: float) -> float:
    """Computes minimal angular difference wrapped to [-pi, pi]."""
    diff = (a - b + math.pi) % (2 * math.pi) - math.pi
    return diff

@pytest.mark.parametrize("spec", TEST_SPECS, ids=[s["name"] for s in TEST_SPECS])
def test_simulink_parity(spec):
    csv_path = GOLDEN_DIR / spec["csv"]
    if not csv_path.exists():
        pytest.skip(f"Golden CSV {csv_path} not found. Run MATLAB test_vehicle_parity.m first.")

    # Read golden Simulink rows
    sim_rows = []
    with open(csv_path, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            sim_rows.append({
                "t": float(row["t"]),
                "accel_cmd": float(row["accel_cmd"]),
                "steer_cmd": float(row["steer_cmd"]),
                "x": float(row["x"]),
                "y": float(row["y"]),
                "yaw": float(row["yaw"]),
                "v": float(row["v"]),
                "actual_steer": float(row["actual_steer"]),
                "actual_accel": float(row["actual_accel"]),
            })

    assert len(sim_rows) > 0, "Golden CSV is empty"
    dt = 0.05
    model = KinematicBicycleModel()

    curr_x = spec["x0"]
    curr_y = spec["y0"]
    curr_yaw = spec["yaw0"]
    curr_v = spec["v0"]
    curr_steer = spec["steer0"]
    curr_accel = spec["accel0"]

    max_dx = 0.0
    max_dy = 0.0
    max_dyaw = 0.0
    max_dv = 0.0

    max_steer_rate = model.params.max_steer_rate_rad_s
    max_jerk = model.params.max_jerk_m_s3

    for step_idx, row in enumerate(sim_rows):
        # 1. State comparison at step k
        dx = abs(curr_x - row["x"])
        dy = abs(curr_y - row["y"])
        dyaw = abs(wrap_angle_diff(curr_yaw, row["yaw"]))
        dv = abs(curr_v - row["v"])

        if dx > max_dx: max_dx = dx
        if dy > max_dy: max_dy = dy
        if dyaw > max_dyaw: max_dyaw = dyaw
        if dv > max_dv: max_dv = dv

        # 2. Rate & Saturation Limiting (matching discrete plant dynamics)
        s_sat = max(-model.params.max_steer_rad, min(model.params.max_steer_rad, row["steer_cmd"]))
        a_sat = max(model.params.max_decel_m_s2, min(model.params.max_accel_m_s2, row["accel_cmd"]))

        actual_steer = max(curr_steer - max_steer_rate * dt, min(curr_steer + max_steer_rate * dt, s_sat))
        actual_accel = max(curr_accel - max_jerk * dt, min(curr_accel + max_jerk * dt, a_sat))

        # Assert limiter outputs match Simulink within 1e-9
        assert abs(actual_steer - row["actual_steer"]) <= 1e-9, f"Steer rate limiter mismatch at step {step_idx}"
        assert abs(actual_accel - row["actual_accel"]) <= 1e-9, f"Jerk limiter mismatch at step {step_idx}"

        # 3. Advance Python model to k+1
        nx, ny, nyaw, nv, _ = model.step(
            curr_x, curr_y, curr_yaw, curr_v, actual_steer, actual_accel, dt
        )
        curr_x, curr_y, curr_yaw, curr_v = nx, ny, nyaw, nv
        curr_steer = actual_steer
        curr_accel = actual_accel

    # Pre-registered Parity Tolerances
    assert max_dx <= 1e-9, f"{spec['name']}: Max |dx| exceeded tolerance: {max_dx:.2e} m > 1e-9 m"
    assert max_dy <= 1e-9, f"{spec['name']}: Max |dy| exceeded tolerance: {max_dy:.2e} m > 1e-9 m"
    assert max_dyaw <= 1e-9, f"{spec['name']}: Max |dyaw| exceeded tolerance: {max_dyaw:.2e} rad > 1e-9 rad"
    assert max_dv <= 1e-9, f"{spec['name']}: Max |dv| exceeded tolerance: {max_dv:.2e} m/s > 1e-9 m/s"

    if spec["name"] == "test4_emergency_braking":
        # Assert speed never drops below 0.0
        speeds = [r["v"] for r in sim_rows]
        assert min(speeds) >= 0.0, "Speed dropped below 0.0 during emergency braking"
        # Find stop time
        zero_speeds = [r["t"] for r in sim_rows if r["v"] == 0.0]
        stop_time = zero_speeds[0] if zero_speeds else None
        assert stop_time is not None and 2.2 <= stop_time <= 2.5, f"Unexpected stop time: {stop_time}"

