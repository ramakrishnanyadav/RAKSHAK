"""
Non-Lane Multi-Hypothesis Trajectory Predictor with Conformal Uncertainty Envelopes.
Calibrated for unconstrained Indian traffic (auto-rickshaws, cattle, two-wheelers, pedestrians).

Integrates Split-Conformal Prediction Calibrator with anisotropic Mahalanobis nonconformity
scores, episode-level maximum aggregation, and inference-time feature parity.
Pre-registered in docs/SAP.md (Section 9) and docs/RISK_DEFINITION.md (Section 2).
"""

import math
import os
from typing import List, Dict, Tuple, Optional
from dataclasses import dataclass
from engine.apath_log.schema import PredictionHypothesis, TrajectoryPoint, ConformalConePoint
from engine.prediction.conformal_calibrator import (
    SplitConformalPredictionCalibrator,
    PREDICTOR_VERSION,
    DEFAULT_FALLBACK_RADIUS_M,
)
from engine.simulation.obstacles import AGENT_PROFILES


@dataclass
class ConformalCalibrationParams:
    """Historical legacy analytical calibration parameters (retained for backward compatibility)."""
    s0: float            # Initial perception radius (meters)
    kappa: float         # Expansion rate with time (meters / sec^1.2)
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
    Generates multi-hypothesis future trajectory predictions and conformal uncertainty envelopes
    over a future horizon (e.g. 2.8s or 3.0s, dt = 0.2s).
    """

    VERSION: str = PREDICTOR_VERSION

    def __init__(
        self,
        horizon_s: float = 2.8,
        dt: float = 0.2,
        calibrator: Optional[SplitConformalPredictionCalibrator] = None,
        calibration_path: Optional[str] = None,
        mode: str = "simultaneous",
    ):
        self.horizon_s = horizon_s
        self.dt = dt
        self.mode = mode
        self.calibrator = calibrator

        if self.calibrator is None and calibration_path and os.path.exists(calibration_path):
            self.calibrator = SplitConformalPredictionCalibrator.load_from_json(calibration_path)

    def set_calibrator(self, calibrator: SplitConformalPredictionCalibrator) -> None:
        """Sets or replaces the active split-conformal calibrator."""
        self.calibrator = calibrator

    def predict(
        self,
        class_name: str,
        x: float,
        y: float,
        yaw: float,
        vx: float,
        vy: float,
        observed_intent: str = "straight",
        length: Optional[float] = None,
        width: Optional[float] = None,
    ) -> Tuple[List[PredictionHypothesis], List[ConformalConePoint]]:
        """
        Produces:
        1. Multi-hypothesis trajectory paths with probabilities (summing to 1.0)
        2. Conformal uncertainty envelope points with statistical coverage guarantee (if calibrated)
           or explicit uncalibrated fallback (if uncalibrated).
        
        Strict Invariant:
        Inference uses ONLY features observable at prediction time t0 (speed, length, width).
        """
        speed = math.hypot(vx, vy)
        
        # Resolve static dimensions from input or agent profile
        if length is None or width is None:
            profile = AGENT_PROFILES.get(class_name)
            if profile:
                length = profile.length if length is None else length
                width = profile.width if width is None else width
            else:
                length = 4.2 if length is None else length
                width = 1.8 if width is None else width

        num_steps = int(round(self.horizon_s / self.dt))
        hypotheses: List[PredictionHypothesis] = []

        # Multi-hypothesis intent modes based on class
        if class_name == "cattle":
            intents = [
                ("cross_continue", 0.45, 0.0, speed),
                ("stop_midroad", 0.40, 0.0, 0.0), # Decelerates to 0
                ("turn_back", 0.15, 0.4, speed * 0.7),
            ]
        elif class_name == "two_wheeler":
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
        else: # car, truck, handcart
            intents = [
                ("continue", 0.70, 0.0, speed),
                ("slow", 0.20, 0.0, max(0.0, speed * 0.5)),
                ("slight_veer", 0.10, 0.1, speed),
            ]

        horizon_times: List[float] = []
        for step_idx in range(1, num_steps + 1):
            horizon_times.append(round(step_idx * self.dt, 2))

        for intent_name, weight, yaw_rate, target_speed in intents:
            traj_points: List[TrajectoryPoint] = []
            curr_x = x
            curr_y = y
            curr_yaw = yaw
            curr_v = speed

            for t_rel in horizon_times:
                curr_yaw += yaw_rate * self.dt
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

        # Conformal uncertainty envelope construction
        if self.calibrator is not None and self.calibrator.coverage_guarantee_valid.get(class_name, False):
            # Calibrated envelope with statistical guarantee
            conformal_envelope = self.calibrator.get_envelope(
                class_name=class_name,
                v0=speed,
                length=length,
                horizon_times=horizon_times,
                mode=self.mode,
            )
        else:
            # Uncalibrated fallback: marked as coverage_guarantee_valid=False
            # Preserves 3.50m fallback strictly as an uncalibrated heuristic
            conformal_envelope = []
            for t_rel in horizon_times:
                conformal_envelope.append(
                    ConformalConePoint(
                        t_rel=t_rel,
                        radius_m=DEFAULT_FALLBACK_RADIUS_M,
                        coverage_p=0.95,
                        semi_axis_x=DEFAULT_FALLBACK_RADIUS_M,
                        semi_axis_y=DEFAULT_FALLBACK_RADIUS_M,
                        coverage_guarantee_valid=False,
                    )
                )

        return hypotheses, conformal_envelope
