"""
Spatiotemporal Risk Engine & False-Safe Rate (FSR) Evaluator.
Computes risk fields using Time-to-Collision (TTC), relative closing velocity,
separation distance, vulnerability weights, and calibrated uncertainty covariances.
"""

import math
import numpy as np
from typing import Dict, Any, List, Tuple, Optional


CLASS_VULNERABILITY: Dict[str, float] = {
    "pedestrian": 2.2,
    "cattle": 2.0,
    "two_wheeler": 1.6,
    "handcart": 1.5,
    "auto_rickshaw": 1.3,
    "truck": 1.0,
}


class SpatiotemporalRiskEngine:
    """
    Evaluates dynamic risk field across predicted future horizons.
    """

    def __init__(self, risk_threshold: float = 1.0):
        self.risk_threshold = risk_threshold

    def compute_agent_risk_field(
        self,
        ego_future: np.ndarray,       # (H, 2)
        pred_modes: np.ndarray,       # (K, H, 2)
        pred_weights: np.ndarray,     # (K,)
        pred_covariances: np.ndarray, # (K, H, 2, 2)
        class_name: str,
        dt: float = 0.2,
    ) -> Dict[str, Any]:
        """
        Evaluates risk score across all future time steps.
        """
        K, H, _ = pred_modes.shape
        vuln = CLASS_VULNERABILITY.get(class_name, 1.2)

        risk_profile = np.zeros(H, dtype=np.float32)
        min_distance = float("inf")
        min_ttc = float("inf")

        for t in range(H):
            ego_pt = ego_future[t]
            t_sec = (t + 1) * dt
            step_risk = 0.0

            for k in range(K):
                mode_pt = pred_modes[k, t]
                w_k = pred_weights[k]

                # Distance
                dist = float(np.linalg.norm(ego_pt - mode_pt))
                if dist < min_distance:
                    min_distance = dist

                # Relative velocity estimation
                if t > 0:
                    prev_dist = float(np.linalg.norm(ego_future[t - 1] - pred_modes[k, t - 1]))
                    v_close = (prev_dist - dist) / dt
                else:
                    v_close = 0.0

                # Time to collision (TTC)
                if v_close > 0.5:
                    ttc = max(0.05, dist / v_close)
                    if ttc < min_ttc:
                        min_ttc = ttc
                    ttc_term = math.exp(-ttc / 1.5)
                else:
                    ttc_term = 0.0

                # Distance risk term
                dist_term = math.exp(-dist / 2.2)

                # Uncertainty contribution: trace of covariance
                cov_t = pred_covariances[k, t]
                uncertainty_radius = math.sqrt(max(1e-4, float(np.trace(cov_t)) / 2.0))
                unc_term = 0.25 * (uncertainty_radius / (1.0 + dist))

                # Mode-weighted risk
                mode_risk = vuln * (ttc_term + dist_term + unc_term)
                step_risk += w_k * mode_risk

            risk_profile[t] = step_risk

        peak_risk = float(np.max(risk_profile))
        is_high_risk = peak_risk >= self.risk_threshold

        return {
            "peak_risk": round(peak_risk, 3),
            "risk_profile": [round(float(r), 3) for r in risk_profile],
            "min_distance": round(min_distance, 3),
            "min_ttc": round(min_ttc, 3) if min_ttc < 100 else None,
            "is_high_risk": is_high_risk,
        }

    def evaluate_false_safe_rate(
        self,
        eval_cases: List[Dict[str, Any]],
    ) -> Dict[str, Any]:
        """
        Computes False-Safe Rate on labelled high-risk test cases.
        eval_cases: [
            {
                'ego_future': np.ndarray,
                'pred_modes': np.ndarray,
                'pred_weights': np.ndarray,
                'pred_covariances': np.ndarray,
                'class_name': str,
                'is_gt_high_risk': bool, # True if genuine conflict occurred
            }, ...
        ]
        """
        true_high_risk_count = 0
        false_safe_count = 0 # GT was high-risk, but model predicted safe (FN)
        true_positive_count = 0
        false_alarm_count = 0
        true_safe_count = 0

        for case in eval_cases:
            res = self.compute_agent_risk_field(
                ego_future=case["ego_future"],
                pred_modes=case["pred_modes"],
                pred_weights=case["pred_weights"],
                pred_covariances=case["pred_covariances"],
                class_name=case["class_name"],
            )

            is_predicted_risk = res["is_high_risk"]
            is_gt_risk = case["is_gt_high_risk"]

            if is_gt_risk:
                true_high_risk_count += 1
                if not is_predicted_risk:
                    false_safe_count += 1
                else:
                    true_positive_count += 1
            else:
                if is_predicted_risk:
                    false_alarm_count += 1
                else:
                    true_safe_count += 1

        fsr = (false_safe_count / max(1, true_high_risk_count)) if true_high_risk_count > 0 else 0.0

        return {
            "total_cases": len(eval_cases),
            "ground_truth_high_risk": true_high_risk_count,
            "false_safe_count": false_safe_count,
            "true_positive_count": true_positive_count,
            "false_alarm_count": false_alarm_count,
            "true_safe_count": true_safe_count,
            "false_safe_rate": round(fsr, 4),
            "false_safe_pct": round(fsr * 100.0, 2),
            "recall_pct": round((1.0 - fsr) * 100.0, 2),
        }
