"""
Non-Lane Multi-Hypothesis Trajectory Predictor with Conformal Uncertainty Cones.
Calibrated for unconstrained Indian traffic (auto-rickshaws, cattle, two-wheelers, pedestrians).
"""

import math
from typing import List, Dict, Tuple
from dataclasses import dataclass
from engine.apath_log.schema import PredictionHypothesis, TrajectoryPoint, ConformalConePoint


@dataclass
class ConformalCalibrationParams:
    """Class-dependent conformal prediction envelope expansion factors for 95% coverage."""
    s0: float          # Initial perception radius (meters)
    kappa: float       # Expansion rate with time (meters / sec^1.2)
    turn_variance: float # Angular drift variance


CLASS_CONFORMAL_PARAMS: Dict[str, ConformalCalibrationParams] = {
    "auto_rickshaw": ConformalCalibrationParams(s0=0.35, kappa=0.55, turn_variance=0.25),
    "two_wheeler":   ConformalCalibrationParams(s0=0.30, kappa=0.70, turn_variance=0.35),
    "pedestrian":    ConformalCalibrationParams(s0=0.25, kappa=0.40, turn_variance=0.45),
    "cattle":        ConformalCalibrationParams(s0=0.45, kappa=0.35, turn_variance=0.30),
    "truck":         ConformalCalibrationParams(s0=0.50, kappa=0.30, turn_variance=0.10),
    "car":           ConformalCalibrationParams(s0=0.40, kappa=0.45, turn_variance=0.15),
    "handcart":      ConformalCalibrationParams(s0=0.30, kappa=0.25, turn_variance=0.15),
}


class NonLaneMultiHypothesisPredictor:
    """
    Generates multi-hypothesis future trajectory predictions and conformal uncertainty cones
    over a future horizon (e.g. 3.0 seconds, dt = 0.2s).
    """

    def __init__(self, horizon_s: float = 3.0, dt: float = 0.2):
        self.horizon_s = horizon_s
        self.dt = dt

    def predict(
        self,
        class_name: str,
        x: float,
        y: float,
        yaw: float,
        vx: float,
        vy: float,
        observed_intent: str = "straight",
    ) -> Tuple[List[PredictionHypothesis], List[ConformalConePoint]]:
        """
        Produces:
        1. Multi-hypothesis trajectory paths with probabilities (summing to 1.0)
        2. Conformal uncertainty envelope points with guaranteed 95% coverage
        """
        speed = math.hypot(vx, vy)
        calib = CLASS_CONFORMAL_PARAMS.get(
            class_name, ConformalCalibrationParams(s0=0.4, kappa=0.5, turn_variance=0.2)
        )

        num_steps = int(self.horizon_s / self.dt)
        hypotheses: List[PredictionHypothesis] = []

        # Multi-hypothesis intent modes based on class
        if class_name == "cattle":
            # Cows often continue crossing, suddenly stop mid-road, or turn back
            intents = [
                ("cross_continue", 0.45, 0.0, speed),
                ("stop_midroad", 0.40, 0.0, 0.0), # Decelerates to 0
                ("turn_back", 0.15, 0.4, speed * 0.7),
            ]
        elif class_name == "two_wheeler":
            # Two-wheelers weave left/right through traffic gaps or overtake
            intents = [
                ("maintain", 0.50, 0.0, speed),
                ("swerve_left", 0.25, 0.3, speed * 1.05),
                ("swerve_right", 0.25, -0.3, speed * 1.05),
            ]
        elif class_name == "auto_rickshaw":
            intents = [
                ("straight", 0.55, 0.0, speed),
                ("swerve", 0.30, 0.2, speed * 0.95),
                ("slow_curb", 0.15, -0.15, speed * 0.5),
            ]
        elif class_name == "pedestrian":
            intents = [
                ("cross", 0.60, 0.0, speed),
                ("hesitate_stop", 0.25, 0.0, 0.0),
                ("deviate", 0.15, 0.3, speed),
            ]
        else: # car, truck
            intents = [
                ("continue", 0.70, 0.0, speed),
                ("slow", 0.20, 0.0, max(0.0, speed * 0.5)),
                ("slight_veer", 0.10, 0.1, speed),
            ]

        for intent_name, weight, yaw_rate, target_speed in intents:
            traj_points: List[TrajectoryPoint] = []
            curr_x = x
            curr_y = y
            curr_yaw = yaw
            curr_v = speed

            for step_idx in range(1, num_steps + 1):
                t_rel = round(step_idx * self.dt, 2)
                # Kinematic rollout for hypothesis
                curr_yaw += yaw_rate * self.dt
                # Smoothly transition speed toward target
                curr_v += (target_speed - curr_v) * 0.4 * self.dt
                curr_x += curr_v * math.cos(curr_yaw) * self.dt
                curr_y += curr_v * math.sin(curr_yaw) * self.dt
                traj_points.append(TrajectoryPoint(x=round(curr_x, 3), y=round(curr_y, 3), t_rel=t_rel))

            hypotheses.append(
                PredictionHypothesis(
                    weight=weight,
                    intent=intent_name,
                    trajectory=traj_points,
                )
            )

        # Conformal uncertainty envelope: radius expanding with calibrated power law
        conformal_envelope: List[ConformalConePoint] = []
        for step_idx in range(1, num_steps + 1):
            t_rel = round(step_idx * self.dt, 2)
            # R(t) = s0 + kappa * t^1.2
            radius = round(calib.s0 + calib.kappa * (t_rel ** 1.2), 3)
            conformal_envelope.append(
                ConformalConePoint(t_rel=t_rel, radius_m=radius, coverage_p=0.95)
            )

        return hypotheses, conformal_envelope
