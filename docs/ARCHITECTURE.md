# ADAPTIVE-PATH — Architecture & API Specification

> **Simulation and research platform only** — strictly not road-ready software; never claim real-world safety.  
> **Schema Contract**: `apath-log/v1` (strict validation, lossless JSON and columnar Parquet format)  
> **OpenAPI Contract**: [`schemas/openapi.json`](file:///c:/Users/Ramakrishna/Downloads/MINI/schemas/openapi.json) and [`schemas/openapi.yaml`](file:///c:/Users/Ramakrishna/Downloads/MINI/schemas/openapi.yaml)  

---

## 1. System Architecture Overview

ADAPTIVE-PATH separates simulation computation from the user-facing evaluation interface via a strictly typed, versioned log contract:

```
┌────────────────────────────────────────────────────────────────────────┐
│                   ADAPTIVE-PATH Studio (Web Client)                    │
│   • Multi-Layer 2D Canvas Replay (World, Tracks, Cones, Risk, Path)    │
│   • Pairwise Trajectory Comparison & Metric Deltas                     │
│   • Statistical Benchmark Matrix with 95% Bootstrap CIs                │
│   • Failure Mode Explorer (Perception, Prediction, Risk, Planning)     │
│   • WCAG 2.2 AA Accessible UI (Keyboard, Screen Reader, High-Contrast) │
└───────────────────────────────────▲────────────────────────────────────┘
                                    │ HTTP / Range 206 / SSE
┌───────────────────────────────────┴────────────────────────────────────┐
│                    Stateless Backend API (FastAPI)                     │
│   • RFC 7233 Byte-Range Telemetry Streaming & SSE Cycle Progress       │
│   • Single Unified Authorization Layer (Role x Action x Ownership)     │
│   • Asynchronous Simulation Task Dispatcher & Idempotent Submission    │
│   • Statistical Aggregation Engine (1,000 Bootstrap Resamples)         │
└──────────────▲────────────────────▲────────────────────▲───────────────┘
               │                    │                    │
        SQL Metadata         Object Storage        Job Broker
    (Postgres / SQLite)      (MinIO / Disk)         (Redis)
               │                    │                    │
┌──────────────┴────────────────────┴────────────────────┴───────────────┐
│                       Deterministic Worker Pool                        │
│   • Pulls queued simulation tasks                                      │
│   • Enforces execution timeouts and cooperative cancellation           │
│   • Executes simulations via EngineAdapter plug-in interface           │
└───────────────────────────────────▲────────────────────────────────────┘
                                    │
               ┌────────────────────┴────────────────────┐
               │                                         │
┌──────────────┴──────────────┐           ┌──────────────┴──────────────┐
│   Python Reference Engine   │           │    MATLAB Engine Adapter    │
│   (Standalone, Zero-Licence)│           │   (Co-Simulation Bridge)    │
│   • Occlusion Perception    │           │   • RoadRunner Scenarios    │
│   • Multi-Hypothesis Motion │           │   • Simulink Automated      │
│   • Conformal Risk Field    │           │     Driving Toolbox         │
│   • Event-Triggered Replan  │           │   • Graceful licence catch  │
└─────────────────────────────┘           └─────────────────────────────┘
```

---

## 2. Telemetry Pipeline (`apath-log/v1`)

The simulation output contract is defined in [`engine/models.py`](file:///c:/Users/Ramakrishna/Downloads/MINI/engine/models.py) and validated on every run:

```
Simulation Execution
        │
        ▼
Native Engine Step (Python or Simulink)
        │
        ▼
Log Converter (Lossless mapping of state, perceptions, predictions, risk, plan)
        │
        ▼
Validator (Verifies apath-log/v1 JSON schema compliance)
        │
        ▼
Object Storage (storage/runs/{run_id}.json & studio/public/sample_runs/)
        │
        ▼
Metrics Aggregator (Computes collision, clearance, jerk, latency with bootstrap CIs)
```

### Log Schema Components
- **`run_id`**: Deterministic UUID string.
- **`scenario_id`**: One of the 5 scenario identifiers.
- **`planner_id`**: Baseline (`B0`, `B1`, `B2`) or Research (`P1`, `P2`, `P3`).
- **`seed`**: Integer random seed.
- **`split`**: `tune`, `validate`, or `frozen_test`.
- **`frames`**: Array of time-indexed simulation cycles ($dt = 0.1\text{ s}$):
  - `t`: Elapsed simulation time (seconds).
  - `ego`: Pose ($x, y, \theta$), velocity ($v$), steering ($\delta$), active state (`FORWARD`, `REPLANNING`, `MRM_FALLBACK`, `STOP`).
  - `agents`: Observed dynamic actors (id, class, $x, y, v, \theta$).
  - `predictions`: Multi-hypothesis forecast paths ($K=6$) with mixture probabilities and covariance ellipses.
  - `conformal_intervals`: Calibrated non-parametric spatial uncertainty envelopes guaranteeing 95% coverage.
  - `risk_field`: Continuous spatial potential risk field evaluations $R(x, y)$ over the road grid.
  - `planner_output`: Active planned path waypoints, replan trigger flag, and trigger reason code (`CONFORMAL_VIOLATION`, `RISK_THRESHOLD_EXCEEDED`, `PERIODIC_CLOCK`).
- **`metrics`**: Final run summary metrics (`collision_occurred`, `min_clearance_m`, `mean_jerk_m_s3`, `p95_latency_ms`, `replan_count`, `goal_reached`).

---

## 3. Engine Adapter Plug-in Contract

Every simulation backend implements the `BaseEngineAdapter` abstract interface ([`engine/adapters/base.py`](file:///c:/Users/Ramakrishna/Downloads/MINI/engine/adapters/base.py)):

| Method | Signature | Description |
| :--- | :--- | :--- |
| `prepare` | `(scenario_id: str, seed: int, config: dict) -> PreparedSimulation` | Initializes initial state, road network geometry, and obstacle spawns. |
| `start` | `(sim: PreparedSimulation) -> str` | Launches simulation execution asynchronously or in-process. |
| `stream_progress` | `(sim_id: str) -> Iterator[SimulationProgress]` | Yields cycle progress percentages and frame counts for live SSE feedback. |
| `cancel` | `(sim_id: str) -> bool` | Cooperatively cancels an in-flight run without corrupting partial state. |
| `collect_logs` | `(sim_id: str) -> SimulationLog` | Normalizes native engine outputs into the validated `apath-log/v1` contract. |
| `version_info` | `() -> AdapterVersion` | Returns adapter name, engine runtime version, and license state. |

---

## 4. API Specification & Route Reference

The API is fully documented via OpenAPI 3.1.0 at [`/docs`](http://localhost:8000/docs) and [`/redoc`](http://localhost:8000/redoc).

### Standard Error Response Envelope
Every 4xx and 5xx response follows RFC 7807 problem details:
```json
{
  "code": "RUN_NOT_FOUND",
  "message": "The requested simulation run does not exist or has expired.",
  "details": {"run_id": "run_12345"},
  "request_id": "req_9f3b821a-4c2d-4d7e-90f1-1a3b5c7e9f0a"
}
```

### Core API Endpoints

#### Operational & Probes
| Endpoint | Method | Auth | Description | Response Codes |
| :--- | :---: | :---: | :--- | :--- |
| `/api/health` | `GET` | Public | Liveness probe returning service status and version. | `200 OK` |
| `/api/health/ready` | `GET` | Public | Readiness probe checking database, storage, and worker connectivity. | `200 OK`, `503 Service Unavailable` |
| `/api/metrics` | `GET` | Public | Operational metrics in Prometheus format. | `200 OK` |

#### Authentication & Session Management
| Endpoint | Method | Auth | Description | Response Codes |
| :--- | :---: | :---: | :--- | :--- |
| `/api/auth/register` | `POST` | Public | Register new account with Argon2id password hashing. | `201 Created`, `400 Bad Request` |
| `/api/auth/login` | `POST` | Public | Authenticate and issue rotating JWT and httpOnly refresh cookie. | `200 OK`, `401 Unauthorized`, `429 Too Many Requests` |
| `/api/auth/guest` | `POST` | Public | Issue 24-hour anonymous guest session for instant evaluation. | `200 OK` |
| `/api/auth/refresh` | `POST` | Public | Exchange refresh cookie for new token pair with reuse detection. | `200 OK`, `401 Unauthorized` |
| `/api/auth/logout` | `POST` | Session | Revoke active refresh token and invalidate cookies. | `200 OK` |
| `/api/auth/sessions` | `GET` | Session | List active login sessions (IP, user agent, expiration). | `200 OK` |

#### Scenarios Catalog & Authoring
| Endpoint | Method | Auth | Description | Response Codes |
| :--- | :---: | :---: | :--- | :--- |
| `/api/scenarios` | `GET` | Public | List the 5 scenario families and their parameterized variants. | `200 OK` |
| `/api/scenarios/{id}` | `GET` | Public | Retrieve detailed scenario metadata, road geometry, and seed splits. | `200 OK`, `404 Not Found` |
| `/api/scenarios/variants` | `POST` | Designer+ | Author a custom parameterized scenario variant. | `201 Created`, `403 Forbidden` |

#### Simulation Runs & Telemetry Streaming
| Endpoint | Method | Auth | Description | Response Codes |
| :--- | :---: | :---: | :--- | :--- |
| `/api/runs` | `POST` | Researcher+ | Enqueue a simulation run (`scenario_id`, `planner_id`, `seed`, `split`). | `202 Accepted`, `429 Quota Exceeded` |
| `/api/runs/batch` | `POST` | Researcher+ | Enqueue a batch sweep across multiple seeds or planners. | `202 Accepted`, `429 Quota Exceeded` |
| `/api/runs` | `GET` | Public/Role | Query simulation runs (supports filtering by scenario, planner, split). | `200 OK` |
| `/api/runs/{id}` | `GET` | Public/Role | Retrieve run summary metadata, execution status, and final metrics. | `200 OK`, `404 Not Found` |
| `/api/runs/{id}/log` | `GET` | Public/Role | Download complete `apath-log/v1` run log with HTTP Range support. | `200 OK`, `206 Partial Content` |
| `/api/runs/{id}/stream` | `GET` | Public/Role | Server-Sent Events (SSE) live simulation frame stream. | `200 OK` (`text/event-stream`) |
| `/api/runs/{id}/cancel` | `POST` | Owner/Admin | Cooperatively cancel an in-progress simulation run. | `200 OK`, `404 Not Found` |

#### Research Validation & Benchmarks
| Endpoint | Method | Auth | Description | Response Codes |
| :--- | :---: | :---: | :--- | :--- |
| `/api/benchmarks/summary` | `GET` | Public | Aggregate statistical matrix with 1,000 bootstrap 95% CIs. | `200 OK` |
| `/api/benchmarks/compare` | `GET` | Public | Pairwise delta analysis (e.g. B1 vs P3) across matched seeds. | `200 OK` |
| `/api/failures` | `GET` | Researcher+ | Query root-cause failure taxonomy (Perception, Prediction, Risk, Plan). | `200 OK` |
| `/api/reports` | `POST` | Researcher+ | Synthesize automated Markdown research evaluation report. | `201 Created` |

---

## 5. Security & Authorization Architecture

- **Single Unified Authorization Layer**: Evaluated at middleware level:
  $$\text{Allowed} = f(\text{UserRole}, \text{Action}, \text{ResourceOwnership})$$
- **RBAC Hierarchy**:
  - `Guest`: Read public scenarios, replay pre-computed sample runs, view statistical benchmarks.
  - `Researcher`: Launch simulation runs, queue batch sweeps, access raw telemetry logs, generate reports.
  - `Designer`: Author and parameterize scenario variants, configure obstacle spawns and road geometries.
  - `Admin`: Full access, account quota adjustments, audit log queries, system health and worker queues.
- **CSRF Protection**: Double-submit cookie pattern with secure random tokens.
- **Strict Headers**: HSTS, CSP, X-Frame-Options (`DENY`), X-Content-Type-Options (`nosniff`).
