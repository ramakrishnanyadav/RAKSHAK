# ADAPTIVE-PATH Studio — API Integration & Backend Mapping

**Date:** 2026-11-03  
**Auditor:** Senior React Engineer & Enterprise UX Architect  
**Branch:** `studio/ui-development`

This document details the mapping between the Studio frontend API client (`studio/src/api/client.ts`) and the FastAPI backend service (`backend/app/main.py`), identifying genuinely operational endpoints, static fallback mechanisms, and critical integration gaps.

---

## 1. Frontend-to-Backend Endpoint Mapping

| Domain / Feature | Frontend Method (`apiClient`) | Backend Route | HTTP Method | Implementation Status | Data Source / Fallback Behavior |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Authentication** | `login(email, password)` | `/api/v1/auth/login` | `POST` | **Fully Implemented** | SQLite `users` table + JWT bearer tokens + CSRF cookie. Supports guest bypass. |
| **Authentication** | `signup(payload)` | `/api/v1/auth/signup` | `POST` | **Fully Implemented** | Creates user record; returns JWT. |
| **Authentication** | `getProfile()` | `/api/v1/auth/me` | `GET` | **Fully Implemented** | Returns `UserProfile` from authorization header. |
| **Simulations List** | `getRuns(params)` | `/api/v1/runs` | `GET` | **Fully Implemented** | Queries `simulation_runs` table. **Fallback**: Loads `/sample_runs/manifest.json` if backend is unreachable. |
| **Run Creation** | `createRun(payload)` | `/api/v1/runs` | `POST` | **Partially Implemented** | Enqueues in-process or background simulation task. Fails if backend is offline. |
| **Run Manifest** | `getRun(id)` | `/api/v1/runs/{id}` | `GET` | **Fully Implemented** | Returns `RunManifest` summary. **Fallback**: Fetches `/sample_runs/{id}.json` directly. |
| **Replay Telemetry**| `getRunFrames(id, chunk)` | `/api/v1/runs/{id}/frames` | `GET` | **Fully Implemented** | Streams frame sequence in paginated chunks. **Fallback**: Reads frames array from bundled JSON run logs. |
| **Scenarios List** | `getScenarios()` | `/api/v1/scenarios` | `GET` | **Fully Implemented** | Reads `SCENARIOS_CATALOG` from registry. |
| **Scenario Detail** | `getScenario(id)` | `/api/v1/scenarios/{id}` | `GET` | **Fully Implemented** | Returns scenario geometry, road boundaries, and default parameters. |
| **Ablation Benchmarks**| `getBenchmarks(scenario)` | `/api/v1/benchmarks/{scenario}`| `GET` | **Mocked / Static** | Backend returns synthetic sample numbers. Frontend falls back to static hardcoded arrays. |
| **Comparative Run** | `compareRuns(runA, runB)` | `/api/v1/runs/compare` | `GET` | **Frontend-Calculated**| Frontend fetches both run JSON files and computes telemetry deltas dynamically in browser. |
| **Failure Records** | `getFailures()` | `/api/v1/failures` | `GET` | **Mocked / Static** | Returns 4 static failure records. |
| **Synthesis Reports**| `getReport(id)` | `/api/v1/reports/{id}` | `GET` | **Static String** | Returns static markdown string generated on Oct 14, 2026. |
| **User Settings** | `getSettings()`, `updateSettings()` | `/api/v1/settings` | `GET` / `PUT` | **Fully Implemented** | Persists theme and accessibility options in database or local storage. |
| **Health Check** | `checkHealth()` | `/api/v1/health` | `GET` | **Fully Implemented** | Returns `{ "status": "healthy", "engine": "python_reference" }`. |

---

## 2. Telemetry and Run-Log Schema Parity

The authoritative telemetry schema is versioned as `apath-log/v1` in [`engine/apath_log/schema.py`](file:///C:/Users/Ramakrishna/Downloads/MINI/engine/apath_log/schema.py).

### Schema Parity Table

| Field Name | Backend Type (`schema.py`) | Frontend Type (`types/apath_log.ts`) | Frontend Type (`types/api.ts`) | Status / Discrepancy |
| :--- | :--- | :--- | :--- | :--- |
| `duration_s` | `float` | `number` | `number` | Parity Verified |
| `completed_goal` | `bool` | `boolean` | `boolean` | Parity Verified |
| `collision_occurred` | `bool` | `boolean` | `boolean` | Parity Verified |
| `min_clearance_m` | `float` | `number` | `number` | Parity Verified |
| `mean_speed_m_s` | `float` | `number` | `number` | Parity Verified |
| `max_jerk_m_s3` | `float` | `number` | `number` | Parity Verified |
| `mean_jerk_m_s3` | `float` | `number` (optional) | **MISSING** in `RunManifest.metrics` | **Causes TypeScript build failure in `ReplayView.tsx(146)`** |
| `near_miss_count` | `int` | `number` (optional) | **MISSING** in `RunManifest.metrics` | Optional fallback present in ReplayView |
| `replan_count` | `int` | `number` | `number` | Parity Verified |
| `p95_latency_ms` | `float` | `number` | `number` | Parity Verified |
| `failure_tag` | `Optional[Literal[...]]` | `string \| null` | `string \| null` | Parity Verified |

---

## 3. Critical Integration Gaps & Dependencies

1. **Authentic Benchmark Manifest Endpoint**:
   - *Current State*: The Python simulation runner generated an authoritative benchmark manifest on Validation B (`runs/val_b_manifest.json`), but there is no API endpoint in `backend/app/routers/benchmarks.py` to serve this manifest to the frontend.
   - *Dependency*: Backend needs to serve `runs/*.json` manifests via `GET /api/v1/benchmarks/manifests/{split}`, or frontend must be configured to fetch static JSON from `/runs/val_b_manifest.json`.
2. **Simulation Lifecycle Real-Time Telemetry**:
   - *Current State*: Simulation execution is currently synchronous on the server or executed offline. There is no WebSocket or Server-Sent Events (SSE) pipe to stream simulation frames step-by-step ($10\text{ Hz}$) into the canvas during live execution.
   - *Impact*: In the current UI, "live simulation" is functionally equivalent to "run complete simulation $\to$ download log $\to$ replay log".
3. **Offline Standalone Operation**:
   - *Current State*: The Studio already supports 14 pre-bundled verified sample runs in `studio/public/sample_runs/` (`run_scenario_1_...` through `run_scenario_5_...`). When the backend server is offline, the frontend seamlessly fetches these static JSON files, allowing 100% offline demonstration.
   - *Action Required*: Clearly communicate to the user when they are viewing "Offline Pre-Bundled Runs" versus "Connected Live Engine".

