"""
Validation B Experiment Script for Phase 1 Step 3B.
Executes the approved Validation B protocol (Seeds 2005-2009 across all 5 scenarios = 25 episodes).
Runs:
  1. P3 (Corrected): w_stall=4.00 (approved default)
  2. P3 (Baseline / Ablation): w_stall=0.00 (no stationary persistence penalty)
  3. B1: Classical DWA-VO baseline

Generates runs/val_b_manifest.json with full per-episode and aggregate metrics.
"""

import sys
import os
import json
import time
import subprocess
from pathlib import Path
from datetime import datetime, timezone
import numpy as np

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from engine.runner import SimulationRunner
from engine.scenarios.registry import get_seeds_for_split, SCENARIOS_CATALOG


def get_git_commit() -> str:
    try:
        res = subprocess.run(["git", "rev-parse", "HEAD"], capture_output=True, text=True, check=True)
        return res.stdout.strip()
    except Exception:
        return "unknown"


def analyze_episode(log, runner) -> dict:
    m = log.metrics
    mrm_states = {"EMERGENCY_BRAKE", "PULL_OVER"}
    mrm_activations = 0
    mrm_recoveries = 0
    in_mrm = False
    stopped_duration = 0.0

    latencies = [f.planner_output.latency_ms for f in log.frames if f.planner_output.latency_ms > 0]
    mean_lat = round(float(np.mean(latencies)), 2) if latencies else 0.0
    p95_lat = m.p95_latency_ms

    for f in log.frames:
        if f.ego.v < 0.20:
            stopped_duration += 0.1
        curr_mrm = f.ego.active_state in mrm_states
        if curr_mrm and not in_mrm:
            mrm_activations += 1
            in_mrm = True
        elif not curr_mrm and in_mrm:
            mrm_recoveries += 1
            in_mrm = False

    rejections = getattr(runner.last_planner, "rejection_counts", {})
    rejections_copy = dict(rejections) if rejections else {}

    safe_progress = bool(m.completed_goal and not m.collision_occurred)

    return {
        "scenario_id": log.scenario.id,
        "seed": log.scenario.seed,
        "planner_id": log.planner.id,
        "duration_s": round(m.duration_s, 2),
        "completed_goal": m.completed_goal,
        "collision_occurred": m.collision_occurred,
        "safe_progress": safe_progress,
        "near_miss_count": m.near_miss_count,
        "min_clearance_m": round(m.min_clearance_m, 2),
        "mean_jerk_m_s3": round(m.mean_jerk_m_s3, 3),
        "max_jerk_m_s3": round(m.max_jerk_m_s3, 3),
        "stopped_duration_s": round(stopped_duration, 2),
        "mrm_activations": mrm_activations,
        "mrm_recoveries": mrm_recoveries,
        "replan_count": m.replan_count,
        "p95_latency_ms": p95_lat,
        "mean_latency_ms": mean_lat,
        "rejection_reasons": rejections_copy,
    }


def aggregate_metrics(episodes: list) -> dict:
    n = len(episodes)
    if n == 0:
        return {}
    
    safe_prog_rate = sum(1 for e in episodes if e["safe_progress"]) / n
    collision_rate = sum(1 for e in episodes if e["collision_occurred"]) / n
    goal_completion_rate = sum(1 for e in episodes if e["completed_goal"]) / n
    total_near_misses = sum(e["near_miss_count"] for e in episodes)
    min_clearance_overall = min(e["min_clearance_m"] for e in episodes)
    mean_clearance = round(float(np.mean([e["min_clearance_m"] for e in episodes])), 2)
    mean_jerk = round(float(np.mean([e["mean_jerk_m_s3"] for e in episodes])), 3)
    max_jerk = round(float(np.max([e["max_jerk_m_s3"] for e in episodes])), 3)
    mean_stopped_duration = round(float(np.mean([e["stopped_duration_s"] for e in episodes])), 2)
    total_mrm_activations = sum(e["mrm_activations"] for e in episodes)
    total_mrm_recoveries = sum(e["mrm_recoveries"] for e in episodes)
    mean_p95_lat = round(float(np.mean([e["p95_latency_ms"] for e in episodes])), 2)
    mean_lat = round(float(np.mean([e["mean_latency_ms"] for e in episodes])), 2)

    total_rejections = {}
    for e in episodes:
        for k, v in e["rejection_reasons"].items():
            total_rejections[k] = total_rejections.get(k, 0) + v

    return {
        "episode_count": n,
        "safe_progress_rate": round(safe_prog_rate, 3),
        "collision_rate": round(collision_rate, 3),
        "goal_completion_rate": round(goal_completion_rate, 3),
        "total_near_misses": total_near_misses,
        "min_clearance_overall_m": min_clearance_overall,
        "mean_min_clearance_m": mean_clearance,
        "mean_jerk_m_s3": mean_jerk,
        "max_jerk_m_s3": max_jerk,
        "mean_stopped_duration_s": mean_stopped_duration,
        "total_mrm_activations": total_mrm_activations,
        "total_mrm_recoveries": total_mrm_recoveries,
        "mean_p95_latency_ms": mean_p95_lat,
        "mean_latency_ms": mean_lat,
        "total_candidate_rejections": total_rejections,
    }


