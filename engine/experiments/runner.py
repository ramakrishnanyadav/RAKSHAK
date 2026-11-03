"""
Complete Research Validation Suite & Pre-Registered Experiment Runner.
Executes the full frozen-test benchmark (5 scenarios x 30 seeds x 6 planners = 900 runs),
computes 95% bootstrap CIs, paired McNemar and Wilcoxon tests, multiple comparison corrections,
failure taxonomy audit, and sensitivity boundary sweeps.
"""

import os
import sys
import json
import time
import hashlib
from pathlib import Path
from typing import Dict, Any, List, Tuple
import numpy as np

from engine.experiments.protocol import (
    PRE_REGISTERED_HYPOTHESES,
    METRIC_DEFINITIONS,
    ABLATION_ORDER,
    SCENARIO_LIST,
    SEEDS_PER_SPLIT,
    get_parameter_freeze_hash,
)
from engine.experiments.statistics import (
    bootstrap_ci,
    mcnemar_paired_test,
    wilcoxon_paired_test,
    adjust_p_values_fdr,
    adjust_p_values_holm,
    compute_summary_table,
)
from engine.experiments.failure_analysis import (
    FailureTaxonomyClassifier,
    FailureCategory,
    FailureEvent,
)
from engine.experiments.sensitivity import SensitivityAnalysisEngine

from engine.scenarios.registry import build_scenario
from engine.planners import create_planner
from engine.simulation.vehicle import KinematicBicycleModel
from engine.apath_log.schema import EgoState, AgentTrack
from engine.prediction.predictor import NonLaneMultiHypothesisPredictor


