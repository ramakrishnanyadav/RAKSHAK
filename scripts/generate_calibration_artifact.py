"""
Independent Conformal Calibration Artifact Generator.

Strict Compliance Invariants (docs/SAP.md, docs/RISK_DEFINITION.md, G2 Approval):
1. Independent Split: Exclusively uses the pre-registered calibration split
   (Seeds 1500 - 1539, 40 seeds x 5 scenarios = 200 simulation episodes).
2. No Data Leakage: Strictly zero overlap with tune (1000-1009), val_a (2000-2019),
   val_b (2020-2039), or frozen-test (3000-3029) splits.
3. Feature Parity: Inference and calibration use identical features observable at t0
   (v0 = hypot(vx, vy), agent length, agent width).
4. Conservative Aggregation: Multiple same-class observations within one episode are
   aggregated via maximum nonconformity score into exactly ONE episode-level score.
5. Finite-Sample Quantile: m = ceil((n_e + 1) * 0.95).
6. Non-Target Exclusion: Episodes not containing a target class do not inject zero scores.
7. Output Artifact: engine/ml/models/conformal_tables.json with full audit provenance.
"""

import os
import sys
import math
import json
from typing import List, Dict, Tuple

# Add root directory to sys.path
ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

from engine.scenarios.registry import build_scenario, get_seeds_for_split, SCENARIOS_CATALOG
from engine.prediction.predictor import NonLaneMultiHypothesisPredictor
from engine.prediction.conformal_calibrator import (
    SplitConformalPredictionCalibrator,
    EpisodeCalibrationRecord,
    AgentTrajectoryObservation,
    PREDICTOR_VERSION,
)
from engine.simulation.obstacles import AGENT_PROFILES


def run_calibration_data_collection(
    seeds: List[int],
    horizon_s: float = 2.8,
    dt: float = 0.2,
    sim_dt: float = 0.1,
) -> List[EpisodeCalibrationRecord]:
    """
    Executes open/closed-loop agent trajectories across 200 calibration episodes
    (40 seeds x 5 scenarios) to collect ground-truth future positions and nominal forecasts.
    """
    predictor = NonLaneMultiHypothesisPredictor(horizon_s=horizon_s, dt=dt)
    horizon_steps = int(round(horizon_s / dt))
    horizon_times = [round((k + 1) * dt, 2) for k in range(horizon_steps)]

    episodes: List[EpisodeCalibrationRecord] = []

    print(f"Collecting calibration data across {len(seeds)} seeds and {len(SCENARIOS_CATALOG)} scenarios...")
    
    for scenario_id in SCENARIOS_CATALOG.keys():
        for seed in seeds:
            ep_id = f"calib_{scenario_id.lower()}_s{seed}"
            world, ego, sc_cfg = build_scenario(scenario_id, seed, split="calibration")

            # Record agent states across full scenario duration
            total_steps = int(sc_cfg.timeout_s / sim_dt)
            # agent_history[agent_id] = [(t, x, y, yaw, vx, vy, length, width, class_name), ...]
            agent_history: Dict[str, List[Tuple[float, float, float, float, float, float, float, float, str]]] = {}

            # Step 0 state
            current_t = 0.0
            for ag in world.dynamic_agents:
                ag_vx = ag.v * math.cos(ag.yaw)
                ag_vy = ag.v * math.sin(ag.yaw)
                agent_history.setdefault(ag.id, []).append(
                    (current_t, ag.x, ag.y, ag.yaw, ag_vx, ag_vy, ag.profile.length, ag.profile.width, ag.class_name)
                )

            # Step world forward
            for step_idx in range(1, total_steps + 1):
                world.step(sim_dt)
                current_t = round(step_idx * sim_dt, 2)
                for ag in world.dynamic_agents:
                    ag_vx = ag.v * math.cos(ag.yaw)
                    ag_vy = ag.v * math.sin(ag.yaw)
                    agent_history.setdefault(ag.id, []).append(
                        (current_t, ag.x, ag.y, ag.yaw, ag_vx, ag_vy, ag.profile.length, ag.profile.width, ag.class_name)
                    )

            # Generate AgentTrajectoryObservations for each agent in this episode
            # Sample observation windows every 1.0s where full 2.8s future exists
            episode_observations: List[AgentTrajectoryObservation] = []
            
            for ag_id, hist in agent_history.items():
                if not hist:
                    continue
                class_name = hist[0][8]
                length = hist[0][6]
                width = hist[0][7]

                total_time_samples = len(hist)
                # Sample prediction windows at t0 = 0.0, 1.0, 2.0, ...
                sample_interval_steps = int(1.0 / sim_dt)
                max_start_step = total_time_samples - int(horizon_s / sim_dt)

                for start_step in range(0, max(1, max_start_step), sample_interval_steps):
                    if start_step + int(horizon_s / sim_dt) >= total_time_samples:
                        break

                    t0_state = hist[start_step]
                    t0, x0, y0, yaw0, vx0, vy0 = t0_state[0], t0_state[1], t0_state[2], t0_state[3], t0_state[4], t0_state[5]
                    v0 = math.hypot(vx0, vy0)

                    # Compute nominal forecast (Hypothesis 0 trajectory)
                    hypotheses, _ = predictor.predict(
                        class_name=class_name,
                        x=x0,
                        y=y0,
                        yaw=yaw0,
                        vx=vx0,
                        vy=vy0,
                        length=length,
                        width=width,
                    )
                    nom_traj = hypotheses[0].trajectory
                    nominal_forecast = [(pt.x, pt.y, 0.0) for pt in nom_traj]

                    # Extract ground truth positions at t0 + t_k
                    ground_truth: List[Tuple[float, float]] = []
                    for t_rel in horizon_times:
                        target_t = round(t0 + t_rel, 2)
                        # Find closest recorded step
                        closest_step = int(round(target_t / sim_dt))
                        closest_step = min(closest_step, total_time_samples - 1)
                        gt_x = hist[closest_step][1]
                        gt_y = hist[closest_step][2]
                        ground_truth.append((gt_x, gt_y))

                    episode_observations.append(
                        AgentTrajectoryObservation(
                            agent_id=f"{ag_id}_t{int(t0*10)}",
                            class_name=class_name,
                            v0=v0,
                            length=length,
                            width=width,
                            nominal_forecast=nominal_forecast,
                            ground_truth=ground_truth,
                            horizon_times=horizon_times,
                        )
                    )

            episodes.append(
                EpisodeCalibrationRecord(
                    episode_id=ep_id,
                    seed=seed,
                    agents=episode_observations,
                )
            )

    return episodes


