# ADR-007: Log Storage, Range Streaming, and Columnar Parquet Variant

- **Status**: Accepted
- **Date**: 2026-10-14
- **Deciders**: Principal Architect & Full-Stack Systems Lead

## Context
A full simulation run (e.g. 60–120 seconds at 10 Hz with 10–20 dynamic agents, multi-hypothesis future rollouts, and conformal uncertainty envelopes) generates 10–50 MB of detailed trajectory data.
Loading the entire JSON document at once in the browser causes:
1. Long initial load times (>10s on low-bandwidth connections, violating P1 "zero-install demo in <10s").
2. Memory pressure and garbage collection pauses in the browser tab, dropping framerate below the required 30 fps.
3. Wasteful bandwidth when a researcher scrubs only a specific 5-second collision window.

## Decision
We establish a dual-representation storage and streaming architecture:

1. **Storage Formats**:
   - **`apath-log/v1` (JSON/JSONL)**: Human-readable, self-contained baseline schema.
   - **Columnar Parquet Variant (`.apath.parquet`)**: Ultra-compact, binary columnar format partitioned by `run_id`. Floating point fields (x, y, v, risk) are compressed with Snappy/ZSTD with dictionary encoding for agent classes and intent labels, reducing log footprint by ~85% (from 35 MB to ~4.5 MB).

2. **Chunking & Indexing**:
   - Each run produces a lightweight index header (`manifest.json` or first chunk) containing world geometry, bounds, static obstacles, summary metrics, and a frame byte offset / time index table.
   - Time is indexed in 5-second chunks (50 frames per chunk).

3. **HTTP Range Requests & Chunked Endpoints**:
   - Standard HTTP Range requests: `Range: bytes=start-end` supported directly on static object storage (S3 / nginx / FastAPI).
   - Structured chunked API: `GET /api/runs/{id}/frames?start_time=12.0&end_time=17.0` returns only the requested temporal window.
   - Server-Sent Events (SSE): `GET /api/runs/{id}/stream` streams frames live as a worker executes a simulation.

4. **Client-Side Virtual Window**:
   - ADAPTIVE-PATH Studio implements a sliding temporal buffer holding current frame $\pm 5$ seconds in memory, evicting distant frames during playback.

## Consequences
- Replay starts in under 1.5 seconds regardless of total run duration.
- Browser memory footprint stays constant below 40 MB even for 10-minute simulation sweeps.
- Offline bundled runs can still use single-file static JSON for zero-dependency demos.
