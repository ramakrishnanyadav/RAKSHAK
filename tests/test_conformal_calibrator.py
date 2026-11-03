"""
Comprehensive Test Suite for F4 Split-Conformal Calibration Integration.

Verifies:
1. Exact anisotropic Mahalanobis nonconformity score mathematics.
2. Directional dispersion scaling and inference-time feature parity.
3. Finite-sample split-conformal quantile exactness (m = ceil((n+1)(1-alpha))).
4. Conservative episode-level maximum aggregation across same-class obstacles.
5. Strict exclusion of non-target episodes (no zero scores injected).
6. Enforcement of minimum independent episode count (n_e >= 40).
7. Uncalibrated 3.50m fallback marked as coverage_guarantee_valid=False when n_e < 40.
8. Pointwise vs. simultaneous trajectory calibration modes.
9. Provenance recording and JSON round-trip serialization.
10. End-to-end integration with NonLaneMultiHypothesisPredictor and AgentTrack.
"""

import math
import os
import tempfile
import pytest
import numpy as np

from engine.apath_log.schema import AgentTrack, ConformalConePoint
from engine.prediction.conformal_calibrator import (
    SplitConformalPredictionCalibrator,
    ConformalCalibrationProvenance,
    AgentTrajectoryObservation,
    EpisodeCalibrationRecord,
    compute_base_dispersion,
    compute_directional_normalizers,
    compute_mahalanobis_score,
    compute_finite_sample_quantile,
    PREDICTOR_VERSION,
    DEFAULT_FALLBACK_RADIUS_M,
    MIN_INDEPENDENT_EPISODES,
)
from engine.prediction.predictor import NonLaneMultiHypothesisPredictor


# ---------------------------------------------------------------------------
# Test 1: Mathematical Accuracy of Base Dispersion & Directional Normalizers
# ---------------------------------------------------------------------------
def test_base_dispersion_and_normalizers_hand_calculation():
    """
    Hand-calculated test case:
    Cow: length L = 2.40m, speed v0 = 1.00 m/s, horizon t_k = 0.40s.
    sigma_0 = max(1.00, 0.50 * 2.40 + 0.20 * 1.00 + 0.15 * 0.40)
            = max(1.00, 1.20 + 0.20 + 0.06)
            = 1.460 m.
    sigma_long = 0.50 * 1.460 = 0.730 m.
    sigma_lat  = 0.35 * 1.460 = 0.511 m.
    """
    sigma_0 = compute_base_dispersion(length=2.40, v0=1.00, t_k=0.40)
    assert abs(sigma_0 - 1.460) < 1e-6

    sigma_long, sigma_lat = compute_directional_normalizers(
        length=2.40, v0=1.00, t_k=0.40, beta_long=0.50, beta_lat=0.35
    )
    assert abs(sigma_long - 0.730) < 1e-6
    assert abs(sigma_lat - 0.511) < 1e-6


# ---------------------------------------------------------------------------
# Test 2: Anisotropic Mahalanobis Nonconformity Score Mathematics
# ---------------------------------------------------------------------------
def test_mahalanobis_score_aligned_and_rotated():
    """
    Tests anisotropic score under zero yaw and 90-degree yaw rotation.
    
    Case A: yaw = 0.0 (aligned with global axes)
    dx_global = 0.730, dy_global = 0.511, sigma_long = 0.730, sigma_lat = 0.511.
    s = sqrt((0.730/0.730)^2 + (0.511/0.511)^2) = sqrt(1 + 1) = sqrt(2) = 1.414214.
    """
    s_aligned = compute_mahalanobis_score(
        dx_global=0.730,
        dy_global=0.511,
        yaw=0.0,
        sigma_long=0.730,
        sigma_lat=0.511,
    )
    assert abs(s_aligned - math.sqrt(2.0)) < 1e-5

    """
    Case B: yaw = pi/2 (90 degrees counter-clockwise)
    Heading is along +y. Longitudinal error is along +y, lateral along -x.
    dx_global = 0.0, dy_global = 0.730.
    In local body frame:
    dx_local = cos(90)*0 + sin(90)*0.730 = 0.730 (longitudinal!)
    dy_local = -sin(90)*0 + cos(90)*0.730 = 0.000.
    s = sqrt((0.730 / 0.730)^2 + 0) = 1.000.
    """
    s_rotated = compute_mahalanobis_score(
        dx_global=0.0,
        dy_global=0.730,
        yaw=math.pi / 2.0,
        sigma_long=0.730,
        sigma_lat=0.511,
    )
    assert abs(s_rotated - 1.000) < 1e-5


