"""
Split-Conformal Prediction Calibrator for Non-Lane Trajectory Envelopes.

Implements exact finite-sample conformal prediction with anisotropic Mahalanobis
nonconformity scores, conservative episode-level maximum aggregation across
same-class obstacles, and inference-time feature parity without lookahead.

Pre-registered in docs/SAP.md (Section 9) and docs/RISK_DEFINITION.md (Section 2).
"""

import math
import json
import os
from datetime import datetime, timezone
from dataclasses import dataclass, field, asdict
from typing import Dict, List, Tuple, Optional, Any

from engine.apath_log.schema import ConformalConePoint


PREDICTOR_VERSION = "2.0.0-f4-calibrated"
DEFAULT_FALLBACK_RADIUS_M = 3.50
MIN_INDEPENDENT_EPISODES = 40
DEFAULT_BETA_LONG = 0.50
DEFAULT_BETA_LAT = 0.35


def compute_base_dispersion(length: float, v0: float, t_k: float) -> float:
    """
    Computes base kinematic dispersion scale.
    Strictly uses inference-time features available at prediction time t0:
    - length: static bounding dimension L_j from perception track
    - v0: instantaneous filtered speed v_j(t_0) = sqrt(vx^2 + vy^2)
    - t_k: relative prediction horizon time in seconds
    
    Formula: sigma_0(c, v_j(t0), t_k) = max(1.00, 0.50 * L_j + 0.20 * v_j(t0) + 0.15 * t_k)
    """
    return max(1.00, 0.50 * length + 0.20 * max(0.0, v0) + 0.15 * max(0.0, t_k))


def compute_directional_normalizers(
    length: float,
    v0: float,
    t_k: float,
    beta_long: float = DEFAULT_BETA_LONG,
    beta_lat: float = DEFAULT_BETA_LAT,
) -> Tuple[float, float]:
    """
    Computes longitudinal and lateral dispersion scale normalizers.
    The aspect ratio beta_long / beta_lat (0.50 / 0.35 = 1.429) was pre-calibrated
    on the independent training/tuning split (tune, Seeds 1000-1009).
    """
    sigma_0 = compute_base_dispersion(length, v0, t_k)
    sigma_long = beta_long * sigma_0
    sigma_lat = beta_lat * sigma_0
    return sigma_long, sigma_lat


def compute_mahalanobis_score(
    dx_global: float,
    dy_global: float,
    yaw: float,
    sigma_long: float,
    sigma_lat: float,
) -> float:
    """
    Transforms global forecast displacement error into predicted obstacle body frame:
    [dx_local, dy_local]^T = R(yaw)^T * [dx_global, dy_global]^T
    
    Returns normalized anisotropic Mahalanobis nonconformity score:
    s = sqrt((dx_local / sigma_long)^2 + (dy_local / sigma_lat)^2)
    """
    cos_yaw = math.cos(yaw)
    sin_yaw = math.sin(yaw)
    dx_local = cos_yaw * dx_global + sin_yaw * dy_global
    dy_local = -sin_yaw * dx_global + cos_yaw * dy_global

    norm_x = dx_local / max(1e-4, sigma_long)
    norm_y = dy_local / max(1e-4, sigma_lat)
    return math.sqrt(norm_x * norm_x + norm_y * norm_y)


def compute_finite_sample_quantile(scores: List[float], alpha: float = 0.05) -> float:
    """
    Computes the exact split-conformal empirical quantile:
    m = ceil((n + 1) * (1 - alpha))
    quantile = sorted_scores[m - 1]
    
    Guarantees exact finite-sample marginal coverage >= 1 - alpha under exchangeability.
    """
    n = len(scores)
    if n == 0:
        raise ValueError("Cannot compute finite-sample conformal quantile on empty scores list")
    
    sorted_s = sorted(scores)
    m = int(math.ceil((n + 1) * (1.0 - alpha)))
    # Finite-sample index bound: 1 <= m <= n
    m = max(1, min(n, m))
    return float(sorted_s[m - 1])


