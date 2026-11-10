#!/usr/bin/env python3
"""
Authoritative Frame-Level Re-classification of All 25 Validation B Collision Episodes.

Re-runs each collision episode through the unmodified engine SimulationRunner.
For every step, tests:
  1. SAT polygon-polygon intersection against all dynamic agents and static obstacles.
  2. Road scoring corridor boundary containment (any ego corner |y| > 4.70 m).

Records:
  - first SAT contact step and time (if any)
  - first |y| > 4.70 m corridor excursion step and time (if any)
  - has_both flag (episodes with both contact and corridor excursion)
  - primary cause (whichever occurred first, or the single cause)

Outputs: runs/val_b_collision_classification.sidecar.json
"""

import sys
import json
import math
from pathlib import Path
from datetime import datetime, timezone

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from engine.runner import SimulationRunner
from engine.simulation.vehicle import KinematicBicycleModel
from engine.metrics import get_oriented_box_corners, sat_polygons_intersect, polygon_polygon_clearance
from engine.scenarios.registry import build_scenario

def reclassify_from_frames():
    manifest_path = PROJECT_ROOT / "runs" / "val_b_manifest.json"
    with open(manifest_path, "r", encoding="utf-8") as f:
        manifest = json.load(f)

    runner = SimulationRunner(dt=0.1)

    configs = {
        "P3_Corrected": {
            "planner_id": "P3",
            "params": {"w_stall": 4.00, "w_prog": 2.20, "t_grace": 1.00, "gamma": 1.50, "J_stall_max": 5.00},
        },
        "P3_Baseline": {
            "planner_id": "P3",
            "params": {"w_stall": 0.00, "w_prog": 2.20},
        },
        "B1_Baseline": {
            "planner_id": "B1",
            "params": {},
        },
    }

    road_y_bound = 4.70
    ego_l = 4.20
    ego_w = 1.80

    episodes_classified = []
    summary = {}

    for cfg_name, cfg in configs.items():
        planner_id = cfg["planner_id"]
        params = cfg["params"]

        summary[cfg_name] = {
            "total_collisions": 0,
            "contact_only": 0,
            "corridor_excursion_only": 0,
            "both_contact_and_excursion": 0,
            "by_scenario": {},
        }

        for sc_id, sc_data in manifest["configurations"][cfg_name]["scenario_breakdown"].items():
            summary[cfg_name]["by_scenario"][sc_id] = {
                "total_collisions": 0,
                "contact_only": 0,
                "corridor_excursion_only": 0,
                "both_contact_and_excursion": 0,
            }

            for ep in sc_data["episodes"]:
                seed = ep["seed"]
                if not ep["collision_occurred"]:
                    continue

                summary[cfg_name]["total_collisions"] += 1
                summary[cfg_name]["by_scenario"][sc_id]["total_collisions"] += 1

                # Re-run episode deterministically
                log = runner.run(
                    scenario_id=sc_id,
                    planner_id=planner_id,
                    seed=seed,
                    split="val_b",
                    custom_params=params,
                )

                world, _, _ = build_scenario(sc_id, seed, "val_b", params)

                first_sat_step = None
                first_sat_t = None
                first_sat_target = None

                first_excursion_step = None
                first_excursion_t = None
                first_excursion_max_y = None

                # Check every frame
                for f in log.frames:
                    ego_poly = KinematicBicycleModel.get_bounding_box(f.ego.x, f.ego.y, f.ego.yaw, ego_l, ego_w)

                    # 1. SAT checks against static obstacles
                    for obj in world.static_obstacles:
                        obj_poly = KinematicBicycleModel.get_bounding_box(obj.x, obj.y, getattr(obj, "yaw", 0.0), obj.length, obj.width)
                        dist = KinematicBicycleModel.min_distance_polygons(ego_poly, obj_poly)
                        if dist == 0.0 and first_sat_step is None:
                            first_sat_step = f.step
                            first_sat_t = f.t
                            first_sat_target = f"static_obstacle:{obj.id}"

                    # 2. SAT checks against dynamic agents
                    for ag in f.agents:
                        ag_l = ag.length if ag.length and ag.length > 0 else 2.0
                        ag_w = ag.width if ag.width and ag.width > 0 else 1.0
                        ag_poly = KinematicBicycleModel.get_bounding_box(ag.x, ag.y, ag.yaw, ag_l, ag_w)
                        dist = KinematicBicycleModel.min_distance_polygons(ego_poly, ag_poly)
                        if dist == 0.0 and first_sat_step is None:
                            first_sat_step = f.step
                            first_sat_t = f.t
                            first_sat_target = f"agent:{ag.id}({ag.class_name})"

                    # 3. Corridor boundary check (|y| > 4.70 m)
                    max_abs_y = max(abs(cy) for cx, cy in ego_poly)
                    if max_abs_y > road_y_bound and first_excursion_step is None:
                        first_excursion_step = f.step
                        first_excursion_t = f.t
                        first_excursion_max_y = round(max_abs_y, 3)

                # Note: if there is no SAT contact anywhere in the run, and min_clearance_m is 0.0
                # solely because compute_frame_metrics sets min_clearance = 0.0 on corridor excursion,
                # do NOT mistake that for physical contact.
                # A terminal SAT contact only occurs if the terminal vehicle state actually intersects an object.

                has_both = bool(first_sat_step is not None and first_excursion_step is not None)

                if has_both:
                    summary[cfg_name]["both_contact_and_excursion"] += 1
                    summary[cfg_name]["by_scenario"][sc_id]["both_contact_and_excursion"] += 1
                    if first_sat_step < first_excursion_step:
                        primary_cause = "CONTACT_PRECEDED_EXCURSION"
                    elif first_excursion_step < first_sat_step:
                        primary_cause = "EXCURSION_PRECEDED_CONTACT"
                    else:
                        primary_cause = "SIMULTANEOUS_CONTACT_AND_EXCURSION"
                elif first_sat_step is not None:
                    summary[cfg_name]["contact_only"] += 1
                    summary[cfg_name]["by_scenario"][sc_id]["contact_only"] += 1
                    primary_cause = "CONTACT_ONLY"
                elif first_excursion_step is not None:
                    summary[cfg_name]["corridor_excursion_only"] += 1
                    summary[cfg_name]["by_scenario"][sc_id]["corridor_excursion_only"] += 1
                    primary_cause = "CORRIDOR_EXCURSION_ONLY"
                else:
                    primary_cause = "OTHER"

                record = {
                    "config_name": cfg_name,
                    "planner_id": planner_id,
                    "scenario_id": sc_id,
                    "seed": seed,
                    "duration_s": round(log.metrics.duration_s, 2),
                    "min_clearance_m": round(log.metrics.min_clearance_m, 2),
                    "first_sat_contact": {
                        "occurred": bool(first_sat_step is not None),
                        "step": first_sat_step,
                        "time_s": first_sat_t,
                        "target": first_sat_target,
                    },
                    "first_corridor_excursion": {
                        "occurred": bool(first_excursion_step is not None),
                        "step": first_excursion_step,
                        "time_s": first_excursion_t,
                        "max_abs_y_m": first_excursion_max_y,
                    },
                    "has_both": has_both,
                    "primary_cause": primary_cause,
                    "label": (
                        "Contact with actor or obstacle"
                        if primary_cause in ("CONTACT_ONLY", "CONTACT_PRECEDED_EXCURSION")
                        else "Left the 4.70 m scoring corridor"
                    ),
                }
                episodes_classified.append(record)
                both_flag = " [BOTH CONTACT & EXCURSION]" if has_both else ""
                print(f"[{cfg_name}] {sc_id} Seed {seed}: {primary_cause}{both_flag} (SAT={first_sat_t}s, Excursion={first_excursion_t}s)")

    sidecar = {
        "provenance": {
            "source": "Unmodified engine simulation re-run on all 25 val_b collision episodes",
            "evidence_level": "DERIVED",
            "scoring_corridor_half_width_m": road_y_bound,
            "generated_at": datetime.now(timezone.utc).isoformat(),
        },
        "summary": summary,
        "episodes": episodes_classified,
    }

    out_path = PROJECT_ROOT / "runs" / "val_b_collision_classification.sidecar.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(sidecar, f, indent=2)

    print(f"\nWritten sidecar to {out_path}")
    print("\n=== SUMMARY ===")
    print(json.dumps(summary, indent=2))

if __name__ == "__main__":
    reclassify_from_frames()

