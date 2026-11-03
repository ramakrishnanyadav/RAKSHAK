"""
Database Seeding Script.
Populates standard roles (admin, researcher, designer) and loads all shipped sample runs
from storage into the PostgreSQL / SQLite database with is_shipped=True.
"""

import json
from pathlib import Path
from sqlalchemy.orm import Session

from backend.app.database import SessionLocal, Base, engine
from backend.app.models import UserRecord, SessionRecord, QuotaRecord, RunRecord, utcnow
from backend.app.config import settings
from backend.app.core.security import hash_password


def seed_database():
    print("Initializing database tables...")
    Base.metadata.create_all(bind=engine)
    db: Session = SessionLocal()

    try:
        # 1. Seed standard demo accounts
        demo_users = [
            ("usr_admin", "admin@adaptive-path.local", "AdminPass1234!", "admin"),
            ("usr_researcher", "researcher@adaptive-path.local", "ResearchPass1234!", "researcher"),
            ("usr_designer", "designer@adaptive-path.local", "DesignPass1234!", "designer"),
        ]

        for u_id, email, plain_pw, role in demo_users:
            existing = db.query(UserRecord).filter(UserRecord.email == email).first()
            if not existing:
                user = UserRecord(
                    id=u_id,
                    email=email,
                    hashed_password=hash_password(plain_pw),
                    role=role,
                    is_active=True,
                    is_verified=True,
                )
                db.add(user)
                # Assign generous quota
                quota = QuotaRecord(
                    user_id=u_id,
                    max_concurrent_runs=10 if role == "admin" else 5,
                    daily_run_limit=500,
                    runs_today=0,
                    last_reset_date=utcnow().strftime("%Y-%m-%d"),
                )
                db.add(quota)
                print(f"Created user: {email} ({role})")

        db.commit()

        # 2. Seed shipped sample runs from storage/runs/
        runs_dir = Path(settings.storage_dir) / "runs"
        if not runs_dir.exists():
            runs_dir = Path("./storage/runs")

        seeded_runs = 0
        if runs_dir.exists():
            for json_path in runs_dir.glob("*.json"):
                try:
                    with open(json_path, "r", encoding="utf-8") as f:
                        data = json.load(f)

                    run_id = data.get("run_id") or json_path.stem
                    m = data.get("metrics", {})
                    sc = data.get("scenario", {})
                    pl = data.get("planner", {})
                    eng = data.get("engine", {})

                    existing_run = db.query(RunRecord).filter(RunRecord.id == run_id).first()
                    rel_path = str(json_path.resolve().relative_to(Path(settings.storage_dir).resolve())) if json_path.is_relative_to(Path(settings.storage_dir).resolve()) else str(json_path)

                    if not existing_run:
                        run_rec = RunRecord(
                            id=run_id,
                            scenario_id=sc.get("id", "SCENARIO_5_CATTLE_CROSSING"),
                            planner_id=pl.get("id", "P3"),
                            split=sc.get("split", "tune"),
                            seed=sc.get("seed", 1000),
                            engine_adapter=eng.get("name", "python"),
                            status="completed",
                            config_hash=data.get("config_hash"),
                            is_shipped=True,
                            duration_s=m.get("duration_s", 0.0),
                            completed_goal=m.get("completed_goal", False),
                            collision_occurred=m.get("collision_occurred", False),
                            min_clearance_m=m.get("min_clearance_m", 0.0),
                            mean_speed_m_s=m.get("mean_speed_m_s", 0.0),
                            max_jerk_m_s3=m.get("max_jerk_m_s3", 0.0),
                            replan_count=m.get("replan_count", 0),
                            p95_latency_ms=m.get("p95_latency_ms", 0.0),
                            failure_tag=m.get("failure_tag"),
                            log_path=f"runs/{json_path.name}",
                        )
                        db.add(run_rec)
                        seeded_runs += 1
                except Exception as e:
                    print(f"Warning: could not seed {json_path}: {e}")

        db.commit()
        print(f"Database seeded successfully! Loaded {seeded_runs} shipped runs.")

    finally:
        db.close()


if __name__ == "__main__":
    seed_database()