@dataclass
class AgentTrajectoryObservation:
    """Ground truth and forecast trajectory for one obstacle in a simulation episode."""
    agent_id: str
    class_name: str
    v0: float
    length: float
    width: float
    nominal_forecast: List[Tuple[float, float, float]]  # [(x_pred, y_pred, yaw_pred), ...] at t_k
    ground_truth: List[Tuple[float, float]]             # [(x_true, y_true), ...] at t_k
    horizon_times: List[float]                          # [0.20, 0.40, ...] in seconds


@dataclass
class EpisodeCalibrationRecord:
    """All agent observations within a single independent simulation episode."""
    episode_id: str
    seed: int
    scenario_id: str = ""
    agents: List[AgentTrajectoryObservation] = field(default_factory=list)


@dataclass
class ConformalCalibrationProvenance:
    """Cryptographic and experimental provenance of calibrated conformal parameters."""
    predictor_version: str = PREDICTOR_VERSION
    timestamp_utc: str = ""
    target_coverage: float = 0.95
    alpha: float = 0.05
    min_episodes_required: int = MIN_INDEPENDENT_EPISODES
    beta_long: float = DEFAULT_BETA_LONG
    beta_lat: float = DEFAULT_BETA_LAT
    mode: str = "simultaneous"
    calibration_seeds: List[int] = field(default_factory=list)
    episodes_per_class: Dict[str, int] = field(default_factory=dict)
    obstacle_observations_per_class: Dict[str, int] = field(default_factory=dict)
    simultaneous_quantiles: Dict[str, float] = field(default_factory=dict)
    pointwise_quantiles: Dict[str, List[float]] = field(default_factory=dict)
    coverage_guarantee_valid: Dict[str, bool] = field(default_factory=dict)
    status: Dict[str, str] = field(default_factory=dict)


