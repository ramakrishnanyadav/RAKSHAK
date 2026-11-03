"""
Split Conformal Prediction for Multi-Modal Trajectory Uncertainty Quantification.
Provides finite-sample statistical coverage guarantees (e.g. 95% target coverage)
without making Gaussian or distributional assumptions.
"""

import math
import numpy as np
from typing import Dict, Any, List, Tuple, Optional


class SplitConformalCalibrator:
    """
    Computes non-conformity scores and calibrated scaling factors (quantiles)
    on the held-out calibration split (calib).
    """

    def __init__(self, target_coverage: float = 0.95):
        self.target_coverage = target_coverage
        self.alpha = 1.0 - target_coverage
        self.global_quantile: float = 1.0
        self.class_quantiles: Dict[str, float] = {}
        self.scenario_quantiles: Dict[str, float] = {}

    @staticmethod
    def compute_nonconformity_score(
        modes: np.ndarray,       # (K, H, 2)
        covariances: np.ndarray, # (K, H, 2, 2)
        ground_truth: np.ndarray,# (H, 2)
    ) -> float:
        """
        Calculates maximum normalized spatial discrepancy between ground truth
        and the best-matching predicted trajectory mode over the horizon.
        """
        K, H, _ = modes.shape

        # Step 1: Find best matching mode (min ADE)
        errors = np.linalg.norm(modes - ground_truth[np.newaxis, :, :], axis=-1) # (K, H)
        ade_per_mode = np.mean(errors, axis=1) # (K,)
        best_k = int(np.argmin(ade_per_mode))

        # Step 2: Compute max normalized residual across horizon steps
        max_score = 0.0
        for t in range(H):
            dx = ground_truth[t, 0] - modes[best_k, t, 0]
            dy = ground_truth[t, 1] - modes[best_k, t, 1]
            diff = np.array([dx, dy])

            cov_t = covariances[best_k, t]
            # Regularized Mahalanobis / variance scaling
            var_trace = float(np.trace(cov_t))
            std_t = math.sqrt(max(1e-4, var_trace / 2.0))

            dist = float(np.linalg.norm(diff))
            normalized_error = dist / std_t
            if normalized_error > max_score:
                max_score = normalized_error

        return max_score

    def calibrate(
        self,
        calibration_results: List[Dict[str, Any]],
    ) -> Dict[str, Any]:
        """
        Calibrates quantiles using split conformal prediction on calibration set.
        calibration_results contains:
            [{'score': float, 'class_name': str, 'scenario': str}, ...]
        """
        N = len(calibration_results)
        if N == 0:
            return {"global_quantile": 1.0}

        all_scores = [r["score"] for r in calibration_results]

        # Conformal quantile calculation with finite-sample correction
        # q = ceil((N + 1) * (1 - alpha)) / N
        q_idx = int(math.ceil((N + 1) * (1.0 - self.alpha))) - 1
        q_idx = max(0, min(N - 1, q_idx))
        sorted_scores = sorted(all_scores)
        self.global_quantile = float(sorted_scores[q_idx])

        # Per-class calibration
        by_class: Dict[str, List[float]] = {}
        for r in calibration_results:
            c = r["class_name"]
            by_class.setdefault(c, []).append(r["score"])

        self.class_quantiles = {}
        for c, scores in by_class.items():
            Nc = len(scores)
            if Nc >= 5:
                qc_idx = int(math.ceil((Nc + 1) * (1.0 - self.alpha))) - 1
                qc_idx = max(0, min(Nc - 1, qc_idx))
                self.class_quantiles[c] = float(sorted(scores)[qc_idx])
            else:
                self.class_quantiles[c] = self.global_quantile

        # Per-scenario calibration
        by_sc: Dict[str, List[float]] = {}
        for r in calibration_results:
            sc = r.get("scenario", "default")
            by_sc.setdefault(sc, []).append(r["score"])

        self.scenario_quantiles = {}
        for sc, scores in by_sc.items():
            Nsc = len(scores)
            if Nsc >= 5:
                qsc_idx = int(math.ceil((Nsc + 1) * (1.0 - self.alpha))) - 1
                qsc_idx = max(0, min(Nsc - 1, qsc_idx))
                self.scenario_quantiles[sc] = float(sorted(scores)[qsc_idx])
            else:
                self.scenario_quantiles[sc] = self.global_quantile

        return {
            "target_coverage": self.target_coverage,
            "global_quantile": round(self.global_quantile, 4),
            "class_quantiles": {k: round(v, 4) for k, v in self.class_quantiles.items()},
            "scenario_quantiles": {k: round(v, 4) for k, v in self.scenario_quantiles.items()},
            "num_calibration_samples": N,
        }

    def scale_covariances(
        self,
        covariances: np.ndarray,
        class_name: Optional[str] = None,
    ) -> np.ndarray:
        """
        Scales covariance matrices by the conformal quantile squared.
        """
        q = self.class_quantiles.get(class_name, self.global_quantile) if class_name else self.global_quantile
        return covariances * (q ** 2)