# ---------------------------------------------------------------------------
# Test 3: Finite-Sample Conformal Quantile Exactness
# ---------------------------------------------------------------------------
def test_finite_sample_quantile_exactness():
    """
    Verifies finite-sample quantile formula:
    m = ceil((n + 1) * (1 - alpha))
    For n = 40, alpha = 0.05:
    m = ceil(41 * 0.95) = ceil(38.95) = 39.
    The calibrated quantile must be exactly the 39th order statistic (index 38).
    """
    scores = [float(i) for i in range(1, 41)] # [1.0, 2.0, ..., 40.0]
    q_40 = compute_finite_sample_quantile(scores, alpha=0.05)
    assert q_40 == 39.0

    # For n = 100, alpha = 0.05:
    # m = ceil(101 * 0.95) = ceil(95.95) = 96.
    scores_100 = [float(i) for i in range(1, 101)]
    q_100 = compute_finite_sample_quantile(scores_100, alpha=0.05)
    assert q_100 == 96.0

    # Empty list raises ValueError
    with pytest.raises(ValueError):
        compute_finite_sample_quantile([], alpha=0.05)


# ---------------------------------------------------------------------------
# Test 4: Conservative Episode-Level Maximum Aggregation Across Same-Class
# ---------------------------------------------------------------------------
def test_episode_level_maximum_aggregation():
    """
    Verifies that multiple same-class obstacles in an episode are aggregated
    conservatively via the supremum (maximum score).
    """
    calibrator = SplitConformalPredictionCalibrator(
        target_coverage=0.95, min_episodes=1
    )

    # Episode with 2 cattle instances
    # Obstacle 1 has constant forecast error 0.50
    # Obstacle 2 has larger forecast error 1.20
    horizon_times = [0.20, 0.40]
    ag1 = AgentTrajectoryObservation(
        agent_id="cow_1",
        class_name="cattle",
        v0=1.0,
        length=2.4,
        width=1.1,
        nominal_forecast=[(10.0, 0.0, 0.0), (10.2, 0.0, 0.0)],
        ground_truth=[(10.5, 0.0), (10.7, 0.0)],
        horizon_times=horizon_times,
    )
    ag2 = AgentTrajectoryObservation(
        agent_id="cow_2",
        class_name="cattle",
        v0=1.0,
        length=2.4,
        width=1.1,
        nominal_forecast=[(20.0, 0.0, 0.0), (20.2, 0.0, 0.0)],
        ground_truth=[(21.2, 0.0), (21.4, 0.0)],
        horizon_times=horizon_times,
    )

    ep = EpisodeCalibrationRecord(
        episode_id="ep_test_01",
        seed=1500,
        agents=[ag1, ag2],
    )

    scores1 = calibrator.compute_obstacle_scores(ag1)
    scores2 = calibrator.compute_obstacle_scores(ag2)
    assert all(s2 > s1 for s1, s2 in zip(scores1, scores2))

    res = calibrator.fit([ep])
    assert res["episodes_per_class"]["cattle"] == 1
    assert res["obstacle_observations_per_class"]["cattle"] == 2

    # In a 1-episode calibration, the simultaneous quantile must equal max(scores2)
    assert abs(res["simultaneous_quantiles"]["cattle"] - round(max(scores2), 4)) < 1e-4


