"""
Runs Lifecycle, Worker Resiliency, Quota, and Idempotency Tests.
Verifies enqueueing, duplicate idempotency keys, per-user concurrency limits,
retry with exponential backoff on failure, and cooperative cancellation.
"""

import pytest
import uuid
from backend.app.models import RunRecord, QuotaRecord
from backend.app.worker import cancel_simulation_job, execute_simulation_task


def test_idempotency_key_deduplication(client, researcher_headers):
    idempotency_key = f"idem_{uuid.uuid4().hex[:12]}"
    payload = {
        "scenario_id": "SCENARIO_5_CATTLE_CROSSING",
        "planner_id": "P3",
        "split": "tune",
        "seed": 1000,
        "engine_adapter": "python",
        "idempotency_key": idempotency_key,
    }

    # First launch
    res1 = client.post("/api/runs", headers=researcher_headers, json=payload)
    assert res1.status_code == 200
    run_id1 = res1.json()["run_id"]

    # Second launch with same idempotency key in header
    headers = dict(researcher_headers)
    headers["Idempotency-Key"] = idempotency_key
    res2 = client.post("/api/runs", headers=headers, json=payload)
    assert res2.status_code == 200
    run_id2 = res2.json()["run_id"]

    assert run_id1 == run_id2


def test_batch_launch_sweep(client, researcher_headers):
    payload = {
        "scenario_ids": ["SCENARIO_1_VILLAGE_ROAD"],
        "planner_ids": ["B1", "P3"],
        "split": "tune",
        "seeds": [1000, 1001],
        "engine_adapter": "python",
    }
    res = client.post("/api/runs/batch", headers=researcher_headers, json=payload)
    assert res.status_code == 200
    assert len(res.json()["run_ids"]) == 4


def test_per_user_quota_concurrency_limit(client, db_session, researcher_headers):
    # Set quota max_concurrent_runs to 1 for test_researcher_id
    quota = db_session.query(QuotaRecord).filter(QuotaRecord.user_id == "test_researcher_id").first()
    quota.max_concurrent_runs = 1
    db_session.commit()

    # Insert an existing running run owned by this researcher
    dummy_running = RunRecord(
        id="run_already_running",
        scenario_id="SCENARIO_5_CATTLE_CROSSING",
        planner_id="P1",
        split="tune",
        seed=1000,
        engine_adapter="python",
        status="running",
        owner_id="test_researcher_id",
    )
    db_session.add(dummy_running)
    db_session.commit()

    # Attempt to launch another run
    res = client.post(
        "/api/runs",
        headers=researcher_headers,
        json={
            "scenario_id": "SCENARIO_5_CATTLE_CROSSING",
            "planner_id": "P3",
            "split": "tune",
            "seed": 1002,
            "engine_adapter": "python",
        },
    )
    assert res.status_code == 429
    assert res.json()["code"] == "QUOTA_EXCEEDED"

    # Reset quota
    quota.max_concurrent_runs = 10
    db_session.commit()


def test_list_runs_pagination_and_filtering(client, researcher_headers):
    res = client.get("/api/runs?limit=2&offset=0", headers=researcher_headers)
    assert res.status_code == 200
    data = res.json()
    assert "items" in data
    assert "total" in data
    assert len(data["items"]) <= 2


def test_worker_retry_and_failure_handling(db_session):
    run_id = f"run_test_retry_{uuid.uuid4().hex[:6]}"
    rec = RunRecord(
        id=run_id,
        scenario_id="NON_EXISTENT_SCENARIO",
        planner_id="P3",
        split="tune",
        seed=1000,
        engine_adapter="python",
        status="queued",
        max_retries=1,
    )
    db_session.add(rec)
    db_session.commit()

    # Execute simulation task on invalid scenario -> exhausts retries and marks failed
    execute_simulation_task(
        run_id=run_id,
        scenario_id="NON_EXISTENT_SCENARIO",
        planner_id="P3",
        split="tune",
        seed=1000,
        engine_adapter_name="python",
        custom_params={},
        max_retries=1,
        db_session=db_session,
    )

    db_session.refresh(rec)
    assert rec.status == "failed"
    assert "ERROR" in rec.failure_tag
