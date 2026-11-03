"""
Comprehensive Test Suite for ML Trajectory Prediction, Uncertainty Calibration,
ONNX Parity, Risk Engine, and Statistical Decision Rule.
"""

import os
import pytest
import numpy as np
import torch

from engine.ml.data.generator import (
    generate_benchmark_dataset,
    simulate_single_trajectory,
    CLASS_NAMES,
)
from engine.ml.data.idd_adapter import normalize_idd_track
from engine.ml.track_a_physics import (
    PhysicsBaselinePredictor,
    ctra_step,
    propagate_covariance,
)
from engine.ml.track_b_learned import (
    TrajectoryGRUEncoderDecoder,
    MultiModalWTALoss,
    export_to_onnx,
    run_parity_check,
)
from engine.ml.track_b_learned.trainer import sequences_to_tensors
from engine.ml.calibration import (
    SplitConformalCalibrator,
    compute_min_ade,
    compute_min_fde,
    compute_bivariate_nll,
    check_coverage,
    summarize_metrics,
)
from engine.ml.risk import SpatiotemporalRiskEngine
from engine.ml.perception import IDDPerceptionBenchmark
from engine.ml.replan_trigger import LearnedReplanClassifier, RuleBasedReplanTrigger
from engine.ml.benchmark import BenchmarkSuite, compute_bootstrap_ci


def test_data_generation_and_no_leakage():
    """Verifies that dataset splits are partitioned by sequence, never by frame."""
    train_seqs = generate_benchmark_dataset("train", count=50, seed=1000)
    val_seqs = generate_benchmark_dataset("val", count=50, seed=2000)
    calib_seqs = generate_benchmark_dataset("calib", count=50, seed=2500)

    train_ids = {s.seq_id for s in train_seqs}
    val_ids = {s.seq_id for s in val_seqs}
    calib_ids = {s.seq_id for s in calib_seqs}

    # Strict disjunction between splits
    assert len(train_ids.intersection(val_ids)) == 0, "Data leakage detected between train and val"
    assert len(train_ids.intersection(calib_ids)) == 0, "Data leakage detected between train and calib"
    assert len(val_ids.intersection(calib_ids)) == 0, "Data leakage detected between val and calib"

    # Sequence lengths
    assert len(train_seqs[0].history_xyv) == 10
    assert len(train_seqs[0].future_xy) == 15


def test_idd_adapter():
    """Verifies IDD track normalization into canonical relative representation."""
    raw_track = {
        "id": "idd_auto_42",
        "class": "auto_rickshaw",
        "positions": [[float(i), float(i * 0.5)] for i in range(25)],
    }
    seq = normalize_idd_track(raw_track, seq_idx=42)
    assert seq is not None
    assert seq.class_name == "auto_rickshaw"
    assert seq.class_id == 0
    assert len(seq.history_xyv) == 10
    assert len(seq.future_xy) == 15


def test_track_a_physics_baseline():
    """Verifies Track A multi-modal output shapes, weights, and expanding covariances."""
    predictor = PhysicsBaselinePredictor(horizon_steps=15, dt=0.2)
    hist = [[0.0, 0.0, 0.0, 0.0, 0.0] for _ in range(8)] + [
        [0.8, 0.0, 4.0, 0.0, 0.0],
        [1.6, 0.0, 4.0, 0.0, 0.0],
    ]
    out = predictor.predict(hist, "auto_rickshaw")

    assert out.modes.shape == (6, 15, 2)
    assert out.weights.shape == (6,)
    assert np.isclose(np.sum(out.weights), 1.0)
    assert out.covariances.shape == (6, 15, 2, 2)

    # Covariance trace must expand over time
    cov_t0 = np.trace(out.covariances[0, 0])
    cov_t14 = np.trace(out.covariances[0, 14])
    assert cov_t14 > cov_t0, "Covariance uncertainty must expand over prediction horizon"


def test_track_b_model_and_wta_loss():
    """Verifies forward pass and Winner-Takes-All loss computation."""
    model = TrajectoryGRUEncoderDecoder(hist_len=10, fut_len=15)
    criterion = MultiModalWTALoss()

    B = 4
    hist = torch.randn(B, 10, 5)
    cls_vec = torch.zeros(B, 6)
    cls_vec[:, 0] = 1.0
    near = torch.randn(B, 4, 4)
    corr = torch.tensor([[3.8, -3.8]] * B)
    targets = torch.randn(B, 15, 2)

    futs, weights, cov_params = model(hist, cls_vec, near, corr)

    assert futs.shape == (B, 6, 15, 2)
    assert weights.shape == (B, 6)
    assert torch.allclose(weights.sum(dim=-1), torch.ones(B), atol=1e-4)
    assert cov_params.shape == (B, 6, 15, 3)

    loss, metrics = criterion(futs, weights, cov_params, targets)
    assert loss.item() > 0.0
    assert "loss_reg" in metrics
    assert "loss_nll" in metrics
    assert "loss_cls" in metrics