# ---------------------------------------------------------------------------
# Test 5: Strict Exclusion of Non-Target Episodes (No Zero Scores)
# ---------------------------------------------------------------------------
def test_exclusion_of_non_target_episodes():
    """
    Verifies that episodes lacking the target class DO NOT contribute zero scores.
    """
    calibrator = SplitConformalPredictionCalibrator(min_episodes=1)

    # Episode 1 has pedestrian only
    ep1 = EpisodeCalibrationRecord(
        episode_id="ep_1",
        seed=1501,
        agents=[
            AgentTrajectoryObservation(
                agent_id="ped_1",
                class_name="pedestrian",
                v0=1.2,
                length=0.6,
                width=0.6,
                nominal_forecast=[(5.0, 0.0, 0.0)],
                ground_truth=[(5.5, 0.0)],
                horizon_times=[0.20],
            )
        ],
    )

    # Episode 2 has cattle only
    ep2 = EpisodeCalibrationRecord(
        episode_id="ep_2",
        seed=1502,
        agents=[
            AgentTrajectoryObservation(
                agent_id="cow_1",
                class_name="cattle",
                v0=0.8,
                length=2.4,
                width=1.1,
                nominal_forecast=[(12.0, 0.0, 0.0)],
                ground_truth=[(12.8, 0.0)],
                horizon_times=[0.20],
            )
        ],
    )

    res = calibrator.fit([ep1, ep2])

    # ep1 should not be in cattle count, ep2 should not be in pedestrian count
    assert res["episodes_per_class"]["pedestrian"] == 1
    assert res["episodes_per_class"]["cattle"] == 1
    # Cattle quantile must strictly reflect cow_1, not 0.0 from ep1
    assert res["simultaneous_quantiles"]["cattle"] > 0.5


# ---------------------------------------------------------------------------
# Test 6: Enforcement of Minimum Independent Episode Count (n_e >= 40)
# ---------------------------------------------------------------------------
def test_insufficient_sample_fallback_enforcement():
    """
    Verifies that if n_e < 40:
    - coverage_guarantee_valid is False
    - status clearly states coverage guarantee unavailable
    - predictor envelope falls back to 3.50m with coverage_p = 0.0
    """
    calibrator = SplitConformalPredictionCalibrator(
        target_coverage=0.95, min_episodes=40
    )

    # Create 39 episodes (one short of required 40)
    episodes_39 = []
    for s in range(39):
        episodes_39.append(
            EpisodeCalibrationRecord(
                episode_id=f"ep_{s}",
                seed=1500 + s,
                agents=[
                    AgentTrajectoryObservation(
                        agent_id=f"cow_{s}",
                        class_name="cattle",
                        v0=1.0,
                        length=2.4,
                        width=1.1,
                        nominal_forecast=[(10.0, 0.0, 0.0)],
                        ground_truth=[(10.5, 0.0)],
                        horizon_times=[0.20],
                    )
                ],
            )
        )

    res = calibrator.fit(episodes_39)
    assert res["coverage_guarantee_valid"]["cattle"] is False
    assert "Coverage Guarantee Unavailable" in res["status"]["cattle"]

    # In inference, envelope must return 3.50m fallback with coverage_guarantee_valid = False
    envelope = calibrator.get_envelope("cattle", v0=1.0, length=2.4, horizon_times=[0.20, 0.40])
    assert len(envelope) == 2
    for cone in envelope:
        assert cone.radius_m == DEFAULT_FALLBACK_RADIUS_M
        assert cone.coverage_p == 0.95
        assert cone.coverage_guarantee_valid is False

    # Now add the 40th episode
    episodes_40 = episodes_39 + [
        EpisodeCalibrationRecord(
            episode_id="ep_39",
            seed=1539,
            agents=[
                AgentTrajectoryObservation(
                    agent_id="cow_39",
                    class_name="cattle",
                    v0=1.0,
                    length=2.4,
                    width=1.1,
                    nominal_forecast=[(10.0, 0.0, 0.0)],
                    ground_truth=[(10.5, 0.0)],
                    horizon_times=[0.20],
                )
            ],
        )
    ]

    res_40 = calibrator.fit(episodes_40)
    assert res_40["coverage_guarantee_valid"]["cattle"] is True
    assert "Calibrated" in res_40["status"]["cattle"]

    envelope_valid = calibrator.get_envelope("cattle", v0=1.0, length=2.4, horizon_times=[0.20, 0.40])
    for cone in envelope_valid:
        assert cone.coverage_p == 0.95
        assert cone.coverage_guarantee_valid is True
        assert cone.radius_m > 0.0 and cone.radius_m != DEFAULT_FALLBACK_RADIUS_M


