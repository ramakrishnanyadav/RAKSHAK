#!/usr/bin/env python3
"""
Phase 2: Build Curated Demo Pair and Authoritative Clearance Sidecars.

Requirements:
1. Calls unmodified engine SimulationRunner to generate the curated demo pair for SCENARIO_5_CATTLE_CROSSING
   on Seed 2005 (the first val_b seed with both P3 and B1 runs).
2. Verifies exact metric parity against runs/val_b_manifest.json.
3. Computes per-frame clearance using authoritative geometry code in engine/metrics.py (SAT polygon-polygon).
4. Emits sidecar files with strict "DERIVED" provenance tagging.
"""

import json
import math
import sys
import subprocess
from pathlib import Path

# Ensure repo root is on sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from engine.runner import SimulationRunner
from engine.metrics import (
    get_oriented_box_corners,
    sat_polygons_intersect,
    polygon_polygon_clearance,
)


def get_git_commit() -> str:
    try:
        res = subprocess.run(["git", "rev-parse", "HEAD"], capture_output=True, text=True, check=True)
        return res.stdout.strip()
    except Exception:
        return "UNKNOWN_COMMIT"


def compute_per_frame_clearance(run_log_dict: dict, source_file: str, git_commit: str) -> dict:
    """
    Authoritative clearance calculation:
    Calls engine/metrics geometry functions for every frame.
    Returns DERIVED sidecar structure.
    """
    frames = run_log_dict.get("frames", [])
    sidecar_frames = []

    ego_l = 4.20
    ego_w = 1.80
    road_y_bound = 4.70

    for f in frames:
        step = f.get("step", 0)
        t = f.get("t", 0.0)
        ego = f.get("ego", {})
        ego_x = ego.get("x", 0.0)
        ego_y = ego.get("y", 0.0)
        ego_yaw = ego.get("yaw", 0.0)

        ego_poly = get_oriented_box_corners(ego_x, ego_y, ego_yaw, ego_l, ego_w)

        frame_min_clearance = float("inf")
        closest_hazard = "road_boundary"
        closest_type = "ROAD_EDGE"

        # 1. Road boundaries
        for cx, cy in ego_poly:
            if abs(cy) > road_y_bound:
                frame_min_clearance = 0.0
                closest_hazard = "road_boundary_exceeded"
                closest_type = "BOUNDARY_COLLISION"

            d_left = road_y_bound - cy
            d_right = cy - (-road_y_bound)
            if d_left < frame_min_clearance:
                frame_min_clearance = d_left
                closest_hazard = "road_left_edge"
                closest_type = "ROAD_EDGE"
            if d_right < frame_min_clearance:
                frame_min_clearance = d_right
                closest_hazard = "road_right_edge"
                closest_type = "ROAD_EDGE"

        # 2. Dynamic agents
        for ag in f.get("agents", []):
            ag_id = ag.get("id", "unknown")
            ag_l = ag.get("length") or 2.0
            ag_w = ag.get("width") or 1.0
            ag_poly = get_oriented_box_corners(
                ag.get("x", 0.0), ag.get("y", 0.0), ag.get("yaw", 0.0), ag_l, ag_w
            )

            if sat_polygons_intersect(ego_poly, ag_poly):
                frame_min_clearance = 0.0
                closest_hazard = ag_id
                closest_type = "ACTOR_COLLISION"
                break
            else:
                d_ag = polygon_polygon_clearance(ego_poly, ag_poly)
                if d_ag < frame_min_clearance:
                    frame_min_clearance = d_ag
                    closest_hazard = ag_id
                    closest_type = "DYNAMIC_ACTOR"

        sidecar_frames.append({
            "step": step,
            "t": t,
            "min_clearance_m": round(frame_min_clearance, 3),
            "closest_hazard_id": closest_hazard,
            "hazard_type": closest_type,
        })

    return {
        "provenance": {
            "type": "DERIVED",
            "calculation": "Per-frame SAT polygon-polygon minimum clearance to all obstacles and road bounds.",
            "source_script": "scripts/build_curated_demo.py",
            "source_geometry_module": "engine.metrics",
            "source_run_log": source_file,
            "git_commit": git_commit,
        },
        "frames": sidecar_frames,
    }


