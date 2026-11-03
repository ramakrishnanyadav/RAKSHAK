"""
Comprehensive Benchmarking, 4-Way Ablation, and Statistical Decision Rule Engine.
Ablations:
  1. Track A (Physics Baseline)
  2. Track B (Learned GRU Predictor)
  3. Track A + Split Conformal Calibration
  4. Track B + Split Conformal Calibration
Evaluates minADE_6, minFDE_6, Miss Rate, NLL, Empirical Coverage, False-Safe Rate (FSR),
and executes the 95% Confidence Interval Decision Rule for P2-ML / P3-ML entry.
"""

import math
import time
import numpy as np
import torch
from typing import Dict, Any, List, Tuple, Optional

from .data.generator import generate_benchmark_dataset, TrajectorySequence, CLASS_NAMES
from .track_a_physics.physics_predictor import PhysicsBaselinePredictor
from .track_b_learned.model import TrajectoryGRUEncoderDecoder
from .track_b_learned.trainer import sequences_to_tensors
from .calibration.conformal import SplitConformalCalibrator
from .calibration.metrics import (
    compute_min_ade,
    compute_min_fde,
    compute_bivariate_nll,
    check_coverage,
    compute_reliability_diagram,
    summarize_metrics,
)
from .risk.risk_engine import SpatiotemporalRiskEngine


def compute_bootstrap_ci(
    values: List[float],
    n_boot: int = 1000,
    ci_level: float = 0.95,
    seed: int = 1000,
) -> Tuple[float, float, float]:
    """
    Computes mean and 95% bootstrap confidence interval [ci_low, ci_high].
    """
    if not values:
        return 0.0, 0.0, 0.0

    arr = np.array(values)
    rng = np.random.RandomState(seed)
    boot_means = []
    n = len(arr)

    for _ in range(n_boot):
        sample = rng.choice(arr, size=n, replace=True)
        boot_means.append(float(np.mean(sample)))

    alpha = 1.0 - ci_level
    low = float(np.percentile(boot_means, 100.0 * (alpha / 2.0)))
    high = float(np.percentile(boot_means, 100.0 * (1.0 - alpha / 2.0)))
    mean_val = float(np.mean(arr))

    return round(mean_val, 4), round(low, 4), round(high, 4)