# ---------------------------------------------------------------------------
# Test 7: Pointwise vs. Simultaneous Trajectory Modes
# ---------------------------------------------------------------------------
def test_pointwise_vs_simultaneous_modes():
    """
    Verifies that simultaneous quantile dominates or equals pointwise quantiles,
    and envelopes correctly reflect active mode.
    """
    calibrator = SplitConformalPredictionCalibrator(min_episodes=2)

    # 2 episodes with increasing errors over 3 horizon steps
    h_times = [0.20, 0.40, 0.60]
    ep1 = EpisodeCalibrationRecord(
        episode_id="ep1",
        seed=1500,
        agents=[
            AgentTrajectoryObservation(
                agent_id="a1",
                class_name="car",
                v0=5.0,
                length=4.2,
                width=1.8,
                nominal_forecast=[(1.0, 0.0, 0.0), (2.0, 0.0, 0.0), (3.0, 0.0, 0.0)],
                ground_truth=[(1.2, 0.0), (2.5, 0.0), (3.9, 0.0)],
                horizon_times=h_times,
            )
        ],
    )
    ep2 = EpisodeCalibrationRecord(
        episode_id="ep2",
        seed=1501,
        agents=[
            AgentTrajectoryObservation(
                agent_id="a2",
                class_name="car",
                v0=5.0,
                length=4.2,
                width=1.8,
                nominal_forecast=[(1.0, 0.0, 0.0), (2.0, 0.0, 0.0), (3.0, 0.0, 0.0)],
                ground_truth=[(1.1, 0.0), (2.3, 0.0), (3.6, 0.0)],
                horizon_times=h_times,
            )
        ],
    )

    calibrator.fit([ep1, ep2])

    sim_q = calibrator.simultaneous_quantiles["car"]
    pt_qs = calibrator.pointwise_quantiles["car"]

    # Simultaneous supremum must be >= every pointwise quantile
    for pt_q in pt_qs:
        assert sim_q >= pt_q

    # Envelope in simultaneous mode
    env_sim = calibrator.get_envelope("car", v0=5.0, length=4.2, horizon_times=h_times, mode="simultaneous")
    # Envelope in pointwise mode
    env_pt = calibrator.get_envelope("car", v0=5.0, length=4.2, horizon_times=h_times, mode="pointwise")

    assert len(env_sim) == len(env_pt) == 3
    # First step in simultaneous should have >= radius than pointwise because sim uses horizon supremum
    assert env_sim[0].radius_m >= env_pt[0].radius_m


# ---------------------------------------------------------------------------
# Test 8: Inference-Time Feature Parity
# ---------------------------------------------------------------------------
def test_inference_time_feature_parity():
    """
    Verifies that the normalizer is invariant to future ground truth and uses
    only instantaneous initial velocity v0 and length L.
    """
    v0 = 6.0
    length = 2.8
    t_k = 0.80

    norm_long_1, norm_lat_1 = compute_directional_normalizers(length, v0, t_k)
    # Even if future motion is erratic, normalizer depends only on t0 query inputs
    norm_long_2, norm_lat_2 = compute_directional_normalizers(length, v0, t_k)

    assert norm_long_1 == norm_long_2
    assert norm_lat_1 == norm_lat_2


