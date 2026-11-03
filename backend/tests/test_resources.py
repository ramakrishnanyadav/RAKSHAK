"""
Resources, Benchmarks, Failures, Reports, and Observability Tests.
"""

import pytest


def test_scenario_catalog(client, researcher_headers):
    res = client.get("/api/scenarios", headers=researcher_headers)
    assert res.status_code == 200
    scenarios = res.json()
    assert len(scenarios) >= 5
    ids = [s["id"] for s in scenarios]
    assert "SCENARIO_5_CATTLE_CROSSING" in ids

    # Detail
    det = client.get("/api/scenarios/SCENARIO_5_CATTLE_CROSSING", headers=researcher_headers)
    assert det.status_code == 200
    assert det.json()["nominal_speed_m_s"] > 0


def test_benchmarks_summary_and_confidence_intervals(client, researcher_headers):
    res = client.get("/api/benchmarks/summary?scenario_id=SCENARIO_5_CATTLE_CROSSING&split=tune", headers=researcher_headers)
    assert res.status_code == 200
    data = res.json()
    assert len(data) >= 1
    summary = data[0]
    assert summary["scenario_id"] == "SCENARIO_5_CATTLE_CROSSING"
    assert len(summary["planners"]) == 6


def test_benchmarks_compare(client, researcher_headers):
    res = client.get(
        "/api/benchmarks/compare?scenario_id=SCENARIO_5_CATTLE_CROSSING&split=tune&baseline=B1&candidate=P3",
        headers=researcher_headers,
    )
    assert res.status_code == 200
    data = res.json()
    assert data["baseline_planner"] == "B1"
    assert data["candidate_planner"] == "P3"
    assert "collision_rate_diff_pct" in data


def test_failures_explorer(client, researcher_headers):
    res = client.get("/api/failures", headers=researcher_headers)
    assert res.status_code == 200
    data = res.json()
    assert "items" in data
    assert "total" in data


def test_report_generation_and_retrieval(client, researcher_headers):
    payload = {
        "title": "Ablation Study P3 vs B1 on Rural Roads",
        "scenario_ids": ["SCENARIO_5_CATTLE_CROSSING"],
        "planner_ids": ["B1", "P3"],
    }
    create_res = client.post("/api/reports", headers=researcher_headers, json=payload)
    assert create_res.status_code == 201
    report = create_res.json()
    assert report["title"] == payload["title"]
    assert "ADAPTIVE-PATH Research Evaluation Report" in report["summary_markdown"]
    report_id = report["id"]

    # Retrieve
    get_res = client.get(f"/api/reports/{report_id}", headers=researcher_headers)
    assert get_res.status_code == 200
    assert get_res.json()["id"] == report_id


def test_user_settings_lifecycle(client, researcher_headers):
    # Get settings
    get_res = client.get("/api/settings/me", headers=researcher_headers)
    assert get_res.status_code == 200

    # Update settings
    put_res = client.put(
        "/api/settings/me",
        headers=researcher_headers,
        json={"preferences": {"theme": "light", "default_planner": "P2"}},
    )
    assert put_res.status_code == 200
    assert put_res.json()["preferences"]["theme"] == "light"


def test_observability_endpoints(client):
    # Liveness
    h_res = client.get("/health")
    assert h_res.status_code == 200
    assert h_res.json()["status"] == "healthy"

    # Readiness
    r_res = client.get("/health/ready")
    assert r_res.status_code == 200
    assert r_res.json()["status"] == "ready"

    # Metrics
    m_res = client.get("/metrics")
    assert m_res.status_code == 200
    assert "runs_total" in m_res.json()