class BenchmarkSuite:
    """
    Runs end-to-end evaluation across all 4 ablations on the validation dataset.
    """

    def __init__(
        self,
        learned_model_path: Optional[str] = "engine/ml/models/best_learned_predictor.pt",
        dt: float = 0.2,
        horizon_steps: int = 15,
    ):
        self.dt = dt
        self.H = horizon_steps

        # Track A
        self.physics_predictor = PhysicsBaselinePredictor(horizon_steps=horizon_steps, dt=dt)

        # Track B
        self.learned_model = TrajectoryGRUEncoderDecoder(hist_len=10, fut_len=horizon_steps)
        if learned_model_path and torch.cuda.is_available():
            pass
        if learned_model_path:
            import os
            if os.path.exists(learned_model_path):
                ckpt = torch.load(learned_model_path, map_location="cpu")
                st = ckpt["model_state_dict"] if "model_state_dict" in ckpt else ckpt
                self.learned_model.load_state_dict(st)
        self.learned_model.eval()

        self.risk_engine = SpatiotemporalRiskEngine(risk_threshold=1.0)

    def calibrate_conformal(self) -> Tuple[SplitConformalCalibrator, SplitConformalCalibrator]:
        """
        Calibrates Track A and Track B on the dedicated calibration split (calib).
        """
        calib_seqs = generate_benchmark_dataset(split="calib")

        calibrator_a = SplitConformalCalibrator(target_coverage=0.95)
        calibrator_b = SplitConformalCalibrator(target_coverage=0.95)

        records_a = []
        records_b = []

        # Convert for batch Track B
        b_hist, b_cls, b_near, b_corr, _ = sequences_to_tensors(calib_seqs)
        with torch.no_grad():
            b_futs, b_w, b_covs = self.learned_model(b_hist, b_cls, b_near, b_corr)

        b_futs_np = b_futs.numpy()
        b_covs_np = b_covs.numpy() # (N, K, H, 3)

        for i, seq in enumerate(calib_seqs):
            gt = np.array(seq.future_xy, dtype=np.float32)

            # Track A
            out_a = self.physics_predictor.predict(seq.history_xyv, seq.class_name)
            score_a = SplitConformalCalibrator.compute_nonconformity_score(out_a.modes, out_a.covariances, gt)
            records_a.append({"score": score_a, "class_name": seq.class_name, "scenario": seq.scenario_family})

            # Track B
            # Reconstruct (K, H, 2, 2) covariance
            cov_2d = np.zeros((6, self.H, 2, 2), dtype=np.float32)
            for k in range(6):
                for t in range(self.H):
                    sx, sy, rho = b_covs_np[i, k, t]
                    cov_2d[k, t] = np.array([[sx**2, rho*sx*sy], [rho*sx*sy, sy**2]])

            score_b = SplitConformalCalibrator.compute_nonconformity_score(b_futs_np[i], cov_2d, gt)
            records_b.append({"score": score_b, "class_name": seq.class_name, "scenario": seq.scenario_family})

        calibrator_a.calibrate(records_a)
        calibrator_b.calibrate(records_b)

        return calibrator_a, calibrator_b

    def benchmark_latency_60_agents(self, iterations: int = 50) -> Dict[str, Any]:
        """
        Strict latency measurement for 60 simultaneous agents batched on CPU.
        Constraint: under 20 ms per cycle.
        """
        dummy_seqs = generate_benchmark_dataset(split="val", count=60)
        t_hist, t_cls, t_near, t_corr, _ = sequences_to_tensors(dummy_seqs)

        times_learned = []
        times_physics = []

        # Warm up
        with torch.no_grad():
            _ = self.learned_model(t_hist, t_cls, t_near, t_corr)

        for _ in range(iterations):
            # Track B batched forward
            t0 = time.perf_counter()
            with torch.no_grad():
                _ = self.learned_model(t_hist, t_cls, t_near, t_corr)
            t_learned = (time.perf_counter() - t0) * 1000.0
            times_learned.append(t_learned)

            # Track A individual rollouts for 60 agents
            t1 = time.perf_counter()
            for s in dummy_seqs:
                _ = self.physics_predictor.predict(s.history_xyv, s.class_name)
            t_phys = (time.perf_counter() - t1) * 1000.0
            times_physics.append(t_phys)

        mean_b = float(np.mean(times_learned))
        p95_b = float(np.percentile(times_learned, 95))
        max_b = float(np.max(times_learned))

        mean_a = float(np.mean(times_physics))
        p95_a = float(np.percentile(times_physics, 95))

        passed = p95_b < 100.0

        return {
            "num_agents": 60,
            "iterations": iterations,
            "track_b_latency_ms": {
                "mean": round(mean_b, 2),
                "p95": round(p95_b, 2),
                "max": round(max_b, 2),
                "constraint_met_budget": passed,
                "constraint_met_under_20ms": p95_b < 20.0,
            },
            "track_a_latency_ms": {
                "mean": round(mean_a, 2),
                "p95": round(p95_a, 2),
            },
        }

    def run_full_evaluation(self) -> Dict[str, Any]:
        """
        Evaluates all 4 ablations on the validation split (val).
        Computes 95% bootstrap confidence intervals and checks the Decision Rule.
        """
        val_seqs = generate_benchmark_dataset(split="val")
        calib_a, calib_b = self.calibrate_conformal()

        # Batch Track B predictions
        v_hist, v_cls, v_near, v_corr, _ = sequences_to_tensors(val_seqs)
        with torch.no_grad():
            b_futs, b_weights, b_cov_params = self.learned_model(v_hist, v_cls, v_near, v_corr)

        b_futs_np = b_futs.numpy()
        b_weights_np = b_weights.numpy()
        b_cov_params_np = b_cov_params.numpy()

        results_track_a = []
        results_track_b = []
        results_track_a_calib = []
        results_track_b_calib = []

        # Risk test cases for False-Safe Rate
        risk_cases_a = []
        risk_cases_b = []
        risk_cases_a_calib = []
        risk_cases_b_calib = []

        for i, seq in enumerate(val_seqs):
            gt = np.array(seq.future_xy, dtype=np.float32)
            c_name = seq.class_name
            sc_name = seq.scenario_family

            # Synthetic ego trajectory: nominal forward vehicle proceeding along lane
            ego_path = np.zeros((self.H, 2), dtype=np.float32)
            for t in range(self.H):
                ego_path[t] = [1.5 + (t + 1) * 0.2 * 4.0, 0.0]

            # Ground truth conflict check
            min_gt_dist = float(np.min(np.linalg.norm(ego_path - gt, axis=1)))
            is_gt_high_risk = min_gt_dist < 2.2 # Genuine near-miss / conflict

            # --- 1. Track A Baseline ---
            out_a = self.physics_predictor.predict(seq.history_xyv, c_name)
            ade_a = compute_min_ade(out_a.modes, gt)
            fde_a = compute_min_fde(out_a.modes, gt)
            nll_a = compute_bivariate_nll(out_a.modes, out_a.weights, out_a.covariances, gt)
            cov_a = check_coverage(out_a.modes, out_a.covariances, gt, scale_factor=1.0)

            rec_a = {"ade": ade_a, "fde": fde_a, "nll": nll_a, "covered": cov_a, "class": c_name, "scenario": sc_name}
            results_track_a.append(rec_a)
            risk_cases_a.append({
                "ego_future": ego_path, "pred_modes": out_a.modes, "pred_weights": out_a.weights,
                "pred_covariances": out_a.covariances, "class_name": c_name, "is_gt_high_risk": is_gt_high_risk,
            })

            # --- 2. Track A + Calibration ---
            qa = calib_a.class_quantiles.get(c_name, calib_a.global_quantile)
            cov_scaled_a = out_a.covariances * (qa ** 2)
            cov_a_cal = check_coverage(out_a.modes, out_a.covariances, gt, scale_factor=qa)
            nll_a_cal = compute_bivariate_nll(out_a.modes, out_a.weights, cov_scaled_a, gt)

            rec_a_cal = {"ade": ade_a, "fde": fde_a, "nll": nll_a_cal, "covered": cov_a_cal, "class": c_name, "scenario": sc_name}
            results_track_a_calib.append(rec_a_cal)
            risk_cases_a_calib.append({
                "ego_future": ego_path, "pred_modes": out_a.modes, "pred_weights": out_a.weights,
                "pred_covariances": cov_scaled_a, "class_name": c_name, "is_gt_high_risk": is_gt_high_risk,
            })

            # --- 3. Track B Learned ---
            b_cov_2d = np.zeros((6, self.H, 2, 2), dtype=np.float32)
            for k in range(6):
                for t in range(self.H):
                    sx, sy, rho = b_cov_params_np[i, k, t]
                    b_cov_2d[k, t] = np.array([[sx**2, rho*sx*sy], [rho*sx*sy, sy**2]])

            ade_b = compute_min_ade(b_futs_np[i], gt)
            fde_b = compute_min_fde(b_futs_np[i], gt)
            nll_b = compute_bivariate_nll(b_futs_np[i], b_weights_np[i], b_cov_2d, gt)
            cov_b = check_coverage(b_futs_np[i], b_cov_2d, gt, scale_factor=1.0)

            rec_b = {"ade": ade_b, "fde": fde_b, "nll": nll_b, "covered": cov_b, "class": c_name, "scenario": sc_name}
            results_track_b.append(rec_b)
            risk_cases_b.append({
                "ego_future": ego_path, "pred_modes": b_futs_np[i], "pred_weights": b_weights_np[i],
                "pred_covariances": b_cov_2d, "class_name": c_name, "is_gt_high_risk": is_gt_high_risk,
            })

            # --- 4. Track B + Calibration ---
            qb = calib_b.class_quantiles.get(c_name, calib_b.global_quantile)
            cov_scaled_b = b_cov_2d * (qb ** 2)
            cov_b_cal = check_coverage(b_futs_np[i], b_cov_2d, gt, scale_factor=qb)
            nll_b_cal = compute_bivariate_nll(b_futs_np[i], b_weights_np[i], cov_scaled_b, gt)

            rec_b_cal = {"ade": ade_b, "fde": fde_b, "nll": nll_b_cal, "covered": cov_b_cal, "class": c_name, "scenario": sc_name}
            results_track_b_calib.append(rec_b_cal)
            risk_cases_b_calib.append({
                "ego_future": ego_path, "pred_modes": b_futs_np[i], "pred_weights": b_weights_np[i],
                "pred_covariances": cov_scaled_b, "class_name": c_name, "is_gt_high_risk": is_gt_high_risk,
            })

        # Summary Metrics
        summary_a = summarize_metrics(results_track_a)
        summary_a_cal = summarize_metrics(results_track_a_calib)
        summary_b = summarize_metrics(results_track_b)
        summary_b_cal = summarize_metrics(results_track_b_calib)

        # Risk False-Safe Rates
        fsr_a = self.risk_engine.evaluate_false_safe_rate(risk_cases_a)
        fsr_a_cal = self.risk_engine.evaluate_false_safe_rate(risk_cases_a_calib)
        fsr_b = self.risk_engine.evaluate_false_safe_rate(risk_cases_b)
        fsr_b_cal = self.risk_engine.evaluate_false_safe_rate(risk_cases_b_calib)

        # 95% Bootstrap Confidence Intervals for ADE and FSR
        ades_a = [r["ade"] for r in results_track_a]
        ades_b = [r["ade"] for r in results_track_b]
        mean_ade_a, ci_a_lo, ci_a_hi = compute_bootstrap_ci(ades_a)
        mean_ade_b, ci_b_lo, ci_b_hi = compute_bootstrap_ci(ades_b)

        # Paired delta ADE
        delta_ades = [b - a for a, b in zip(ades_a, ades_b)]
        mean_delta_ade, d_ci_lo, d_ci_hi = compute_bootstrap_ci(delta_ades)

        # Statistical Decision Rule Evaluation
        # Track B beats Track A if:
        # 1. Delta minADE 95% CI upper bound < 0 (Track B is statistically superior in ADE)
        # 2. Track B FSR <= Track A FSR
        ade_beats = d_ci_hi < 0.0
        fsr_beats = fsr_b["false_safe_rate"] <= fsr_a["false_safe_rate"]

        decision_passed = ade_beats and fsr_beats
        decision_verdict = (
            "PASS: Track B statistically beats Track A (95% CI). Promote Track B to P2-ML and P3-ML."
            if decision_passed else
            "REJECT / KEEP TRACK A: Track B does NOT statistically beat Track A with 95% confidence intervals. Retaining Track A in P2-ML and P3-ML."
        )

        # Reliability Diagrams
        reliability_data_a = compute_reliability_diagram([
            {"modes": self.physics_predictor.predict(s.history_xyv, s.class_name).modes,
             "covariances": self.physics_predictor.predict(s.history_xyv, s.class_name).covariances,
             "ground_truth": np.array(s.future_xy)} for s in val_seqs[:80]
        ])

        return {
            "ablations": {
                "track_a_physics": {**summary_a, "fsr": fsr_a},
                "track_a_physics_calibrated": {**summary_a_cal, "fsr": fsr_a_cal},
                "track_b_learned": {**summary_b, "fsr": fsr_b},
                "track_b_learned_calibrated": {**summary_b_cal, "fsr": fsr_b_cal},
            },
            "bootstrap_confidence_intervals": {
                "minADE_track_a_95_CI": [ci_a_lo, ci_a_hi],
                "minADE_track_b_95_CI": [ci_b_lo, ci_b_hi],
                "delta_minADE_95_CI": [d_ci_lo, d_ci_hi],
                "mean_delta_ade": mean_delta_ade,
            },
            "decision_rule": {
                "ade_statistically_superior": ade_beats,
                "fsr_superior_or_equal": fsr_beats,
                "promoted_to_p2_p3_ml": decision_passed,
                "verdict": decision_verdict,
            },
            "reliability_diagram": reliability_data_a,
            "calibration_quantiles": {
                "track_a": calib_a.calibrate([]),
                "track_b": calib_b.calibrate([]),
            },
        }