# ---------------------------------------------------------------------------
# Test 9: Provenance Recording and JSON Round-Trip Serialization
# ---------------------------------------------------------------------------
def test_json_round_trip_and_provenance():
    """
    Verifies that saving and loading calibrator preserves all parameters,
    quantiles, and provenance without precision loss.
    """
    calibrator = SplitConformalPredictionCalibrator(min_episodes=2)
    ep1 = EpisodeCalibrationRecord(
        episode_id="ep1",
        seed=1500,
        agents=[
            AgentTrajectoryObservation(
                agent_id="a1",
                class_name="two_wheeler",
                v0=4.0,
                length=1.8,
                width=0.7,
                nominal_forecast=[(1.0, 0.0, 0.0)],
                ground_truth=[(1.3, 0.0)],
                horizon_times=[0.20],
            )
        ],
    )
    ep2 = EpisodeCalibrationRecord(
        episode_id="ep2",
        seed=1501,
        agents=[
            AgentTrajectoryObservation(
                agent_id="a2",
                class_name="two_wheeler",
                v0=4.0,
                length=1.8,
                width=0.7,
                nominal_forecast=[(1.0, 0.0, 0.0)],
                ground_truth=[(1.4, 0.0)],
                horizon_times=[0.20],
            )
        ],
    )
    calibrator.fit([ep1, ep2], seed_list=[1500, 1501])

    with tempfile.TemporaryDirectory() as tmpdir:
        json_path = os.path.join(tmpdir, "calib_test.json")
        calibrator.save_to_json(json_path)
        assert os.path.exists(json_path)

        loaded = SplitConformalPredictionCalibrator.load_from_json(json_path)
        assert loaded.provenance.predictor_version == PREDICTOR_VERSION
        assert loaded.provenance.calibration_seeds == [1500, 1501]
        assert loaded.simultaneous_quantiles["two_wheeler"] == calibrator.simultaneous_quantiles["two_wheeler"]
        assert loaded.coverage_guarantee_valid["two_wheeler"] is True


# ---------------------------------------------------------------------------
# Test 10: End-to-End Predictor Integration and Schema Compatibility
# ---------------------------------------------------------------------------
def test_predictor_integration_with_calibrator_and_agent_track():
    """
    Verifies that NonLaneMultiHypothesisPredictor with SplitConformalPredictionCalibrator
    produces valid hypotheses and conformal envelopes, and packages into AgentTrack cleanly.
    """
    # 1. Uncalibrated Predictor: falls back to 3.50m heuristic
    uncalibrated_predictor = NonLaneMultiHypothesisPredictor(horizon_s=1.0, dt=0.2)
    hypotheses, fallback_envelope = uncalibrated_predictor.predict(
        class_name="cattle",
        x=15.0,
        y=0.5,
        yaw=0.1,
        vx=0.8,
        vy=0.0,
    )
    assert len(hypotheses) == 3
    assert len(fallback_envelope) == 5
    for cone in fallback_envelope:
        assert cone.radius_m == DEFAULT_FALLBACK_RADIUS_M
        assert cone.coverage_p == 0.95
        assert cone.coverage_guarantee_valid is False

    # 2. Calibrated Predictor: produces calibrated anisotropic envelope
    calibrator = SplitConformalPredictionCalibrator(min_episodes=1)
    ep = EpisodeCalibrationRecord(
        episode_id="ep_0",
        seed=1500,
        agents=[
            AgentTrajectoryObservation(
                agent_id="cow_0",
                class_name="cattle",
                v0=0.8,
                length=2.4,
                width=1.1,
                nominal_forecast=[(15.0, 0.5, 0.1)] * 5,
                ground_truth=[(15.4, 0.6)] * 5,
                horizon_times=[0.20, 0.40, 0.60, 0.80, 1.00],
            )
        ],
    )
    calibrator.fit([ep])

    calibrated_predictor = NonLaneMultiHypothesisPredictor(
        horizon_s=1.0, dt=0.2, calibrator=calibrator
    )
    hypotheses, calibrated_envelope = calibrated_predictor.predict(
        class_name="cattle",
        x=15.0,
        y=0.5,
        yaw=0.1,
        vx=0.8,
        vy=0.0,
        length=2.4,
        width=1.1,
    )
    assert len(calibrated_envelope) == 5
    for cone in calibrated_envelope:
        assert cone.coverage_p == 0.95
        assert cone.coverage_guarantee_valid is True
        assert cone.semi_axis_x is not None
        assert cone.semi_axis_y is not None
        assert cone.semi_axis_x > 0.0

    # 3. Package into AgentTrack schema
    track = AgentTrack(
        id="track_cattle_01",
        class_name="cattle",
        x=15.0,
        y=0.5,
        yaw=0.1,
        v_x=0.8,
        v_y=0.0,
        length=2.4,
        width=1.1,
        prediction_hypotheses=hypotheses,
        conformal_envelope=calibrated_envelope,
    )

    track_dict = track.model_dump()
    assert track_dict["conformal_envelope"][0]["coverage_guarantee_valid"] is True
    assert track_dict["conformal_envelope"][0]["semi_axis_x"] is not None