def test_onnx_export_and_matlab_parity():
    """Verifies ONNX export and Python/ONNX numerical parity < 1e-4."""
    onnx_path = "engine/ml/models/learned_predictor.onnx"
    assert os.path.exists(onnx_path), "ONNX model artifact must exist"

    parity = run_parity_check(onnx_path=onnx_path)
    assert parity["onnx_available"] is True
    assert parity["parity_passed"] is True
    assert parity["max_err_futures"] < 1e-4
    assert parity["max_err_weights"] < 1e-4
    assert parity["max_err_cov"] < 1e-4
    assert os.path.exists(parity["vectors_json_path"])


def test_split_conformal_calibration():
    """Verifies split conformal non-conformity quantiles and coverage expansion."""
    calibrator = SplitConformalCalibrator(target_coverage=0.95)

    dummy_scores = [
        {"score": float(x), "class_name": "auto_rickshaw", "scenario": "SCENARIO_1"}
        for x in np.random.uniform(0.5, 2.5, size=100)
    ]
    res = calibrator.calibrate(dummy_scores)

    assert res["target_coverage"] == 0.95
    assert calibrator.global_quantile > 1.0
    assert "auto_rickshaw" in calibrator.class_quantiles


def test_risk_engine_and_false_safe_rate():
    """Verifies Spatiotemporal Risk Engine and False-Safe Rate evaluation."""
    engine = SpatiotemporalRiskEngine(risk_threshold=1.0)

    H = 15
    ego_path = np.zeros((H, 2))
    for t in range(H):
        ego_path[t] = [1.0 + t * 0.5, 0.0]

    # Predictor with modes near ego
    modes_close = np.zeros((6, H, 2))
    for k in range(6):
        for t in range(H):
            modes_close[k, t] = [1.0 + t * 0.5 + 0.3, 0.0]

    weights = np.ones(6) / 6.0
    covs = np.zeros((6, H, 2, 2))
    for k in range(6):
        for t in range(H):
            covs[k, t] = np.eye(2) * 0.05

    risk_field = engine.compute_agent_risk_field(
        ego_future=ego_path,
        pred_modes=modes_close,
        pred_weights=weights,
        pred_covariances=covs,
        class_name="pedestrian",
    )

    assert risk_field["is_high_risk"] is True
    assert risk_field["peak_risk"] > 1.0

    # False Safe evaluation
    cases = [
        {
            "ego_future": ego_path,
            "pred_modes": modes_close,
            "pred_weights": weights,
            "pred_covariances": covs,
            "class_name": "pedestrian",
            "is_gt_high_risk": True,
        }
    ]
    fsr_res = engine.evaluate_false_safe_rate(cases)
    assert fsr_res["false_safe_rate"] == 0.0 # Correctly detected


def test_60_agent_latency_constraint():
    """Verifies inference latency meets G4 budget (< 100 ms) for 60 simultaneous agents on CPU test environment."""
    suite = BenchmarkSuite()
    res = suite.benchmark_latency_60_agents(iterations=20)

    mean_lat = res["track_b_latency_ms"]["mean"]
    p95_lat = res["track_b_latency_ms"]["p95"]
    assert p95_lat < 100.0, f"P95 latency {p95_lat} ms exceeded 100 ms G4 budget"
    assert res["track_b_latency_ms"]["constraint_met_budget"] is True


def test_learned_replan_trigger():
    """Verifies Optional D learned trigger concordance and performance."""
    classifier = LearnedReplanClassifier()
    feats = classifier.extract_features(
        peak_risk=1.5,
        min_clearance=1.2,
        min_ttc=1.4,
        uncertainty_peak=0.8,
        stall_time=0.0,
        delta_risk=0.4,
    )
    should_replan, prob = classifier.should_replan(feats)
    assert should_replan is True
    assert prob > 0.5


def test_idd_perception_benchmark():
    """Verifies Optional C IDD perception reporting across Indian classes."""
    bench = IDDPerceptionBenchmark()
    map_res = bench.get_overall_map()

    assert map_res["mAP_50"] > 0.70
    assert "auto_rickshaw" in map_res["per_class"]
    assert "cattle" in map_res["per_class"]
    assert "handcart" in map_res["per_class"]