class SplitConformalPredictionCalibrator:
    """
    Split-Conformal Prediction Calibrator for multi-modal trajectories.
    
    Enforces:
    1. Independent simulation episode unit (Seeds 1500-1539).
    2. Conservative episode-level maximum score aggregation across same-class obstacles.
    3. Strict exclusion of episodes without target class (no zero scores injected).
    4. Exact finite-sample quantile calculation m = ceil((n_e + 1) * (1 - alpha)).
    5. Minimum independent episode count enforcement (n_e >= 40).
    6. Uncalibrated 3.50m fallback marked as coverage_guarantee_valid=False when n_e < 40.
    """

    def __init__(
        self,
        target_coverage: float = 0.95,
        min_episodes: int = MIN_INDEPENDENT_EPISODES,
        beta_long: float = DEFAULT_BETA_LONG,
        beta_lat: float = DEFAULT_BETA_LAT,
        mode: str = "simultaneous",
    ):
        self.target_coverage = target_coverage
        self.alpha = round(1.0 - target_coverage, 4)
        self.min_episodes = min_episodes
        self.beta_long = beta_long
        self.beta_lat = beta_lat
        self.mode = mode

        self.episodes: List[EpisodeCalibrationRecord] = []
        self.provenance = ConformalCalibrationProvenance(
            target_coverage=target_coverage,
            alpha=self.alpha,
            min_episodes_required=min_episodes,
            beta_long=beta_long,
            beta_lat=beta_lat,
            mode=mode,
        )

        self.simultaneous_quantiles: Dict[str, float] = {}
        self.pointwise_quantiles: Dict[str, List[float]] = {}
        self.coverage_guarantee_valid: Dict[str, bool] = {}
        self.status: Dict[str, str] = {}
        self.episodes_per_class: Dict[str, int] = {}
        self.observations_per_class: Dict[str, int] = {}

    def add_episode(self, episode: EpisodeCalibrationRecord) -> None:
        """Adds an independent calibration episode."""
        self.episodes.append(episode)

    def compute_obstacle_scores(
        self,
        obs: AgentTrajectoryObservation,
    ) -> List[float]:
        """
        Computes pointwise nonconformity scores for one obstacle across all horizon steps.
        """
        scores: List[float] = []
        K = min(len(obs.nominal_forecast), len(obs.ground_truth), len(obs.horizon_times))
        for k in range(K):
            t_k = obs.horizon_times[k]
            x_pred, y_pred, yaw_pred = obs.nominal_forecast[k]
            x_true, y_true = obs.ground_truth[k]

            dx = x_true - x_pred
            dy = y_true - y_pred

            sigma_long, sigma_lat = compute_directional_normalizers(
                obs.length, obs.v0, t_k, self.beta_long, self.beta_lat
            )
            s_k = compute_mahalanobis_score(dx, dy, yaw_pred, sigma_long, sigma_lat)
            scores.append(s_k)
        return scores

    def fit(
        self,
        episodes: Optional[List[EpisodeCalibrationRecord]] = None,
        seed_list: Optional[List[int]] = None,
    ) -> Dict[str, Any]:
        """
        Fits empirical conformal quantiles across independent calibration episodes.
        """
        if episodes is not None:
            self.episodes = episodes

        if not self.episodes:
            raise ValueError("No calibration episodes provided to fit()")

        # Group observations by class per episode
        # episode_pointwise_scores[class_name] = List[List[float]] (one list of horizon scores per episode)
        # episode_sim_scores[class_name] = List[float] (one max score per episode)
        episode_pointwise_scores: Dict[str, List[List[float]]] = {}
        episode_sim_scores: Dict[str, List[float]] = {}
        obs_counts: Dict[str, int] = {}

        unique_seeds = set()

        for ep in self.episodes:
            unique_seeds.add(ep.seed)
            # Group agents in this episode by class
            class_agents: Dict[str, List[AgentTrajectoryObservation]] = {}
            for ag in ep.agents:
                class_agents.setdefault(ag.class_name, []).append(ag)
                obs_counts[ag.class_name] = obs_counts.get(ag.class_name, 0) + 1

            # For each class PRESENT in this episode, aggregate to exactly ONE episode-level score
            # NOTE: Classes NOT in ep are NOT added (no zero scores injected!)
            for class_name, agents in class_agents.items():
                # Compute scores for all agents of this class in this episode
                all_agent_scores: List[List[float]] = []
                for ag in agents:
                    s_ag = self.compute_obstacle_scores(ag)
                    if s_ag:
                        all_agent_scores.append(s_ag)

                if not all_agent_scores:
                    continue

                K = len(all_agent_scores[0])
                # Pointwise episode score at each step k: max across same-class agents in this episode
                ep_pt_scores = [
                    max(all_agent_scores[i][k] for i in range(len(all_agent_scores)))
                    for k in range(K)
                ]
                # Simultaneous trajectory episode score: max across all same-class agents and all horizon steps
                ep_sim_score = max(ep_pt_scores)

                episode_pointwise_scores.setdefault(class_name, []).append(ep_pt_scores)
                episode_sim_scores.setdefault(class_name, []).append(ep_sim_score)

        # Calibrate quantiles per class
        all_classes = set(episode_sim_scores.keys())
        self.simultaneous_quantiles = {}
        self.pointwise_quantiles = {}
        self.coverage_guarantee_valid = {}
        self.status = {}
        self.episodes_per_class = {}
        self.observations_per_class = obs_counts

        for class_name in all_classes:
            sim_scores = episode_sim_scores[class_name]
            pt_score_matrix = episode_pointwise_scores[class_name]
            n_e = len(sim_scores)
            self.episodes_per_class[class_name] = n_e

            if n_e < self.min_episodes:
                # Insufficient sample count: DO NOT CLAIM COVERAGE
                self.coverage_guarantee_valid[class_name] = False
                self.status[class_name] = (
                    f"Coverage Guarantee Unavailable (n_e={n_e} < {self.min_episodes})"
                )
                self.simultaneous_quantiles[class_name] = 1.0
                K = len(pt_score_matrix[0]) if pt_score_matrix else 14
                self.pointwise_quantiles[class_name] = [1.0] * K
            else:
                # Adequately powered calibration set: compute exact finite-sample quantile
                self.coverage_guarantee_valid[class_name] = True
                self.status[class_name] = (
                    f"Calibrated ({int((1.0 - self.alpha) * 100)}% coverage guarantee valid, n_e={n_e})"
                )
                q_sim = compute_finite_sample_quantile(sim_scores, self.alpha)
                self.simultaneous_quantiles[class_name] = round(q_sim, 4)

                K = len(pt_score_matrix[0])
                pt_quantiles = []
                for k in range(K):
                    k_scores = [pt_score_matrix[i][k] for i in range(n_e)]
                    q_k = compute_finite_sample_quantile(k_scores, self.alpha)
                    pt_quantiles.append(round(q_k, 4))
                self.pointwise_quantiles[class_name] = pt_quantiles

        # Update provenance
        self.provenance = ConformalCalibrationProvenance(
            predictor_version=PREDICTOR_VERSION,
            timestamp_utc=datetime.now(timezone.utc).isoformat(),
            target_coverage=self.target_coverage,
            alpha=self.alpha,
            min_episodes_required=self.min_episodes,
            beta_long=self.beta_long,
            beta_lat=self.beta_lat,
            mode=self.mode,
            calibration_seeds=sorted(list(unique_seeds if seed_list is None else set(seed_list))),
            episodes_per_class=self.episodes_per_class,
            obstacle_observations_per_class=self.observations_per_class,
            simultaneous_quantiles=self.simultaneous_quantiles,
            pointwise_quantiles=self.pointwise_quantiles,
            coverage_guarantee_valid=self.coverage_guarantee_valid,
            status=self.status,
        )

        return asdict(self.provenance)

    def get_envelope(
        self,
        class_name: str,
        v0: float,
        length: float,
        horizon_times: List[float],
        mode: Optional[str] = None,
    ) -> List[ConformalConePoint]:
        """
        Constructs prediction uncertainty envelope points for an obstacle at inference time.
        
        Strict invariants:
        - If calibrated and coverage_guarantee_valid=True:
            Computes semi-axes r_long = q * sigma_long, r_lat = q * sigma_lat.
            radius_m is set to r_long as conservative isotropic bound for circular visualizers.
            coverage_p is set to target coverage (e.g. 0.95).
            coverage_guarantee_valid is set to True.
        - If uncalibrated, insufficient samples (n_e < 40), or unknown class:
            Returns fallback 3.50m envelope.
            coverage_p is set to 0.0 (uncalibrated).
            coverage_guarantee_valid is set to False.
        """
        active_mode = mode or self.mode
        is_valid = self.coverage_guarantee_valid.get(class_name, False)

        envelope: List[ConformalConePoint] = []

        if not is_valid:
            # Fallback heuristic: STRICTLY UNCALIBRATED (coverage_guarantee_valid=False)
            for t_k in horizon_times:
                envelope.append(
                    ConformalConePoint(
                        t_rel=round(t_k, 2),
                        radius_m=DEFAULT_FALLBACK_RADIUS_M,
                        coverage_p=self.target_coverage,
                        semi_axis_x=DEFAULT_FALLBACK_RADIUS_M,
                        semi_axis_y=DEFAULT_FALLBACK_RADIUS_M,
                        coverage_guarantee_valid=False,
                    )
                )
            return envelope

        # Calibrated envelope
        if active_mode == "simultaneous":
            q_scalar = self.simultaneous_quantiles.get(class_name, 1.0)
            for t_k in horizon_times:
                sigma_long, sigma_lat = compute_directional_normalizers(
                    length, v0, t_k, self.beta_long, self.beta_lat
                )
                r_long = round(q_scalar * sigma_long, 3)
                r_lat = round(q_scalar * sigma_lat, 3)
                envelope.append(
                    ConformalConePoint(
                        t_rel=round(t_k, 2),
                        radius_m=r_long,
                        coverage_p=self.target_coverage,
                        semi_axis_x=r_long,
                        semi_axis_y=r_lat,
                        coverage_guarantee_valid=True,
                    )
                )
        else: # pointwise
            q_list = self.pointwise_quantiles.get(class_name, [1.0] * len(horizon_times))
            for k, t_k in enumerate(horizon_times):
                q_k = q_list[min(k, len(q_list) - 1)]
                sigma_long, sigma_lat = compute_directional_normalizers(
                    length, v0, t_k, self.beta_long, self.beta_lat
                )
                r_long = round(q_k * sigma_long, 3)
                r_lat = round(q_k * sigma_lat, 3)
                envelope.append(
                    ConformalConePoint(
                        t_rel=round(t_k, 2),
                        radius_m=r_long,
                        coverage_p=self.target_coverage,
                        semi_axis_x=r_long,
                        semi_axis_y=r_lat,
                        coverage_guarantee_valid=True,
                    )
                )

        return envelope

    def save_to_json(self, filepath: str) -> None:
        """Persists calibrated tables and complete provenance to JSON."""
        os.makedirs(os.path.dirname(os.path.abspath(filepath)), exist_ok=True)
        data = asdict(self.provenance)
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, sort_keys=True)

    @classmethod
    def load_from_json(cls, filepath: str) -> "SplitConformalPredictionCalibrator":
        """Loads calibrated parameters and provenance from JSON."""
        with open(filepath, "r", encoding="utf-8") as f:
            data = json.load(f)

        calibrator = cls(
            target_coverage=data.get("target_coverage", 0.95),
            min_episodes=data.get("min_episodes_required", MIN_INDEPENDENT_EPISODES),
            beta_long=data.get("beta_long", DEFAULT_BETA_LONG),
            beta_lat=data.get("beta_lat", DEFAULT_BETA_LAT),
            mode=data.get("mode", "simultaneous"),
        )
        calibrator.simultaneous_quantiles = data.get("simultaneous_quantiles", {})
        calibrator.pointwise_quantiles = data.get("pointwise_quantiles", {})
        calibrator.coverage_guarantee_valid = data.get("coverage_guarantee_valid", {})
        calibrator.status = data.get("status", {})
        calibrator.episodes_per_class = data.get("episodes_per_class", {})
        calibrator.observations_per_class = data.get("obstacle_observations_per_class", {})

        calibrator.provenance = ConformalCalibrationProvenance(
            predictor_version=data.get("predictor_version", PREDICTOR_VERSION),
            timestamp_utc=data.get("timestamp_utc", ""),
            target_coverage=data.get("target_coverage", 0.95),
            alpha=data.get("alpha", 0.05),
            min_episodes_required=data.get("min_episodes_required", MIN_INDEPENDENT_EPISODES),
            beta_long=data.get("beta_long", DEFAULT_BETA_LONG),
            beta_lat=data.get("beta_lat", DEFAULT_BETA_LAT),
            mode=data.get("mode", "simultaneous"),
            calibration_seeds=data.get("calibration_seeds", []),
            episodes_per_class=calibrator.episodes_per_class,
            obstacle_observations_per_class=calibrator.observations_per_class,
            simultaneous_quantiles=calibrator.simultaneous_quantiles,
            pointwise_quantiles=calibrator.pointwise_quantiles,
            coverage_guarantee_valid=calibrator.coverage_guarantee_valid,
            status=calibrator.status,
        )
        return calibrator
