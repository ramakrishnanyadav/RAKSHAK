"""
Track A Physics Baseline Predictor.
Outputs K=6 multi-modal future trajectories with mode weights
and per-step covariance matrices using class-specific kinematic models.
"""

import math
import numpy as np
from typing import Dict, Any, List, Optional
from dataclasses import dataclass
from .motion_models import CLASS_PROCESS_NOISE, ctra_step, propagate_covariance


@dataclass
class PredictionOutput:
    modes: np.ndarray       # Shape (K, H, 2)
    weights: np.ndarray     # Shape (K,)
    covariances: np.ndarray # Shape (K, H, 2, 2)
    intent_names: List[str]


class PhysicsBaselinePredictor:
    """
    Zero-training, rule-and-physics-based multi-modal trajectory predictor.
    Uses class-specific kinematic limits and intent branching.
    """

    def __init__(self, horizon_steps: int = 15, dt: float = 0.2):
        self.H = horizon_steps
        self.dt = dt
        self.intent_labels = [
            "continue",
            "stop",
            "cross_left",
            "cross_right",
            "swerve_left",
            "swerve_right",
        ]
        self.K = len(self.intent_labels)

    def _estimate_state_at_t0(
        self,
        history_xyv: List[List[float]],
    ) -> Dict[str, float]:
        """
        Estimates x0, y0, v0, yaw0, yaw_rate0, a0 from 10-step history.
        history_xyv is list of [x, y, vx, vy, yaw] or [x, y].
        """
        if not history_xyv:
            return {"x": 0.0, "y": 0.0, "v": 0.0, "yaw": 0.0, "yaw_rate": 0.0, "a": 0.0}

        latest = history_xyv[-1]
        x0 = float(latest[0])
        y0 = float(latest[1])

        if len(history_xyv) >= 2:
            prev = history_xyv[-2]
            dx = x0 - float(prev[0])
            dy = y0 - float(prev[1])
            v0 = math.hypot(dx, dy) / self.dt
            yaw0 = math.atan2(dy, dx) if v0 > 0.05 else 0.0
        else:
            v0 = 0.0
            yaw0 = 0.0

        # Acceleration estimate over last 3 steps if available
        if len(history_xyv) >= 4:
            p3 = history_xyv[-3]
            v_prev = math.hypot(float(history_xyv[-2][0]) - float(p3[0]), float(history_xyv[-2][1]) - float(p3[1])) / self.dt
            a0 = (v0 - v_prev) / self.dt
            # Clamp acceleration estimate to reasonable physical limits
            a0 = max(-4.0, min(3.0, a0))
        else:
            a0 = 0.0

        # Yaw rate estimate
        if len(history_xyv) >= 3:
            p2 = history_xyv[-2]
            p3 = history_xyv[-3]
            yaw_prev = math.atan2(float(p2[1]) - float(p3[1]), float(p2[0]) - float(p3[0]))
            dyaw = (yaw0 - yaw_prev)
            # Wrap to [-pi, pi]
            dyaw = (dyaw + math.pi) % (2 * math.pi) - math.pi
            yaw_rate0 = dyaw / self.dt
            yaw_rate0 = max(-1.0, min(1.0, yaw_rate0))
        else:
            yaw_rate0 = 0.0

        return {"x": x0, "y": y0, "v": v0, "yaw": yaw0, "yaw_rate": yaw_rate0, "a": a0}

    def _get_class_mode_weights(self, class_name: str, v0: float) -> np.ndarray:
        """
        Assigns intent mixture weights based on agent class and initial speed.
        """
        # Order: [continue, stop, cross_left, cross_right, swerve_left, swerve_right]
        if class_name == "cattle":
            # Erratic stopping and sudden crossing
            w = np.array([0.25, 0.35, 0.15, 0.15, 0.05, 0.05])
        elif class_name == "pedestrian":
            # Crossing or halting
            w = np.array([0.20, 0.25, 0.25, 0.25, 0.025, 0.025])
        elif class_name == "two_wheeler":
            # High swerve and overtake agility
            w = np.array([0.40, 0.10, 0.10, 0.10, 0.15, 0.15])
        elif class_name == "auto_rickshaw":
            # Frequent stopping near curb, quick swerves
            w = np.array([0.45, 0.20, 0.10, 0.10, 0.075, 0.075])
        elif class_name == "truck":
            # High momentum, mostly continues
            w = np.array([0.70, 0.15, 0.05, 0.05, 0.025, 0.025])
        elif class_name == "handcart":
            # Slow, straight, occasional stop
            w = np.array([0.60, 0.30, 0.04, 0.04, 0.01, 0.01])
        else:
            w = np.array([0.50, 0.15, 0.10, 0.10, 0.075, 0.075])

        # If already almost stationary, elevate stop / continue
        if v0 < 0.2:
            w[1] += 0.3
            w[0] += 0.1
            w[2:] *= 0.5

        return w / np.sum(w)

    def predict(
        self,
        history_xyv: List[List[float]],
        class_name: str,
        corridor_bounds: Optional[List[float]] = None,
    ) -> PredictionOutput:
        """
        Generates K=6 predicted futures, weights, and covariances.
        """
        state = self._estimate_state_at_t0(history_xyv)
        x0, y0, v0, yaw0 = state["x"], state["y"], state["v"], state["yaw"]
        yaw_rate0, a0 = state["yaw_rate"], state["a"]

        noise_params = CLASS_PROCESS_NOISE.get(class_name, CLASS_PROCESS_NOISE["auto_rickshaw"])
        weights = self._get_class_mode_weights(class_name, v0)

        modes = np.zeros((self.K, self.H, 2), dtype=np.float32)
        covariances = np.zeros((self.K, self.H, 2, 2), dtype=np.float32)

        # Build trajectory for each intent
        for k_idx, intent in enumerate(self.intent_labels):
            xk, yk, vk, yawk = x0, y0, v0, yaw0
            cov_k = np.diag([0.04, 0.04]) # Initial tracking uncertainty (20cm std)

            # Intent specific control inputs
            if intent == "continue":
                a_k = 0.5 * a0 # damped acceleration
                yr_k = 0.3 * yaw_rate0
            elif intent == "stop":
                a_k = -max(1.5, vk / (self.H * self.dt * 0.6))
                yr_k = 0.0
            elif intent == "cross_left":
                a_k = -0.2
                yr_k = 0.25 if class_name not in ["truck", "handcart"] else 0.10
            elif intent == "cross_right":
                a_k = -0.2
                yr_k = -0.25 if class_name not in ["truck", "handcart"] else -0.10
            elif intent == "swerve_left":
                a_k = 0.0
                yr_k = 0.50 if class_name == "two_wheeler" else 0.35
            elif intent == "swerve_right":
                a_k = 0.0
                yr_k = -0.50 if class_name == "two_wheeler" else -0.35
            else:
                a_k = 0.0
                yr_k = 0.0

            # Step through horizon
            for step in range(self.H):
                # Dampen turn rate after 1.5 seconds if swerving
                if "swerve" in intent and step > int(self.H * 0.5):
                    yr_k *= 0.5

                xk, yk, vk, yawk, yr_k, a_k = ctra_step(
                    xk, yk, vk, yawk, yr_k, a_k, dt=self.dt
                )
                modes[k_idx, step, 0] = xk
                modes[k_idx, step, 1] = yk

                # Covariance accumulation
                cov_k = propagate_covariance(
                    cov_k, vk, yawk, step, self.dt, noise_params
                )
                covariances[k_idx, step] = cov_k

        return PredictionOutput(
            modes=modes,
            weights=weights,
            covariances=covariances,
            intent_names=self.intent_labels,
        )
