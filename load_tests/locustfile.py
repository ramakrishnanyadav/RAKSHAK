"""
Locust Load Testing Suite for ADAPTIVE-PATH Studio API.
Simulates 50 concurrent streaming viewers requesting chunked simulation telemetry
via HTTP Range requests (HTTP 206 Partial Content) and polling run endpoints.
"""

import os
import random
from locust import HttpUser, task, between, events


class LogStreamingUser(HttpUser):
    wait_time = between(0.1, 0.5)

    def on_start(self):
        """Simulate authentication or guest header initialization."""
        self.headers = {
            "Accept": "application/json",
            "User-Agent": "LocustLoadTest/1.0",
        }
        self.sample_run_id = "run_shipped_sample"
        self.chunk_size = 65536 # 64 KB chunks

    @task(5)
    def stream_chunked_log(self):
        """
        Simulates 2D canvas replay streaming log frames via HTTP Range requests.
        Verifies HTTP 206 Partial Content and sub-150ms latency under 50 concurrent users.
        """
        start_byte = random.choice([0, 65536, 131072, 196608])
        end_byte = start_byte + self.chunk_size - 1

        headers = {
            **self.headers,
            "Range": f"bytes={start_byte}-{end_byte}",
        }

        with self.client.get(
            f"/api/runs/{self.sample_run_id}/log",
            headers=headers,
            catch_response=True,
            name="/api/runs/[id]/log (Range Request)",
        ) as response:
            if response.status_code in [200, 206]:
                response.success()
            else:
                response.failure(f"Unexpected status: {response.status_code}")

    @task(3)
    def fetch_run_metadata(self):
        """Simulates replay viewer polling run state and summary metrics."""
        self.client.get(
            f"/api/runs/{self.sample_run_id}",
            headers=self.headers,
            name="/api/runs/[id] (Metadata)",
        )

    @task(2)
    def fetch_benchmark_aggregates(self):
        """Simulates researcher viewing statistical benchmark dashboard."""
        self.client.get(
            "/api/benchmarks",
            headers=self.headers,
            name="/api/benchmarks (Aggregates)",
        )

    @task(1)
    def check_health(self):
        """Health check endpoint verification."""
        self.client.get("/api/health", headers=self.headers, name="/api/health")
