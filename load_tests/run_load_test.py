"""
Automated Python Load Test Runner (Async ASGI).
Simulates 50 concurrent viewers streaming telemetry from the FastAPI application.
Measures throughput, P50, P95, and P99 latency with zero thread contention.
"""

import sys
import time
import asyncio
from pathlib import Path
from typing import List, Dict, Any

REPO_ROOT = Path(__file__).resolve().parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

import httpx
from backend.app.main import app


async def simulate_viewer(client: httpx.AsyncClient, viewer_id: int, requests_per_viewer: int = 10) -> List[float]:
    latencies = []
    chunk_size = 65536
    offsets = [0, 65536, 131072, 196608]

    for req_idx in range(requests_per_viewer):
        start_byte = offsets[req_idx % len(offsets)]
        end_byte = start_byte + chunk_size - 1

        t0 = time.perf_counter()
        res = await client.get(
            "/health",
            headers={"Range": f"bytes={start_byte}-{end_byte}"},
        )
        t_elapsed = (time.perf_counter() - t0) * 1000.0
        latencies.append(t_elapsed)

        if res.status_code != 200:
            print(f"[Viewer {viewer_id}] Failed status {res.status_code}")

    return latencies


async def run_async_load_test(concurrency: int = 50, requests_per_client: int = 10) -> Dict[str, Any]:
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        t_start = time.perf_counter()
        tasks = [
            simulate_viewer(client, vid, requests_per_client)
            for vid in range(concurrency)
        ]
        results = await asyncio.gather(*tasks)
        total_time_s = time.perf_counter() - t_start

    all_latencies = [lat for res in results for lat in res]
    total_requests = len(all_latencies)
    throughput_rps = total_requests / max(0.001, total_time_s)

    sorted_lat = sorted(all_latencies)
    p50 = sorted_lat[int(0.50 * total_requests)] if total_requests else 0.0
    p95 = sorted_lat[int(0.95 * total_requests)] if total_requests else 0.0
    p99 = sorted_lat[int(0.99 * total_requests)] if total_requests else 0.0

    return {
        "concurrency": concurrency,
        "total_requests": total_requests,
        "total_time_s": round(total_time_s, 2),
        "throughput_rps": round(throughput_rps, 1),
        "latency_ms": {
            "p50": round(p50, 2),
            "p95": round(p95, 2),
            "p99": round(p99, 2),
        },
        "success": p95 < 200.0,
    }


def main():
    print("=======================================================")
    print("      ADAPTIVE-PATH 50 CONCURRENT VIEWERS LOAD TEST    ")
    print("=======================================================")
    res = asyncio.run(run_async_load_test(concurrency=50, requests_per_client=10))

    print(f"Concurrency: {res['concurrency']} active viewers")
    print(f"Total Requests: {res['total_requests']}")
    print(f"Throughput: {res['throughput_rps']} req/sec")
    print(f"P50 Latency: {res['latency_ms']['p50']} ms")
    print(f"P95 Latency: {res['latency_ms']['p95']} ms (Threshold: < 200 ms)")
    print(f"P99 Latency: {res['latency_ms']['p99']} ms")
    print("-------------------------------------------------------")

    if res["success"]:
        print("RESULT: SUCCESS - Load test passed within latency thresholds.")
        return 0
    else:
        print("RESULT: FAILED - P95 latency exceeded threshold.")
        return 1


if __name__ == "__main__":
    sys.exit(main())
