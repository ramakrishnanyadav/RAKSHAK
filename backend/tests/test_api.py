"""
Backend API Unit & Integration Tests.
"""

def test_health_check(client):
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["engine_contract"] == "apath-log/v1"


def test_list_scenarios(client, researcher_headers):
    response = client.get("/api/scenarios", headers=researcher_headers)
    assert response.status_code == 200
    scenarios = response.json()
    assert len(scenarios) >= 5
    ids = [s["id"] for s in scenarios]
    assert "SCENARIO_5_CATTLE_CROSSING" in ids
    assert "SCENARIO_4_DENSE_MARKET" in ids


def test_launch_run(client, researcher_headers):
    payload = {
        "scenario_id": "SCENARIO_5_CATTLE_CROSSING",
        "planner_id": "P3",
        "split": "tune",
        "seed": 1000,
        "engine_adapter": "python",
    }
    response = client.post("/api/runs", headers=researcher_headers, json=payload)
    assert response.status_code == 200
    res = response.json()
    assert "run_id" in res
    assert res["status"] == "queued"


def test_benchmark_endpoint(client, researcher_headers):
    response = client.get("/api/benchmark?split=tune", headers=researcher_headers)
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1
    assert "planners" in data[0]


def test_run_manifest_and_chunked_frames(client, researcher_headers):
    run_id = "run_shipped_sample"
    
    # 1. Test lightweight manifest
    manifest_res = client.get(f"/api/runs/{run_id}/manifest", headers=researcher_headers)
    assert manifest_res.status_code == 200
    m_data = manifest_res.json()
    assert m_data["run_id"] == run_id
    assert m_data["schema_version"] == "apath-log/v1"
    assert "frames" not in m_data
    assert m_data["total_frames"] > 0

    # 2. Test temporal chunked frame streaming
    frames_res = client.get(f"/api/runs/{run_id}/frames?start_time=0.0&end_time=0.2", headers=researcher_headers)
    assert frames_res.status_code == 200
    f_data = frames_res.json()
    assert f_data["run_id"] == run_id
    assert f_data["start_time"] == 0.0
    assert f_data["end_time"] == 0.2
    assert f_data["frame_count"] > 0
    for frame in f_data["frames"]:
        assert 0.0 <= frame["t"] <= 0.2


def test_unrecorded_run_returns_http_404_with_json_body(client, researcher_headers):
    """
    Contract: Querying an unrecorded/non-existent run ID must return HTTP 404
    with a structured JSON response (code == 'NOT_FOUND'), not a 500 or plain crash.
    """
    unrecorded_id = "run_nonexistent_unrecorded_99999"
    response = client.get(f"/api/runs/{unrecorded_id}", headers=researcher_headers)
    assert response.status_code == 404
    data = response.json()
    assert data["code"] == "NOT_FOUND"
    assert "message" in data