def run_val_b_experiments():
    seeds = get_seeds_for_split("val_b") # 2005 to 2009 (5 seeds)
    scenarios = [
        "SCENARIO_1_VILLAGE_ROAD",
        "SCENARIO_2_URBAN_INTERSECTION",
        "SCENARIO_3_HIGHWAY_MERGE",
        "SCENARIO_4_DENSE_MARKET",
        "SCENARIO_5_CATTLE_CROSSING",
    ]
    
    experiment_configs = [
        {
            "name": "P3_Corrected",
            "planner_id": "P3",
            "params": {"w_stall": 4.00, "w_prog": 2.20, "t_grace": 1.00, "gamma": 1.50, "J_stall_max": 5.00},
            "description": "P3 Adaptive Planner with F3 stationary persistence penalty, SAT occupancy check, and uncalibrated risk dilation removed.",
        },
        {
            "name": "P3_Baseline",
            "planner_id": "P3",
            "params": {"w_stall": 0.00, "w_prog": 2.20},
            "description": "P3 Baseline ablation with w_stall=0.00 (exhibits F3 stationary livelock under corridor blockade).",
        },
        {
            "name": "B1_Baseline",
            "planner_id": "B1",
            "params": {},
            "description": "B1 Classical Dynamic Window Approach + Velocity Obstacles (DWA-VO).",
        },
    ]

    runner = SimulationRunner(dt=0.1)
    runs_dir = PROJECT_ROOT / "runs"
    runs_dir.mkdir(exist_ok=True)

    git_commit = get_git_commit()
    timestamp = datetime.now(timezone.utc).isoformat()

    manifest = {
        "metadata": {
            "title": "Phase 1 Step 3B - Validation B Benchmark Manifest",
            "git_commit": git_commit,
            "timestamp": timestamp,
            "split": "val_b",
            "seeds": seeds,
            "scenarios": scenarios,
            "total_episodes_per_planner": len(seeds) * len(scenarios),
        },
        "configurations": {},
        "comparative_summary": {},
    }

    print(f"=== Starting Validation B Benchmark (Seeds {seeds[0]}-{seeds[-1]}) ===", flush=True)

    for cfg in experiment_configs:
        cfg_name = cfg["name"]
        print(f"\n--- Running Configuration: {cfg_name} ({cfg['planner_id']}) ---", flush=True)
        episodes = []
        scenario_breakdown = {}

        for sc_id in scenarios:
            sc_episodes = []
            for seed in seeds:
                log = runner.run(
                    scenario_id=sc_id,
                    planner_id=cfg["planner_id"],
                    seed=seed,
                    split="val_b",
                    custom_params=cfg["params"],
                )
                ep_data = analyze_episode(log, runner)
                ep_data["config_name"] = cfg_name
                episodes.append(ep_data)
                sc_episodes.append(ep_data)
                print(
                    f"[{cfg_name}] {sc_id} Seed {seed}: goal={ep_data['completed_goal']}, "
                    f"col={ep_data['collision_occurred']}, t={ep_data['duration_s']}s, "
                    f"stop_t={ep_data['stopped_duration_s']}s, d_min={ep_data['min_clearance_m']}m",
                    flush=True,
                )
            scenario_breakdown[sc_id] = {
                "aggregate": aggregate_metrics(sc_episodes),
                "episodes": sc_episodes,
            }

        cfg_agg = aggregate_metrics(episodes)
        manifest["configurations"][cfg_name] = {
            "description": cfg["description"],
            "planner_id": cfg["planner_id"],
            "params": cfg["params"],
            "aggregate": cfg_agg,
            "scenario_breakdown": scenario_breakdown,
            "all_episodes": episodes,
        }

    # Populate comparative summary
    for cfg in experiment_configs:
        name = cfg["name"]
        manifest["comparative_summary"][name] = manifest["configurations"][name]["aggregate"]

    manifest_path = runs_dir / "val_b_manifest.json"
    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2)

    print(f"\n=== Validation B Benchmark Complete. Manifest saved to {manifest_path} ===", flush=True)


if __name__ == "__main__":
    run_val_b_experiments()
