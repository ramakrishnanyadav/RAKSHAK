"""
C2: High-Precision Latency Benchmark of All Eight Planners.
Workload: Scenario 1 (SCENARIO_1_VILLAGE_ROAD, seed 1001, frozen_test split).
Active dynamic agents: 2 | Tracked agents with conformal cones: 1 | Static obstacles: 2.
Measurement: time.perf_counter_ns | 50 warmup (discarded) | 1000 timed iterations.
Outputs raw samples to CSV and computes summary statistics.
"""

import time
import csv
import math
import numpy as np
from pathlib import Path

from engine.scenarios.registry import build_scenario
from engine.planners import create_planner
from engine.prediction.predictor import NonLaneMultiHypothesisPredictor
from engine.apath_log.schema import AgentTrack

eval_dir = Path("evaluation")
eval_dir.mkdir(parents=True, exist_ok=True)
raw_csv_path = eval_dir / "planner_latency_raw_samples.csv"

SCENARIO_ID = "SCENARIO_1_VILLAGE_ROAD"
SEED = 1001
SPLIT = "frozen_test"

# 1. Setup realistic environment
world, ego, sc_cfg = build_scenario(SCENARIO_ID, SEED, SPLIT)
world.step(0.05)
perceived = world.perceive(ego.x, ego.y, ego.yaw)

calib_file = Path("engine/ml/models/conformal_tables.json")
predictor = NonLaneMultiHypothesisPredictor(
    horizon_s=2.8,
    dt=0.2,
    calibration_path=str(calib_file) if calib_file.exists() else None,
)

agent_tracks = []
for item in perceived:
    ag = item["agent"]
    hypotheses, conformal_envelope = predictor.predict(
        class_name=ag.class_name,
        x=item["measured_x"],
        y=item["measured_y"],
        yaw=item["measured_yaw"],
        vx=item["measured_vx"],
        vy=item["measured_vy"],
        observed_intent=ag.intent,
        length=ag.profile.length,
        width=ag.profile.width,
    )
    track = AgentTrack(
        id=ag.id,
        class_name=ag.class_name,
        x=round(item["measured_x"], 3),
        y=round(item["measured_y"], 3),
        yaw=round(item["measured_yaw"], 3),
        v_x=round(item["measured_vx"], 3),
        v_y=round(item["measured_vy"], 3),
        length=ag.profile.length,
        width=ag.profile.width,
        is_occluded=False,
        confidence=0.92,
        history_len=5,
        prediction_hypotheses=hypotheses,
        conformal_envelope=conformal_envelope,
    )
    agent_tracks.append(track)

planners_to_test = ["B0", "B1", "B2", "P1", "P2", "P3", "P2-ML", "P3-ML"]

print(f"=== LATENCY BENCHMARK: ALL EIGHT PLANNERS ===")
print(f"Workload Scenario: {SCENARIO_ID} ({sc_cfg.name}) | Seed: {SEED} | Split: {SPLIT}")
print(f"Dynamic Agents: {len(world.dynamic_agents)} | Perceived & Tracked: {len(agent_tracks)} | Static Obstacles: {len(world.static_obstacles)}")
print(f"Hardware Timer: time.perf_counter_ns | 50 warmup + 1000 timed measurements per planner\n")

raw_records = {pid: [] for pid in planners_to_test}
summary_stats = {}

for pid in planners_to_test:
    planner = create_planner(pid)
    planner.reset()

    # Warmup
    for _ in range(50):
        planner.step(ego=ego, world=world, visible_agents=agent_tracks, dt=0.05, current_time=0.05)

    # 1000 timed runs
    for i in range(1000):
        t0 = time.perf_counter_ns()
        planner.step(ego=ego, world=world, visible_agents=agent_tracks, dt=0.05, current_time=0.05 + i * 0.05)
        t1 = time.perf_counter_ns()
        raw_records[pid].append((t1 - t0) / 1e6) # convert ns to ms

    arr = np.array(raw_records[pid], dtype=np.float64)
    summary_stats[pid] = {
        "mean": float(np.mean(arr)),
        "p50": float(np.percentile(arr, 50)),
        "p95": float(np.percentile(arr, 95)),
        "p99": float(np.percentile(arr, 99)),
        "max": float(np.max(arr)),
    }
    s = summary_stats[pid]
    print(f"Planner {pid:6s} | Mean: {s['mean']:6.3f} ms | P50: {s['p50']:6.3f} ms | P95: {s['p95']:6.3f} ms | P99: {s['p99']:6.3f} ms | Max: {s['max']:6.3f} ms")

# Save raw samples to CSV
with open(raw_csv_path, "w", newline="", encoding="utf-8") as f:
    writer = csv.writer(f)
    writer.writerow(["sample_idx"] + planners_to_test)
    for i in range(1000):
        row = [i + 1] + [raw_records[pid][i] for pid in planners_to_test]
        writer.writerow(row)

print(f"\nRaw latency samples saved successfully to: {raw_csv_path}")

