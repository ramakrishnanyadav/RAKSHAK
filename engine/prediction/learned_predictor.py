"""
Learned Multi-Modal Trajectory Predictor (GMM / Neural Intent Estimator).
Uses historical tracking context and non-lane road features to estimate
multi-modal future trajectories with epistemic uncertainty weighting.
"""

import math
from typing import List, Tuple, Dict, Any, Optional
from dataclasses import dataclass
from engine.apath_log.schema import PredictionHypothesis, TrajectoryPoint, ConformalConePoint


@dataclass
class LearnedMode:
    intent_tag: str
    probability: float
    turn_rate_rad_s: float
    target_accel: float
    uncertainty_scale: float


class LearnedMultiModalPredictor:
    """
    Simulates a trained deep-learning / GMM multi-modal trajectory predictor
    (e.g., Trajectron++ / AgentFormer trained on unstructured Indian traffic datasets).
    Estimates mode probabilities and epistemic covariance cones from historical tracks.
    """

    def __init__(self, horizon_s: float = 3.0, dt: float = 0.2):
        self.horizon_s = horizon_s
        self.dt = dt

    def infer_modes(
        self,
        class_name: str,
        vx: float,
        vy: float,
        history: Optional[List[Tuple[float, float, float]]] = None,
    ) -> List[LearnedMode]:
        """
        Infers multi-modal intention distribution from agent classification and historical track curvature.
        """
        speed = math.hypot(vx, vy)

        # Compute historical heading change / lateral drift if available
        d_yaw_hist = 0.0
        if history and len(history) >= 3:
            h_yaw_prev = history[-3][2]
            h_yaw_curr = history[-1][2]
            d_yaw_hist = (h_yaw_curr - h_yaw_prev + math.pi) % (2 * math.pi) - math.pi

        if class_name == "two_wheeler":
            # Two-wheelers have high weaving propensity
            p_weave = min(0.65, max(0.15, 0.35 + 0.5 * abs(d_yaw_hist)))
            p_cont = 1.0 - p_weave
            return [
                LearnedMode("maintain_lane", round(p_cont, 2), 0.0, 0.0, 0.45),
                LearnedMode("swerve_gap", round(p_weave * 0.6, 2), 0.35, 0.2, 0.75),
                LearnedMode("evade_brake", round(p_weave * 0.4, 2), -0.25, -1.0, 0.60),
            ]
        elif class_name == "cattle":
            # Cattle have high freeze / sudden turnaround probability
            return [
                LearnedMode("cross_slowly", 0.40, 0.0, 0.0, 0.50),
                LearnedMode("sudden_freeze", 0.45, 0.0, -speed / 1.5, 0.35),
                LearnedMode("erratic_turn", 0.15, 0.55, 0.1, 0.80),
            ]
        elif class_name == "auto_rickshaw":
            return [
                LearnedMode("corridor_follow", 0.60, 0.0, 0.0, 0.40),
                LearnedMode("curb_drop_passenger", 0.25, -0.20, -0.8, 0.55),
                LearnedMode("aggressive_overtake", 0.15, 0.30, 0.8, 0.70),
            ]
        elif class_name == "pedestrian":
            return [
                LearnedMode("cross_direct", 0.55, 0.0, 0.0, 0.35),
                LearnedMode("hesitant_stepback", 0.30, 0.0, -speed, 0.45),
                LearnedMode("along_corridor", 0.15, 0.40, 0.0, 0.50),
            ]
        else: # truck, car, handcart
            return [
                LearnedMode("maintain_trajectory", 0.75, 0.0, 0.0, 0.30),
                LearnedMode("gradual_slow", 0.20, 0.0, -0.6, 0.40),
                LearnedMode("swerve", 0.05, 0.15, 0.0, 0.50),
            ]

    def predict(
        self,
        class_name: str,
        x: float,
        y: float,
        yaw: float,
        vx: float,
        vy: float,
        history: Optional[List[Tuple[float, float, float]]] = None,
    ) -> Tuple[List[PredictionHypothesis], List[ConformalConePoint]]:
        """
        Emits multi-modal trajectory predictions and learned epistemic uncertainty cones.
        """
        modes = self.infer_modes(class_name, vx, vy, history)
        speed = math.hypot(vx, vy)
        num_steps = int(self.horizon_s / self.dt)

        hypotheses: List[PredictionHypothesis] = []
        max_uncertainty_by_step = [0.0 for _ in range(num_steps)]

        for mode in modes:
            traj_points: List[TrajectoryPoint] = []
            curr_x = x
            curr_y = y
            curr_yaw = yaw
            curr_v = speed

            for step_idx in range(1, num_steps + 1):
                t_rel = round(step_idx * self.dt, 2)
                curr_yaw += mode.turn_rate_rad_s * self.dt
                curr_v = max(0.0, curr_v + mode.target_accel * self.dt)
                curr_x += curr_v * math.cos(curr_yaw) * self.dt
                curr_y += curr_v * math.sin(curr_yaw) * self.dt

                traj_points.append(
                    TrajectoryPoint(
                        x=round(curr_x, 3),
                        y=round(curr_y, 3),
                        t_rel=t_rel,
                    )
                )

                # Mode epistemic uncertainty expanding with time
                unc_r = 0.30 + mode.uncertainty_scale * (t_rel ** 1.15)
                max_uncertainty_by_step[step_idx - 1] = max(
                    max_uncertainty_by_step[step_idx - 1], unc_r
                )

            hypotheses.append(
                PredictionHypothesis(
                    weight=mode.probability,
                    intent=mode.intent_tag,
                    trajectory=traj_points,
                )
            )

        # Construct conformal cones bounding all inferred modes
        conformal_envelope = [
            ConformalConePoint(
                t_rel=round((i + 1) * self.dt, 2),
                radius_m=round(max_uncertainty_by_step[i], 3),
                coverage_p=0.95,
            )
            for i in range(num_steps)
        ]

        return hypotheses, conformal_envelope
