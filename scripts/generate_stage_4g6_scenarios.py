"""
Stage 4G.6: Authentic Simulation Run Generator for 8 Canonical Indian Road Scenarios.
Generates full closed-loop simulation runs with P3 and B1 planners,
complete with structured event timelines, real metrics, and data provenance.
"""

import os
import sys
import json
import shutil

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from engine.runner import SimulationRunner
from engine.scenarios.registry import SCENARIOS_CATALOG
from backend.app.database import SessionLocal
from backend.app.models import RunRecord

SCENARIOS_TO_GENERATE = [
    ("SCENARIO_01_POTHOLE_DAMAGED_ROAD", "01. Pothole & Damaged Road"),
    ("SCENARIO_02_PEDESTRIAN_CROSSING", "02. Child / Pedestrian Crossing"),
    ("SCENARIO_03_DENSE_MIXED_TRAFFIC", "03. Dense Mixed Indian Traffic"),
    ("SCENARIO_04_MOTORCYCLE_CUT_IN", "04. Motorcycle Cut-In"),
    ("SCENARIO_05_UNCONTROLLED_INTERSECTION", "05. Uncontrolled Intersection"),
    ("SCENARIO_06_HIGHWAY_SUDDEN_BRAKING", "06. Highway Sudden Braking"),
    ("SCENARIO_07_ROADWORKS_OBSTRUCTION", "07. Roadworks & Lane Obstruction"),
    ("SCENARIO_08_CATTLE_CROSSING", "08. Sudden Cattle Crossing"),
]

PLANNERS = [
    ("P3", "Planner 3: Risk-Adaptive (Dynamic Trigger + MRM)"),
    ("B1", "Baseline 1: DWA + Velocity Obstacles"),
]


def main():
    runner = SimulationRunner(dt=0.1)
    storage_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "storage", "runs"))
    public_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "studio", "public", "sample_runs"))
    os.makedirs(storage_dir, exist_ok=True)
    os.makedirs(public_dir, exist_ok=True)

    manifest_path = os.path.join(public_dir, "manifest.json")
    if os.path.exists(manifest_path):
        with open(manifest_path, "r", encoding="utf-8") as f:
            manifest = json.load(f)
    else:
        manifest = []

    existing_manifest_ids = {item["id"] for item in manifest}
    db = SessionLocal()

    print("Generating Stage 4G.6 Canonical Scenario Runs...")

    for sc_id, sc_name in SCENARIOS_TO_GENERATE:
        for p_id, p_name in PLANNERS:
            seed = 1000
            run_id = f"run_{sc_id.lower()}_{p_id.lower()}_tune_s{seed}"
            print(f"  -> Simulating {sc_id} with {p_id} (Seed {seed})...")

            run_log = runner.run(scenario_id=sc_id, planner_id=p_id, seed=seed, split="tune")
            run_dict = run_log.model_dump()

            # Save to storage/runs
            out_file = os.path.join(storage_dir, f"{run_id}.json")
            with open(out_file, "w", encoding="utf-8") as f:
                json.dump(run_dict, f, indent=2)

            # Copy to studio/public/sample_runs
            pub_file = os.path.join(public_dir, f"{run_id}.json")
            shutil.copyfile(out_file, pub_file)

            # Update Manifest entry
            manifest_entry = {
                "id": run_id,
                "scenario_id": sc_id,
                "scenario_name": sc_name,
                "planner_id": p_id,
                "planner_name": p_name,
                "seed": seed,
                "collision_occurred": run_dict["metrics"]["collision_occurred"],
                "completed_goal": run_dict["metrics"]["completed_goal"],
                "min_clearance_m": run_dict["metrics"]["min_clearance_m"],
                "mean_speed_m_s": run_dict["metrics"]["mean_speed_m_s"],
                "max_jerk_m_s3": run_dict["metrics"]["max_jerk_m_s3"],
                "mean_jerk_m_s3": run_dict["metrics"]["mean_jerk_m_s3"],
                "replan_count": run_dict["metrics"]["replan_count"],
                "p95_latency_ms": run_dict["metrics"]["p95_latency_ms"],
                "duration_s": run_dict["metrics"]["duration_s"],
                "path_length_m": round(run_dict["metrics"]["duration_s"] * run_dict["metrics"]["mean_speed_m_s"], 2),
                "frame_count": len(run_dict["frames"]),
                "failure_tag": run_dict["metrics"]["failure_tag"],
                "file": f"sample_runs/{run_id}.json",
            }

            if run_id in existing_manifest_ids:
                # Update existing
                for i, item in enumerate(manifest):
                    if item["id"] == run_id:
                        manifest[i] = manifest_entry
                        break
            else:
                manifest.append(manifest_entry)
                existing_manifest_ids.add(run_id)

            # Insert or update in SQLite DB
            m = run_dict["metrics"]
            db_record = db.query(RunRecord).filter(RunRecord.id == run_id).first()
            if not db_record:
                db_record = RunRecord(
                    id=run_id,
                    scenario_id=sc_id,
                    planner_id=p_id,
                    split="tune",
                    seed=seed,
                    engine_adapter="python_reference",
                    status="completed",
                    is_shipped=True,
                    duration_s=m["duration_s"],
                    completed_goal=m["completed_goal"],
                    collision_occurred=m["collision_occurred"],
                    min_clearance_m=m["min_clearance_m"],
                    mean_speed_m_s=m["mean_speed_m_s"],
                    max_jerk_m_s3=m["max_jerk_m_s3"],
                    replan_count=m["replan_count"],
                    p95_latency_ms=m["p95_latency_ms"],
                    failure_tag=m["failure_tag"],
                    log_path=f"storage/runs/{run_id}.json",
                )
                db.add(db_record)
            else:
                db_record.status = "completed"
                db_record.duration_s = m["duration_s"]
                db_record.completed_goal = m["completed_goal"]
                db_record.collision_occurred = m["collision_occurred"]
                db_record.min_clearance_m = m["min_clearance_m"]
                db_record.mean_speed_m_s = m["mean_speed_m_s"]
                db_record.max_jerk_m_s3 = m["max_jerk_m_s3"]
                db_record.replan_count = m["replan_count"]
                db_record.p95_latency_ms = m["p95_latency_ms"]
                db_record.failure_tag = m["failure_tag"]
                db_record.log_path = f"storage/runs/{run_id}.json"

    db.commit()
    db.close()

    # Save manifest.json
    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2)

    print(f"Successfully generated {len(SCENARIOS_TO_GENERATE) * len(PLANNERS)} canonical scenario runs!")
    print(f"Total manifest records: {len(manifest)}")


if __name__ == "__main__":
    main()