def main():
    print("=" * 70)
    print("PHASE 2: CURATED DEMO GENERATION AND REPRODUCTION VERIFICATION")
    print("=" * 70)

    curated_dir = Path("storage/runs/curated_demo")
    curated_dir.mkdir(parents=True, exist_ok=True)

    git_commit = get_git_commit()
    print(f"Base Git Commit: {git_commit}")

    # Load ground truth from val_b_manifest.json
    with open("runs/val_b_manifest.json", "r", encoding="utf-8") as f:
        vb = json.load(f)

    vb_p3_cattle = [
        e for e in vb["configurations"]["P3_Corrected"]["scenario_breakdown"]["SCENARIO_5_CATTLE_CROSSING"]["episodes"]
        if e["seed"] == 2005
    ][0]
    vb_b1_cattle = [
        e for e in vb["configurations"]["B1_Baseline"]["scenario_breakdown"]["SCENARIO_5_CATTLE_CROSSING"]["episodes"]
        if e["seed"] == 2005
    ][0]

    runner = SimulationRunner(dt=0.1)

    # 1. Run P3 on SCENARIO_5_CATTLE_CROSSING, seed 2005
    print("\n[1/4] Running unmodified engine for P3 Corrected (Seed 2005)...")
    log_p3 = runner.run("SCENARIO_5_CATTLE_CROSSING", "P3", seed=2005, split="val_b")
    m_p3 = log_p3.metrics

    print(f"  P3 Result -> duration: {m_p3.duration_s}s, goal: {m_p3.completed_goal}, "
          f"collision: {m_p3.collision_occurred}, min_clr: {m_p3.min_clearance_m}m, replans: {m_p3.replan_count}")
    print(f"  Manifest  -> duration: {vb_p3_cattle['duration_s']}s, goal: {vb_p3_cattle['completed_goal']}, "
          f"collision: {vb_p3_cattle['collision_occurred']}, min_clr: {vb_p3_cattle['min_clearance_m']}m")

    # Strict assertion
    assert m_p3.completed_goal == vb_p3_cattle["completed_goal"], "P3 completed_goal mismatch!"
    assert m_p3.collision_occurred == vb_p3_cattle["collision_occurred"], "P3 collision_occurred mismatch!"
    assert m_p3.duration_s == vb_p3_cattle["duration_s"], "P3 duration mismatch!"
    assert m_p3.min_clearance_m == vb_p3_cattle["min_clearance_m"], "P3 min_clearance mismatch!"
    print("  => VERIFICATION PASSED: P3 bit-for-bit reproduces val_b_manifest.json.")

    # 2. Run B1 on SCENARIO_5_CATTLE_CROSSING, seed 2005
    print("\n[2/4] Running unmodified engine for B1 Baseline (Seed 2005)...")
    log_b1 = runner.run("SCENARIO_5_CATTLE_CROSSING", "B1", seed=2005, split="val_b")
    m_b1 = log_b1.metrics

    print(f"  B1 Result -> duration: {m_b1.duration_s}s, goal: {m_b1.completed_goal}, "
          f"collision: {m_b1.collision_occurred}, min_clr: {m_b1.min_clearance_m}m, replans: {m_b1.replan_count}")
    print(f"  Manifest  -> duration: {vb_b1_cattle['duration_s']}s, goal: {vb_b1_cattle['completed_goal']}, "
          f"collision: {vb_b1_cattle['collision_occurred']}, min_clr: {vb_b1_cattle['min_clearance_m']}m")

    # Strict assertion
    assert m_b1.completed_goal == vb_b1_cattle["completed_goal"], "B1 completed_goal mismatch!"
    assert m_b1.collision_occurred == vb_b1_cattle["collision_occurred"], "B1 collision_occurred mismatch!"
    assert m_b1.duration_s == vb_b1_cattle["duration_s"], "B1 duration mismatch!"
    assert m_b1.min_clearance_m == vb_b1_cattle["min_clearance_m"], "B1 min_clearance mismatch!"
    print("  => VERIFICATION PASSED: B1 bit-for-bit reproduces val_b_manifest.json.")

    # 3. Save full RunLogs to storage/runs/curated_demo/
    print("\n[3/4] Writing curated RunLogs...")
    p3_path = curated_dir / "run_scenario_5_cattle_crossing_p3_val_b_s2005.json"
    b1_path = curated_dir / "run_scenario_5_cattle_crossing_b1_val_b_s2005.json"

    p3_dict = log_p3.model_dump()
    p3_dict["provenance_badge"] = "Newly generated demonstration run (tuning seed)"
    p3_dict["evaluation_split"] = "Validation B (Tuning Split, post-tuning evidence, not a clean held-out test)"

    b1_dict = log_b1.model_dump()
    b1_dict["provenance_badge"] = "Newly generated demonstration run (tuning seed)"
    b1_dict["evaluation_split"] = "Validation B (Tuning Split, post-tuning evidence, not a clean held-out test)"

    with open(p3_path, "w", encoding="utf-8") as f:
        json.dump(p3_dict, f, indent=2)
    print(f"  Saved P3 RunLog: {p3_path} ({p3_path.stat().st_size} bytes)")

    with open(b1_path, "w", encoding="utf-8") as f:
        json.dump(b1_dict, f, indent=2)
    print(f"  Saved B1 RunLog: {b1_path} ({b1_path.stat().st_size} bytes)")

    # 4. Generate Authoritative Clearance Sidecars
    print("\n[4/4] Computing authoritative per-frame clearance sidecars (DERIVED)...")
    p3_sidecar = compute_per_frame_clearance(p3_dict, str(p3_path), git_commit)
    p3_sidecar_path = curated_dir / "run_scenario_5_cattle_crossing_p3_val_b_s2005.clearance.json"
    with open(p3_sidecar_path, "w", encoding="utf-8") as f:
        json.dump(p3_sidecar, f, indent=2)
    print(f"  Saved P3 clearance sidecar: {p3_sidecar_path} ({len(p3_sidecar['frames'])} frames)")

    b1_sidecar = compute_per_frame_clearance(b1_dict, str(b1_path), git_commit)
    b1_sidecar_path = curated_dir / "run_scenario_5_cattle_crossing_b1_val_b_s2005.clearance.json"
    with open(b1_sidecar_path, "w", encoding="utf-8") as f:
        json.dump(b1_sidecar, f, indent=2)
    print(f"  Saved B1 clearance sidecar: {b1_sidecar_path} ({len(b1_sidecar['frames'])} frames)")

    # Also compute clearance sidecar for illustrative failure replay (seed 1000)
    seed1000_p3_path = Path("storage/runs/run_scenario_5_cattle_crossing_p3_tune_s1000.json")
    seed1000_b2_path = Path("storage/runs/run_scenario_5_cattle_crossing_b2_tune_s1000.json")

    if seed1000_p3_path.exists() and seed1000_b2_path.exists():
        with open(seed1000_p3_path, "r", encoding="utf-8") as f:
            p3_1000_dict = json.load(f)
        s1000_p3_sidecar = compute_per_frame_clearance(p3_1000_dict, str(seed1000_p3_path), git_commit)
        with open(curated_dir / "run_scenario_5_cattle_crossing_p3_tune_s1000.clearance.json", "w", encoding="utf-8") as f:
            json.dump(s1000_p3_sidecar, f, indent=2)

        with open(seed1000_b2_path, "r", encoding="utf-8") as f:
            b2_1000_dict = json.load(f)
        s1000_b2_sidecar = compute_per_frame_clearance(b2_1000_dict, str(seed1000_b2_path), git_commit)
        with open(curated_dir / "run_scenario_5_cattle_crossing_b2_tune_s1000.clearance.json", "w", encoding="utf-8") as f:
            json.dump(s1000_b2_sidecar, f, indent=2)
        print("  Saved Illustrative Paired Failure (Seed 1000 B2 vs P3) clearance sidecars.")

    print("\nPhase 2 generation and verification complete successfully.")


if __name__ == "__main__":
    main()