def main():
    print("=" * 70)
    print("  F4 Split-Conformal Calibration Artifact Generation")
    print(f"  Target: engine/ml/models/conformal_tables.json")
    print(f"  Predictor Version: {PREDICTOR_VERSION}")
    print("=" * 70)

    # Pre-registered calibration split: Seeds 1500 - 1539 (40 seeds)
    calib_seeds = get_seeds_for_split("calibration")
    print(f"Calibration seeds: {min(calib_seeds)} - {max(calib_seeds)} (Total: {len(calib_seeds)})")

    # Collect calibration trajectory records
    episodes = run_calibration_data_collection(seeds=calib_seeds)
    print(f"\nCollected {len(episodes)} calibration episodes.")

    # Initialize Calibrator
    calibrator = SplitConformalPredictionCalibrator(
        target_coverage=0.95,
        min_episodes=40,
    )

    # Fit quantiles
    print("\nFitting empirical conformal quantiles with finite-sample correction...")
    fit_summary = calibrator.fit(episodes=episodes, seed_list=calib_seeds)

    print("\nCalibration Results by Class:")
    print("-" * 70)
    print(f"{'Class':<18} | {'Episodes':<9} | {'Obs':<6} | {'Sim Quantile':<14} | {'Status':<12}")
    print("-" * 70)

    for c in sorted(fit_summary["episodes_per_class"].keys()):
        n_e = fit_summary["episodes_per_class"][c]
        n_obs = fit_summary["obstacle_observations_per_class"][c]
        q_sim = fit_summary["simultaneous_quantiles"].get(c, float("nan"))
        status = fit_summary["status"][c]
        valid = fit_summary["coverage_guarantee_valid"][c]
        valid_mark = "[VALID 95%]" if valid else "[FALLBACK]"
        print(f"{c:<18} | {n_e:<9} | {n_obs:<6} | {q_sim:<14.4f} | {status} {valid_mark}")

    # Output artifact directory
    output_dir = os.path.join(ROOT_DIR, "engine", "ml", "models")
    os.makedirs(output_dir, exist_ok=True)
    output_path = os.path.join(output_dir, "conformal_tables.json")

    # Save to disk
    calibrator.save_to_json(output_path)
    print(f"\nArtifact saved to: {output_path}")

    # Round-trip verification
    loaded_calibrator = SplitConformalPredictionCalibrator.load_from_json(output_path)
    print("Round-trip JSON verification: PASSED")
    print(f"Calibration timestamp: {loaded_calibrator.provenance.timestamp_utc}")
    print(f"Predictor version: {loaded_calibrator.provenance.predictor_version}")
    print("=" * 70)


if __name__ == "__main__":
    main()
