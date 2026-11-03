"""
Trajectory Prediction & Uncertainty Quantification Metrics.
Computes minADE, minFDE, Miss Rate, NLL, Empirical Coverage, and Reliability Diagrams.
"""

import math
import numpy as np
from typing import Dict, Any, List, Tuple, Optional


def compute_min_ade(modes: np.ndarray, ground_truth: np.ndarray) -> float:
    """
    Computes minADE_K: average displacement error of the best matching mode.
    modes: (K, H, 2), ground_truth: (H, 2)
    """
    diffs = modes - ground_truth[np.newaxis, :, :] # (K, H, 2)
    l2_per_step = np.linalg.norm(diffs, axis=-1)   # (K, H)
    ade_per_mode = np.mean(l2_per_step, axis=1)    # (K,)
    return float(np.min(ade_per_mode))


def compute_min_fde(modes: np.ndarray, ground_truth: np.ndarray) -> float:
    """
    Computes minFDE_K: final displacement error at the horizon step H.
    modes: (K, H, 2), ground_truth: (H, 2)
    """
    final_diffs = modes[:, -1, :] - ground_truth[-1, :] # (K, 2)
    fde_per_mode = np.linalg.norm(final_diffs, axis=-1)  # (K,)
    return float(np.min(fde_per_mode))


def compute_bivariate_nll(
    modes: np.ndarray,       # (K, H, 2)
    weights: np.ndarray,     # (K,)
    covariances: np.ndarray, # (K, H, 2, 2)
    ground_truth: np.ndarray,# (H, 2)
) -> float:
    """
    Computes Negative Log-Likelihood under the Gaussian Mixture Model across all time steps.
    """
    K, H, _ = modes.shape
    total_nll = 0.0

    for t in range(H):
        y_t = ground_truth[t]
        log_probs = []

        for k in range(K):
            mu_k = modes[k, t]
            cov_k = covariances[k, t] + np.eye(2) * 1e-4

            det = np.linalg.det(cov_k)
            inv_cov = np.linalg.inv(cov_k)
            diff = y_t - mu_k

            mahalanobis = float(diff @ inv_cov @ diff)
            prob_k = (1.0 / (2.0 * math.pi * math.sqrt(max(1e-6, det)))) * math.exp(-0.5 * mahalanobis)
            log_probs.append(weights[k] * prob_k)

        mixture_prob = max(1e-8, sum(log_probs))
        total_nll += -math.log(mixture_prob)

    return float(total_nll / H)


def check_coverage(
    modes: np.ndarray,       # (K, H, 2)
    covariances: np.ndarray, # (K, H, 2, 2)
    ground_truth: np.ndarray,# (H, 2)
    scale_factor: float = 1.0,
) -> bool:
    """
    Checks whether the entire ground truth trajectory lies within the scaled
    uncertainty ellipsoids of the best-fitting mode.
    """
    K, H, _ = modes.shape
    errors = np.linalg.norm(modes - ground_truth[np.newaxis, :, :], axis=-1)
    best_k = int(np.argmin(np.mean(errors, axis=1)))

    for t in range(H):
        diff = ground_truth[t] - modes[best_k, t]
        cov_t = covariances[best_k, t] * (scale_factor ** 2) + np.eye(2) * 1e-4

        var_trace = float(np.trace(cov_t))
        std_radius = math.sqrt(max(1e-4, var_trace / 2.0)) * 2.45 # ~95% confidence chi-square 2-DOF radius

        dist = float(np.linalg.norm(diff))
        if dist > std_radius:
            return False

    return True


def compute_reliability_diagram(
    records: List[Dict[str, Any]],
) -> Dict[str, Any]:
    """
    Generates reliability diagram calibration table across confidence levels.
    """
    nominal_levels = [0.50, 0.60, 0.70, 0.80, 0.90, 0.95, 0.99]
    results = {}

    for level in nominal_levels:
        covered_count = 0
        total = len(records)
        # 2-DOF chi-square quantile multiplier
        chi_multiplier = math.sqrt(-2.0 * math.log(max(1e-6, 1.0 - level)))

        for r in records:
            modes = r["modes"]
            covs = r["covariances"]
            gt = r["ground_truth"]
            H = modes.shape[1]

            errors = np.linalg.norm(modes - gt[np.newaxis, :, :], axis=-1)
            best_k = int(np.argmin(np.mean(errors, axis=1)))

            all_steps_in = True
            for t in range(H):
                diff = gt[t] - modes[best_k, t]
                cov_t = covs[best_k, t] + np.eye(2) * 1e-4
                std_radius = math.sqrt(float(np.trace(cov_t)) / 2.0) * chi_multiplier
                if float(np.linalg.norm(diff)) > std_radius:
                    all_steps_in = False
                    break

            if all_steps_in:
                covered_count += 1

        empirical_cov = covered_count / max(1, total)
        results[str(level)] = {
            "target": level,
            "empirical": round(empirical_cov, 4),
            "calibration_error": round(abs(empirical_cov - level), 4),
        }

    return results


def summarize_metrics(
    eval_records: List[Dict[str, Any]],
) -> Dict[str, Any]:
    """
    Computes aggregated minADE, minFDE, Miss Rate, NLL, and Empirical Coverage.
    """
    if not eval_records:
        return {}

    ades = [r["ade"] for r in eval_records]
    fdes = [r["fde"] for r in eval_records]
    nlls = [r["nll"] for r in eval_records]
    covered = [1 if r.get("covered", False) else 0 for r in eval_records]

    misses = [1 if fde > 2.0 else 0 for fde in fdes]

    return {
        "minADE": round(float(np.mean(ades)), 3),
        "minADE_std": round(float(np.std(ades)), 3),
        "minFDE": round(float(np.mean(fdes)), 3),
        "minFDE_std": round(float(np.std(fdes)), 3),
        "miss_rate_pct": round(float(np.mean(misses) * 100.0), 2),
        "mean_NLL": round(float(np.mean(nlls)), 3),
        "empirical_coverage_pct": round(float(np.mean(covered) * 100.0), 2),
        "count": len(eval_records),
    }
