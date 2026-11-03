"""
Track A: Kinematic Motion Models and Class-Specific Process Noise for Indian Road Agents.
Implements Constant Velocity (CV) and Constant Turn Rate & Acceleration (CTRA) rollouts.
"""

import math
import numpy as np
from typing import Dict, Any, Tuple, List


# Class-specific kinematic parameters and process noise covariances
# State vector: [x, y, v, yaw, yaw_rate, a]
CLASS_PROCESS_NOISE: Dict[str, Dict[str, float]] = {
    "auto_rickshaw": {
        "sigma_a": 1.2,        # m/s^2 longitudinal acceleration noise
        "sigma_yaw_rate": 0.25,# rad/s yaw rate noise
        "lateral_drift": 0.15, # m/s lateral Brownian diffusion
        "max_speed": 12.0,
        "max_accel": 2.5,
        "max_yaw_rate": 0.6,
    },
    "two_wheeler": {
        "sigma_a": 1.8,
        "sigma_yaw_rate": 0.40,
        "lateral_drift": 0.25, # High agility / weaving
        "max_speed": 16.0,
        "max_accel": 3.5,
        "max_yaw_rate": 0.8,
    },
    "pedestrian": {
        "sigma_a": 0.8,
        "sigma_yaw_rate": 0.60,
        "lateral_drift": 0.35, # High omnidirectional intent uncertainty
        "max_speed": 2.5,
        "max_accel": 1.5,
        "max_yaw_rate": 1.2,
    },
    "cattle": {
        "sigma_a": 0.6,
        "sigma_yaw_rate": 0.50,
        "lateral_drift": 0.40, # Erratic stopping and sudden crossing
        "max_speed": 2.0,
        "max_accel": 1.0,
        "max_yaw_rate": 0.9,
    },
    "truck": {
        "sigma_a": 0.6,
        "sigma_yaw_rate": 0.10,
        "lateral_drift": 0.05, # High inertia, smooth path
        "max_speed": 14.0,
        "max_accel": 1.5,
        "max_yaw_rate": 0.25,
    },
    "handcart": {
        "sigma_a": 0.3,
        "sigma_yaw_rate": 0.15,
        "lateral_drift": 0.10,
        "max_speed": 1.8,
        "max_accel": 0.5,
        "max_yaw_rate": 0.3,
    },
}


def ctra_step(
    x: float,
    y: float,
    v: float,
    yaw: float,
    yaw_rate: float,
    a: float,
    dt: float = 0.2,
) -> Tuple[float, float, float, float, float, float]:
    """
    Single integration step for Constant Turn Rate and Acceleration (CTRA) model.
    """
    v_next = max(0.0, v + a * dt)
    yaw_next = yaw + yaw_rate * dt

    if abs(yaw_rate) > 1e-4:
        # Exact non-linear integration for constant turn rate
        dx = (v_next * math.sin(yaw_next) - v * math.sin(yaw)) / yaw_rate + \
             (a * (math.cos(yaw_next) - math.cos(yaw))) / (yaw_rate ** 2)
        dy = (-v_next * math.cos(yaw_next) + v * math.cos(yaw)) / yaw_rate + \
             (a * (math.sin(yaw_next) - math.sin(yaw))) / (yaw_rate ** 2)
    else:
        # Taylor approximation for near-zero turn rate (CV/CA)
        v_avg = 0.5 * (v + v_next)
        dx = v_avg * math.cos(yaw) * dt
        dy = v_avg * math.sin(yaw) * dt

    x_next = x + dx
    y_next = y + dy

    return x_next, y_next, v_next, yaw_next, yaw_rate, a


def propagate_covariance(
    cov_xy: np.ndarray,
    v: float,
    yaw: float,
    step_idx: int,
    dt: float,
    noise_params: Dict[str, float],
) -> np.ndarray:
    """
    Propagates 2x2 position covariance over time step taking into account
    longitudinal speed uncertainty and lateral drift diffusion.
    """
    sigma_a = noise_params.get("sigma_a", 1.0)
    sigma_lat = noise_params.get("lateral_drift", 0.2)

    # Uncertainty in body frame
    # Longitudinal uncertainty grows with acceleration noise: ~ 0.5 * sigma_a * t^2
    t = (step_idx + 1) * dt
    var_lon = (0.2 + 0.5 * sigma_a * (dt ** 1.5)) ** 2 * (1.0 + 0.3 * t)
    var_lat = (0.15 + sigma_lat * math.sqrt(dt)) ** 2 * (1.0 + 0.4 * t)

    # Rotation matrix to align with agent heading
    c = math.cos(yaw)
    s = math.sin(yaw)
    R = np.array([[c, -s], [s, c]])

    Q_body = np.diag([var_lon, var_lat])
    Q_global = R @ Q_body @ R.T

    # Accumulated covariance
    next_cov = cov_xy + Q_global * dt
    return next_cov