class ValidationExperimentRunner:
    """
    Executes pre-registered frozen-test experiments and compiles publication tables.
    """

    def __init__(
        self,
        split: str = "frozen_test",
        seed_count: int = 30,
        dt: float = 0.1,
    ):
        self.split = split
        self.seed_count = seed_count
        self.dt = dt
        self.vehicle_model = KinematicBicycleModel()
        self.predictor = NonLaneMultiHypothesisPredictor(horizon_s=2.8, dt=0.2)
        self.output_dir = Path("engine/experiments/results")
        self.output_dir.mkdir(parents=True, exist_ok=True)

    def run_single_simulation(
        self,
        scenario_id: str,
        planner_id: str,
        seed: int,
    ) -> Dict[str, Any]:
        """
        Executes a single fast deterministic closed-loop simulation run.
        """
        world, ego, sc_cfg = build_scenario(scenario_id, seed, self.split)
        planner = create_planner(planner_id)
        planner.reset()

        total_steps = int(sc_cfg.timeout_s / self.dt)
        curr_x = ego.x
        curr_y = ego.y
        curr_yaw = ego.yaw
        curr_v = ego.v
        curr_steer = 0.0
        curr_accel = 0.0
        prev_accel = 0.0

        min_clearance = 99.0
        collision_occurred = False
        goal_reached = False
        speeds = []
        jerks = []
        latencies = []
        replan_triggers = 0
        path_length = 0.0
        prev_pt = (curr_x, curr_y)

        frames_summary = []

        for step in range(total_steps):
            current_time = round(step * self.dt, 2)
            world.step(self.dt)
            perceived = world.perceive(curr_x, curr_y, curr_yaw)

            # Map perceived agents with real multi-hypothesis prediction & conformal envelopes
            agent_tracks: List[AgentTrack] = []
            for item in perceived:
                ag = item["agent"]
                hypotheses, conformal_envelope = self.predictor.predict(
                    class_name=ag.class_name,
                    x=item["measured_x"],
                    y=item["measured_y"],
                    yaw=item["measured_yaw"],
                    vx=item["measured_vx"],
                    vy=item["measured_vy"],
                    observed_intent=ag.intent,
                )
                agent_tracks.append(
                    AgentTrack(
                        id=ag.id,
                        class_name=ag.class_name,
                        x=round(item["measured_x"], 3),
                        y=round(item["measured_y"], 3),
                        yaw=round(item["measured_yaw"], 3),
                        v_x=round(item["measured_vx"], 3),
                        v_y=round(item["measured_vy"], 3),
                        length=ag.profile.length,
                        width=ag.profile.width,
                        is_occluded=ag.is_occluded,
                        prediction_hypotheses=hypotheses,
                        conformal_envelope=conformal_envelope,
                    )
                )

                dx = curr_x - item["measured_x"]
                dy = curr_y - item["measured_y"]
                dist = (dx * dx + dy * dy) ** 0.5
                if dist < min_clearance:
                    min_clearance = dist
                if dist < 1.0:
                    collision_occurred = True

            ego_current = EgoState(
                x=round(curr_x, 3),
                y=round(curr_y, 3),
                yaw=round(curr_yaw, 3),
                v=round(curr_v, 3),
                steering=round(curr_steer, 3),
                acceleration=round(curr_accel, 3),
                jerk=round((curr_accel - prev_accel) / self.dt, 3),
                length=getattr(ego, "length", 4.2),
                width=getattr(ego, "width", 1.8),
                active_state=getattr(planner, "active_state", "FOLLOW"),
            )

            t0 = time.perf_counter()
            plan_res = planner.step(
                ego=ego_current,
                world=world,
                visible_agents=agent_tracks,
                dt=self.dt,
                current_time=current_time,
            )
            lat_ms = (time.perf_counter() - t0) * 1000.0
            latencies.append(lat_ms)

            # Actuation
            curr_x, curr_y, curr_yaw, curr_v, curr_accel = self.vehicle_model.step(
                curr_x, curr_y, curr_yaw, curr_v,
                plan_res.steer, plan_res.accel, self.dt
            )
            curr_steer = plan_res.steer
            step_jerk = abs(curr_accel - prev_accel) / self.dt
            prev_accel = curr_accel
            jerks.append(step_jerk)
            speeds.append(curr_v)

            path_length += ((curr_x - prev_pt[0]) ** 2 + (curr_y - prev_pt[1]) ** 2) ** 0.5
            prev_pt = (curr_x, curr_y)

            if plan_res.replan_triggered:
                replan_triggers += 1

            # Compact frame summary for failure audit
            frames_summary.append({
                "step": step,
                "t": current_time,
                "ego": {"x": curr_x, "y": curr_y, "steering": curr_steer},
                "agents": [{"id": ag.id, "x": ag.x, "y": ag.y, "is_occluded": ag.is_occluded} for ag in agent_tracks],
                "risk_field": {"max_risk": 0.85 if collision_occurred else 0.35},
                "planner_output": {"replan_triggered": plan_res.replan_triggered, "latency_ms": lat_ms},
                "decision_trace": plan_res.decision_trace,
            })

            if curr_x >= sc_cfg.target_distance_m:
                goal_reached = True
                break
            if collision_occurred:
                break

        duration_s = round(len(speeds) * self.dt, 2)
        mean_speed = float(np.mean(speeds)) if speeds else 0.0
        max_jerk = float(np.max(jerks)) if jerks else 0.0
        mean_jerk = float(np.mean(jerks)) if jerks else 0.0
        p95_lat = float(np.percentile(latencies, 95)) if latencies else 0.0
        path_eff = float(sc_cfg.target_distance_m / max(1.0, path_length))

        return {
            "run_id": f"run_{scenario_id.lower()}_{planner_id.lower()}_{self.split}_s{seed}",
            "scenario_id": scenario_id,
            "planner_id": planner_id,
            "seed": seed,
            "duration_s": duration_s,
            "completed_goal": goal_reached,
            "collision_occurred": collision_occurred,
            "min_clearance_m": round(min_clearance, 3),
            "mean_speed_m_s": round(mean_speed, 3),
            "max_jerk_m_s3": round(max_jerk, 3),
            "mean_jerk_m_s3": round(mean_jerk, 3),
            "replan_count": replan_triggers,
            "p95_latency_ms": round(p95_lat, 2),
            "path_efficiency": round(path_eff, 3),
            "frames": frames_summary,
        }

    def execute_matrix(self) -> Dict[str, Any]:
        """
        Executes full frozen-test grid: 5 scenarios x 30 seeds x 6 planners = 900 runs.
        """
        seeds = SEEDS_PER_SPLIT.get(self.split, list(range(3000, 3030)))[:self.seed_count]
        print(f"Starting Frozen-Test Matrix Execution: {len(SCENARIO_LIST)} Scenarios x {len(seeds)} Seeds x {len(ABLATION_ORDER)} Planners...")
        print(f"Total Paired Simulations: {len(SCENARIO_LIST) * len(seeds) * len(ABLATION_ORDER)} runs")

        runs_by_planner: Dict[str, List[Dict[str, Any]]] = {p: [] for p in ABLATION_ORDER}
        all_raw_runs: List[Dict[str, Any]] = []

        t_start = time.perf_counter()

        for s_idx, sc_id in enumerate(SCENARIO_LIST, 1):
            print(f"  [{s_idx}/{len(SCENARIO_LIST)}] Running Scenario {sc_id} across {len(seeds)} matched seeds...")
            for seed in seeds:
                for planner_id in ABLATION_ORDER:
                    run_record = self.run_single_simulation(sc_id, planner_id, seed)
                    runs_by_planner[planner_id].append(run_record)
                    all_raw_runs.append(run_record)

        elapsed = time.perf_counter() - t_start
        print(f"Matrix Execution Complete in {elapsed:.2f}s ({len(all_raw_runs)} runs, {elapsed / max(1, len(all_raw_runs)) * 1000:.1f}ms/run avg).")

        return {
            "runs_by_planner": runs_by_planner,
            "all_runs": all_raw_runs,
            "execution_duration_s": round(elapsed, 2),
        }

    def analyze_results(self, runs_by_planner: Dict[str, List[Dict[str, Any]]]) -> Dict[str, Any]:
        """
        Executes pre-registered statistical tests, failure analysis, and sensitivity sweeps.
        """
        # 1. Summary statistics with 1000-resample bootstrap CIs
        summary_table = compute_summary_table(runs_by_planner, seed_count=self.seed_count)

        # 2. Pre-Registered Hypothesis Testing
        # H1: Collision Rate P3 vs B1 and P3 vs P1 (McNemar paired test)
        p3_collisions = [r["collision_occurred"] for r in runs_by_planner["P3"]]
        b1_collisions = [r["collision_occurred"] for r in runs_by_planner["B1"]]
        p1_collisions = [r["collision_occurred"] for r in runs_by_planner["P1"]]

        h1_mcnemar_p3_vs_b1 = mcnemar_paired_test(b1_collisions, p3_collisions)
        h1_mcnemar_p3_vs_p1 = mcnemar_paired_test(p1_collisions, p3_collisions)

        # H2: Min Clearance P3 vs B1 and P3 vs B2 (Wilcoxon paired test)
        p3_clearances = [r["min_clearance_m"] for r in runs_by_planner["P3"]]
        b1_clearances = [r["min_clearance_m"] for r in runs_by_planner["B1"]]
        b2_clearances = [r["min_clearance_m"] for r in runs_by_planner["B2"]]

        h2_wilcoxon_p3_vs_b1 = wilcoxon_paired_test(b1_clearances, p3_clearances, alternative="greater")
        h2_wilcoxon_p3_vs_b2 = wilcoxon_paired_test(b2_clearances, p3_clearances, alternative="greater")

        # H3: Max Jerk P3 vs B1 (Wilcoxon paired test, P3 < B1)
        p3_jerks = [r["max_jerk_m_s3"] for r in runs_by_planner["P3"]]
        b1_jerks = [r["max_jerk_m_s3"] for r in runs_by_planner["B1"]]
        h3_wilcoxon_jerk = wilcoxon_paired_test(b1_jerks, p3_jerks, alternative="less")

        # H4: Latency P3 p95 <= 20.0 ms
        p3_latencies = [r["p95_latency_ms"] for r in runs_by_planner["P3"]]
        p3_p95_overall = float(np.percentile(p3_latencies, 95))
        h4_passed = p3_p95_overall <= 20.0

        # Multiple comparisons adjustment (Benjamini-Hochberg FDR)
        raw_p_values = [
            h1_mcnemar_p3_vs_b1["p_value"],
            h1_mcnemar_p3_vs_p1["p_value"],
            h2_wilcoxon_p3_vs_b1["p_value"],
            h2_wilcoxon_p3_vs_b2["p_value"],
            h3_wilcoxon_jerk["p_value"],
        ]
        adj_p_fdr = adjust_p_values_fdr(raw_p_values)
        adj_p_holm = adjust_p_values_holm(raw_p_values)

        hypotheses_results = {
            "H1_P3_vs_B1_Collision": {
                **h1_mcnemar_p3_vs_b1,
                "p_value_fdr": adj_p_fdr[0],
                "p_value_holm": adj_p_holm[0],
                "supported": adj_p_fdr[0] < 0.05,
            },
            "H1_P3_vs_P1_Collision": {
                **h1_mcnemar_p3_vs_p1,
                "p_value_fdr": adj_p_fdr[1],
                "p_value_holm": adj_p_holm[1],
                "supported": adj_p_fdr[1] < 0.05,
            },
            "H2_P3_vs_B1_Clearance": {
                **h2_wilcoxon_p3_vs_b1,
                "p_value_fdr": adj_p_fdr[2],
                "p_value_holm": adj_p_holm[2],
                "supported": adj_p_fdr[2] < 0.05,
            },
            "H2_P3_vs_B2_Clearance": {
                **h2_wilcoxon_p3_vs_b2,
                "p_value_fdr": adj_p_fdr[3],
                "p_value_holm": adj_p_holm[3],
                "supported": adj_p_fdr[3] < 0.05,
            },
            "H3_P3_vs_B1_Smoothness": {
                **h3_wilcoxon_jerk,
                "p_value_fdr": adj_p_fdr[4],
                "p_value_holm": adj_p_holm[4],
                "supported": adj_p_fdr[4] < 0.05,
            },
            "H4_RealTime_Latency": {
                "p95_latency_ms": p3_p95_overall,
                "budget_threshold_ms": 20.0,
                "supported": h4_passed,
            },
        }

        # 3. Failure Taxonomy Audit
        all_events: List[FailureEvent] = []
        for planner_id, runs in runs_by_planner.items():
            for r in runs:
                events = FailureTaxonomyClassifier.classify_run(r)
                all_events.extend(events)

        taxonomy_table = FailureTaxonomyClassifier.generate_frequency_table(all_events)

        # 4. Sensitivity Boundary Sweep
        sensitivity_engine = SensitivityAnalysisEngine()
        sensitivity_results = sensitivity_engine.run_all_sweeps()

        # 5. Parameter Freeze Proof
        freeze_proof = get_parameter_freeze_hash()

        return {
            "summary_table": summary_table,
            "hypotheses_testing": hypotheses_results,
            "failure_taxonomy": taxonomy_table,
            "sensitivity_analysis": sensitivity_results,
            "freeze_proof": freeze_proof,
        }
