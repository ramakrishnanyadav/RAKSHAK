#!/usr/bin/env python3
"""
Authoritative Classification of All Collision Episodes in Validation B (val_b).

Classifies each collision episode as:
- 'CONTACT' (actor or static obstacle collision, min_clearance_m == 0.00)
- 'ROAD_EDGE_EXCURSION' (road shoulder / corridor limit exceeded, min_clearance_m > 0.00 and |y| > 4.70m)
- 'OTHER'

Outputs: runs/val_b_collision_classification.sidecar.json
"""

import sys
import json
from pathlib import Path
from datetime import datetime, timezone

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

def generate_collision_sidecar():
    manifest_path = PROJECT_ROOT / "runs" / "val_b_manifest.json"
    with open(manifest_path, "r", encoding="utf-8") as f:
        manifest = json.load(f)

    episodes_classified = []
    summary = {}

    for cfg_name, cfg_data in manifest["configurations"].items():
        summary[cfg_name] = {
            "total_collisions": 0,
            "contact": 0,
            "road_edge_excursion": 0,
            "other": 0,
            "by_scenario": {},
        }
        for sc_id, sc_data in cfg_data["scenario_breakdown"].items():
            summary[cfg_name]["by_scenario"][sc_id] = {
                "total_collisions": 0,
                "contact": 0,
                "road_edge_excursion": 0,
                "other": 0,
            }
            for ep in sc_data["episodes"]:
                if not ep["collision_occurred"]:
                    continue

                seed = ep["seed"]
                clr = ep["min_clearance_m"]
                dur = ep["duration_s"]

                if clr == 0.0:
                    cls = "CONTACT"
                    detail = "Physical intersection with dynamic agent or static obstacle (min_clearance == 0.00 m)"
                    summary[cfg_name]["contact"] += 1
                    summary[cfg_name]["by_scenario"][sc_id]["contact"] += 1
                elif clr > 0.0:
                    cls = "ROAD_EDGE_EXCURSION"
                    detail = f"Ego bounding box breached road edge (|y| > 4.70 m) with obstacle clearance {clr:.2f} m"
                    summary[cfg_name]["road_edge_excursion"] += 1
                    summary[cfg_name]["by_scenario"][sc_id]["road_edge_excursion"] += 1
                else:
                    cls = "OTHER"
                    detail = "Unclassified termination"
                    summary[cfg_name]["other"] += 1
                    summary[cfg_name]["by_scenario"][sc_id]["other"] += 1

                summary[cfg_name]["total_collisions"] += 1
                summary[cfg_name]["by_scenario"][sc_id]["total_collisions"] += 1

                episodes_classified.append({
                    "config_name": cfg_name,
                    "planner_id": cfg_data["planner_id"],
                    "scenario_id": sc_id,
                    "seed": seed,
                    "duration_s": dur,
                    "min_clearance_m": clr,
                    "classification": cls,
                    "detail": detail,
                })

    sidecar = {
        "provenance": {
            "source": "runs/val_b_manifest.json and engine runner/metrics geometry",
            "evidence_level": "DERIVED",
            "rule": "min_clearance_m == 0.00 -> CONTACT (SAT polygon intersection with obstacle/agent); min_clearance_m > 0.00 -> ROAD_EDGE_EXCURSION (|y| > 4.70 m shoulder exceedance)",
            "generated_at": datetime.now(timezone.utc).isoformat(),
        },
        "summary": summary,
        "episodes": episodes_classified,
    }

    out_path = PROJECT_ROOT / "runs" / "val_b_collision_classification.sidecar.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(sidecar, f, indent=2)

    print(f"Written sidecar to {out_path}")
    print(json.dumps(summary, indent=2))

if __name__ == "__main__":
    generate_collision_sidecar()
