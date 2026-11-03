"""
Generates shipped benchmark runs for all 5 scenarios and registers them in the database
and bundles them in studio/public/sample_runs/ for zero-install offline fallback.
"""

import sys
import os
import json
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from engine.runner import SimulationRunner
from backend.app.database import SessionLocal, Base, engine
from backend.app.models import RunRecord
from backend.app.config import settings

Base.metadata.create_all(bind=engine)


def generate_curated_runs():
    runner = SimulationRunner(dt=0.1)
    db = SessionLocal()

    storage_runs_dir = Path(settings.storage_dir) / "runs"
    storage_runs_dir.mkdir(parents=True, exist_ok=True)

    public_sample_dir = PROJECT_ROOT / "studio" / "public" / "sample_runs"
    public_sample_dir.mkdir(parents=True, exist_ok=True)

    curated_matrix = [
        # (scenario_id, planner_id, seed, split)
        ("SCENARIO_5_CATTLE_CROSSING", "B0", 1000, "tune"),
        ("SCENARIO_5_CATTLE_CROSSING", "B1", 1000, "tune"),
        ("SCENARIO_5_CATTLE_CROSSING", "B2", 1000, "tune"),
        ("SCENARIO_5_CATTLE_CROSSING", "P1", 1000, "tune"),
        ("SCENARIO_5_CATTLE_CROSSING", "P2", 1000, "tune"),
        ("SCENARIO_5_CATTLE_CROSSING", "P3", 1000, "tune"),
        # Other scenarios with B1 vs P3
        ("SCENARIO_1_VILLAGE_ROAD", "B1", 1000, "tune"),
        ("SCENARIO_1_VILLAGE_ROAD", "P3", 1000, "tune"),
        ("SCENARIO_2_URBAN_INTERSECTION", "B1", 1000, "tune"),
        ("SCENARIO_2_URBAN_INTERSECTION", "P3", 1000, "tune"),
        ("SCENARIO_3_HIGHWAY_MERGE", "B1", 1000, "tune"),
        ("SCENARIO_3_HIGHWAY_MERGE", "P3", 1000, "tune"),
        ("SCENARIO_4_DENSE_MARKET", "B1", 1000, "tune"),
        ("SCENARIO_4_DENSE_MARKET", "P3", 1000, "tune"),
    ]

    manifest = []
    print(f"Generating {len(curated_matrix)} curated runs...", flush=True)

    for sc_id, p_id, seed, split in curated_matrix:
        run_id = f"run_{sc_id.lower()}_{p_id.lower()}_{split}_s{seed}"
        print(f"  Generating {run_id}...", flush=True)
        log = runner.run(scenario_id=sc_id, planner_id=p_id, seed=seed, split=split, max_duration_s=12.0)

        # Write to storage/runs/
        log_json = log.model_dump_json(indent=2)
        log_path = storage_runs_dir / f"{run_id}.json"
        with open(log_path, "w", encoding="utf-8") as f:
            f.write(log_json)

        # Also write to studio/public/sample_runs/
        public_path = public_sample_dir / f"{run_id}.json"
        with open(public_path, "w", encoding="utf-8") as f:
            f.write(log_json)

        # Register in DB as shipped run
        m = log.metrics
        existing = db.query(RunRecord).filter(RunRecord.id == run_id).first()
        if not existing:
            rec = RunRecord(
                id=run_id,
                scenario_id=sc_id,
                planner_id=p_id,
                split=split,
                seed=seed,
                status="completed",
                config_hash=log.config_hash,
                is_shipped=True,
                duration_s=m.duration_s,
                completed_goal=m.completed_goal,
                collision_occurred=m.collision_occurred,
                min_clearance_m=m.min_clearance_m,
                mean_speed_m_s=m.mean_speed_m_s,
                max_jerk_m_s3=m.max_jerk_m_s3,
                replan_count=m.replan_count,
                p95_latency_ms=m.p95_latency_ms,
                failure_tag=m.failure_tag,
                log_path=str(log_path.relative_to(settings.storage_dir)),
            )
            db.add(rec)
        else:
            existing.status = "completed"
            existing.is_shipped = True
            existing.duration_s = m.duration_s
            existing.completed_goal = m.completed_goal
            existing.collision_occurred = m.collision_occurred
            existing.min_clearance_m = m.min_clearance_m
            existing.mean_speed_m_s = m.mean_speed_m_s
            existing.max_jerk_m_s3 = m.max_jerk_m_s3
            existing.replan_count = m.replan_count
            existing.p95_latency_ms = m.p95_latency_ms
            existing.failure_tag = m.failure_tag
        db.commit()

        manifest.append({
            "id": run_id,
            "scenario_id": sc_id,
            "scenario_name": log.scenario.name,
            "planner_id": p_id,
            "planner_name": log.planner.name,
            "seed": seed,
            "collision_occurred": m.collision_occurred,
            "min_clearance_m": m.min_clearance_m,
            "mean_jerk_m_s3": m.mean_jerk_m_s3,
            "p95_latency_ms": m.p95_latency_ms,
            "file": f"sample_runs/{run_id}.json",
        })

    # Write manifest.json to studio/public/sample_runs/manifest.json
    with open(public_sample_dir / "manifest.json", "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2)

    db.close()
    print("Done! Shipped runs generated and registered successfully.", flush=True)


if __name__ == "__main__":
    generate_curated_runs()
