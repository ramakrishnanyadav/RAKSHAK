"""
HTTP Range Requests and Log Windowing Tests.
Validates RFC 7233 partial content (206) byte serving, manifest retrieval,
and windowed temporal frame chunking.
"""

import json
from pathlib import Path
from backend.app.config import settings


def _ensure_test_log_file(run_id="run_shipped_sample"):
    path = Path(settings.storage_dir) / "runs" / f"{run_id}.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    if not path.exists():
        dummy_log = {
            "schema_version": "apath-log/v1",
            "run_id": run_id,
            "timestamp_iso": "2026-10-14T00:00:00Z",
            "config_hash": "hash123",
            "engine": {"name": "python", "version": "1.0.0"},
            "scenario": {"id": "SCENARIO_5_CATTLE_CROSSING", "name": "Cattle", "split": "tune", "seed": 1000},
            "planner": {"id": "P3", "name": "P3: Adaptive", "config": {}},
            "world": {"road_segments": []},
            "frames": [
                {"step": 0, "t": 0.0, "ego": {"x": 0.0, "y": 0.0, "v": 7.0}},
                {"step": 1, "t": 0.1, "ego": {"x": 0.7, "y": 0.0, "v": 7.0}},
                {"step": 2, "t": 0.2, "ego": {"x": 1.4, "y": 0.0, "v": 7.0}},
            ],
            "metrics": {
                "duration_s": 0.2,
                "completed_goal": True,
                "collision_occurred": False,
                "min_clearance_m": 1.5,
                "mean_speed_m_s": 7.0,
                "max_jerk_m_s3": 0.5,
                "replan_count": 0,
                "p95_latency_ms": 10.0,
            },
        }
        with open(path, "w", encoding="utf-8") as f:
            json.dump(dummy_log, f)
    return path


def test_full_log_file_response(client, researcher_headers):
    _ensure_test_log_file("run_shipped_sample")
    res = client.get("/api/runs/run_shipped_sample/log", headers=researcher_headers)
    assert res.status_code == 200
    assert res.headers.get("Accept-Ranges") == "bytes"
    data = res.json()
    assert data["schema_version"] == "apath-log/v1"


def test_http_range_206_partial_content(client, researcher_headers):
    path = _ensure_test_log_file("run_shipped_sample")
    total_size = path.stat().st_size

    # Request first 50 bytes: bytes=0-49
    headers = dict(researcher_headers)
    headers["Range"] = "bytes=0-49"
    res = client.get("/api/runs/run_shipped_sample/log", headers=headers)
    assert res.status_code == 206
    assert res.headers.get("Content-Range") == f"bytes 0-49/{total_size}"
    assert len(res.content) == 50

    # Request open-ended range: bytes=50-
    headers["Range"] = "bytes=50-"
    res_open = client.get("/api/runs/run_shipped_sample/log", headers=headers)
    assert res_open.status_code == 206
    assert res_open.headers.get("Content-Range") == f"bytes 50-{total_size - 1}/{total_size}"

    # Request suffix range: bytes=-20
    headers["Range"] = "bytes=-20"
    res_suffix = client.get("/api/runs/run_shipped_sample/log", headers=headers)
    assert res_suffix.status_code == 206
    assert len(res_suffix.content) == 20


def test_http_range_416_unsatisfiable(client, researcher_headers):
    _ensure_test_log_file("run_shipped_sample")
    headers = dict(researcher_headers)
    headers["Range"] = "bytes=9999999-99999999"
    res = client.get("/api/runs/run_shipped_sample/log", headers=headers)
    assert res.status_code == 416


def test_run_manifest_retrieval(client, researcher_headers):
    _ensure_test_log_file("run_shipped_sample")
    res = client.get("/api/runs/run_shipped_sample/manifest", headers=researcher_headers)
    assert res.status_code == 200
    data = res.json()
    assert data["run_id"] == "run_shipped_sample"
    assert "frames" not in data
    assert data["total_frames"] == 3


def test_windowed_frames_chunking(client, researcher_headers):
    _ensure_test_log_file("run_shipped_sample")
    res = client.get("/api/runs/run_shipped_sample/frames?start_time=0.0&end_time=0.15", headers=researcher_headers)
    assert res.status_code == 200
    data = res.json()
    assert data["frame_count"] == 2
    assert len(data["frames"]) == 2
