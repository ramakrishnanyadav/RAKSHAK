# ADAPTIVE-PATH

> **Smart India Hackathon 2026** • **Problem SIH26037** (MathWorks)  
> *Risk-Aware Predictive Path Planning & Collision Avoidance on Unstructured Indian Roads*  
> **Simulation and research platform only** — strictly not road-ready software; never claim real-world safety.

---

## ⚡ Reviewer 10-Minute Fast-Path

If you are an academic reviewer, hackathon evaluator, or judge with 10 minutes to understand the core scientific claims, reproduce every result, and inspect the operational limits:

| Step | Action | Command / Location | Expected Time |
| :--- | :--- | :--- | :---: |
| **1. Launch Demo** | Start the offline air-gapped Studio demo | `scripts\start_demo.bat` *(Win)* or `./scripts/start_demo.sh` *(Unix)* | **< 90 seconds** |
| **2. Reproduce All** | Regenerate every table, figure, and report | `python scripts/reproduce_all.py` | **< 15 seconds** |
| **3. Inspect Claims** | Verify 900 frozen simulations & 95% CIs | [`docs/PAPER_DRAFT.md`](docs/PAPER_DRAFT.md) & Table 1 | **2 minutes** |
| **4. See Limits** | Read breakdown boundaries & failure taxonomy | [`docs/PAPER_DRAFT.md`](docs/PAPER_DRAFT.md#8-honest-operational-limitations--sensitivity-boundaries) (Table 4) | **2 minutes** |
| **5. Live Replay** | Replay the exact replan moment ($t=0.70$s vs $t=2.40$s) | [http://localhost:5173/demo](http://localhost:5173/demo) & [`docs/DEMO_SCRIPT.md`](docs/DEMO_SCRIPT.md) | **3 minutes** |

### 📚 Comprehensive Documentation Index
- 📐 **Architecture & API Specs**: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) (OpenAPI, state machines, engine adapters)
- 👥 **Role-Based User Guide**: [`docs/USER_GUIDE.md`](docs/USER_GUIDE.md) (Guest, Researcher, Designer, Admin workflows)
- ♿ **WCAG 2.2 AA Accessibility**: [`docs/ACCESSIBILITY.md`](docs/ACCESSIBILITY.md) (Keyboard map, screen readers, contrast)
- 🗺️ **Scenario Pack Documentation**: [`docs/SCENARIOS.md`](docs/SCENARIOS.md) (5 Indian road scenarios, seed splits)
- 🔬 **Scientific Reproducibility Guide**: [`docs/REPRODUCIBILITY.md`](docs/REPRODUCIBILITY.md) (`reproduce_all.py` pipeline)
- 🎙️ **3-Minute Live Demo Script**: [`docs/DEMO_SCRIPT.md`](docs/DEMO_SCRIPT.md) (Timed views, replan moment, comparison)
- 🎬 **Captioned Video Storyboard**: [`docs/DEMO_VIDEO_OUTLINE.md`](docs/DEMO_VIDEO_OUTLINE.md) (Visuals, narration, SRT subtitles)
- 📄 **Academic Paper Methods & Results**: [`docs/PAPER_DRAFT.md`](docs/PAPER_DRAFT.md) (Empirical tables, hypotheses, limits)

---

## 🧭 Overview & Architecture

ADAPTIVE-PATH is built as two decoupled layers connected by a shared, strictly typed versioned schema (**`apath-log/v1`**):

```
┌───────────────────────────────────────────────────────────┐
│                 ADAPTIVE-PATH Studio                      │
│   Web Console: 2D Canvas Replay, Compare, Benchmarks,     │
│   Ablations (95% CI), Failure Explorer (WCAG 2.2 AA)      │
└─────────────────────────────▲─────────────────────────────┘
                              │
                    apath-log v1 (JSON)
                              │
        ┌─────────────────────┴─────────────────────┐
        │                                           │
┌───────┴───────────────────┐       ┌───────────────┴───────────┐
│  Python Reference Engine  │       │  MATLAB + RoadRunner      │
│  Standalone, Zero-Licence │       │  Official Hackathon Path  │
│  Perception → Prediction  │       │  Automated Driving        │
│  → Risk → Adaptive Replan │       │  Toolbox Co-Simulation    │
└───────────────────────────┘       └───────────────────────────┘
```

1. **Research Engine**:
   - **Official Path**: MATLAB/Simulink + RoadRunner Scenario co-simulation via `matlab_adapter/`.
   - **Reference Path**: Lightweight Python reference engine (`engine/`) running closed-loop simulations without licence dependencies.
   - **Pipeline**: Sensor Perception (noise, FOV, occlusion raycasting) → Multi-Hypothesis Non-Lane Trajectory Prediction → Calibrated Conformal Uncertainty Envelopes (95% coverage) → Continuous Potential Risk Field $R(x, y)$ → Dynamic Event-Triggered Replan Evaluator → Kinematic Bicycle Model / MPC Vehicle Control.
2. **ADAPTIVE-PATH Studio**:
   - Web console to browse scenarios, launch single/batch sweeps, replay simulations with synchronized layers (World, Dynamic Tracks, Conformal Cones, Risk Heatmap, Planned Path), compare planners side-by-side, view statistical ablation tables with 95% bootstrap confidence intervals, and explore failures.

---

## 🏁 The Six Planners (Ablation Ladder)

| Planner | ID | Type | Description |
| :--- | :--- | :--- | :--- |
| **Shortest Path** | `B0` | Baseline | Follows road centerline at constant speed with zero reactive avoidance. |
| **DWA + Velocity Obstacles** | `B1` | Classical Baseline | Dynamic Window Approach velocity sampling with Velocity Obstacle cones. |
| **Kinematic Hybrid A\*** | `B2` | Classical Baseline | Continuous SE(2) non-holonomic graph search with clearance heuristics. |
| **Predictive (Nominal)** | `P1` | Ablation 1 | Constant turn-rate trajectory forecasts running on a fixed 1.0s periodic timer. |
| **Risk-Aware** | `P2` | Ablation 2 | Multi-hypothesis forecasts with continuous spatial risk field cost on a fixed clock. |
| **Risk-Adaptive + MRM** | `P3` | Flagship Proposal | **Dynamic event-triggered replanning on risk jump ($\Delta R$) or conformal cone violation** + Minimal-Risk Manoeuvre (MRM) fallback. |

---

## 🛣️ The Five Unstructured Indian Road Scenarios

1. `SCENARIO_1_VILLAGE_ROAD`: Narrow unmarked asphalt, potholes, unpaved shoulders, and oncoming heavy vehicle forcing lateral off-center bypass.
2. `SCENARIO_2_URBAN_INTERSECTION`: Busy unsignalized crossroad with zero traffic signals, cross-cutting auto-rickshaws, and swarming two-wheelers.
3. `SCENARIO_3_HIGHWAY_MERGE`: High-speed corridor with slow tractors/rickshaws merging from unpaved side ramps at acute angles.
4. `SCENARIO_4_DENSE_MARKET`: Flanked by vendor fruit stalls and parked vehicles; stress-tests **occluded emergence** of sudden crossing pedestrians.
5. `SCENARIO_5_CATTLE_CROSSING`: Bovine obstacles entering the roadway and halting mid-lane, testing early risk anticipation vs panic braking.

### Seed Splits (Anti-Overfitting Protocol)
- **`tune` split**: Seeds 1000 – 1009 (10 seeds for hyperparameter tuning)
- **`validate` split**: Seeds 2000 – 2009 (10 seeds for sensitivity analysis)
- **`frozen_test` split**: Seeds 3000 – 3029 (**30 independent seeds** per scenario frozen for final evaluation, fulfilling G5).

---

## 📊 Pilot Experiment Results (Layer 1 Gate)

Evaluated on `SCENARIO_5_CATTLE_CROSSING` across all 10 tune seeds with 1,000 bootstrap resamples (see [`docs/PILOT_REPORT.md`](docs/PILOT_REPORT.md)):

| Planner | Collision Rate (95% CI) | Min Clearance (95% CI) | Mean Jerk (95% CI) | P95 Latency (95% CI) | Mean Replans |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **B1** (DWA-VO) | 0.0% [0.0%, 0.0%] | 4.94m [4.93, 4.96] | 11.13 m/s³ [9.73, 12.41] | 2.28 ms [2.00, 2.61] | 120.0 |
| **P1** (Predictive) | 100.0% [100.0%, 100.0%] | 4.33m [3.71, 4.97] | 2.44 m/s³ [2.44, 2.44] | 2.35 ms [2.06, 2.71] | 5.0 |
| **P2** (Risk-Aware) | 0.0% [0.0%, 0.0%] | 3.34m [3.09, 3.61] | 1.11 m/s³ [1.11, 1.12] | 5.36 ms [2.56, 8.35] | 20.0 |
| **P3** (Adaptive) | **0.0% [0.0%, 0.0%]** | **4.45m [3.63, 5.94]** | **1.20 m/s³ [1.14, 1.25]** | **18.53 ms [15.59, 21.45]** | 58.3 |

**Key Hand-Traced Finding**:
- **P3 Dynamic Replan Trigger**: Fired at **$t = 0.70$s** upon detecting conformal prediction cone intersection with the cow stepping into the roadway (`trigger_reason="CONFORMAL_VIOLATION"`).
- **B1 Reactive Intervention**: Fired at **$t = 2.30$s** only after the cattle entered the immediate short-horizon velocity obstacle cone, requiring a harsh 11.13 m/s³ emergency brake.
- **Result**: P3 replanned **1.60 seconds earlier** than B1, producing a smooth anticipatory bypass with **9.3x lower jerk**!

---

## 🚀 Quickstart & One-Command Demo

### ⚡ One-Command Demo Bundle (Clone to Running Demo in < 2 Minutes)
For Hackathon Demo Day or local rapid testing, launch the complete system with one command. No external network, internet access, or MathWorks license checkout required:

**Windows**:
```cmd
scripts\start_demo.bat
```
*or*
```bash
python scripts/start_demo.py
```

**Linux / macOS**:
```bash
chmod +x scripts/start_demo.sh
./scripts/start_demo.sh
```

**What this does automatically:**
1. Verifies Python 3.10+ and runtime prerequisites.
2. Initializes the database and applies Alembic migrations (`alembic upgrade head`).
3. Seeds default user roles (Admin, Researcher, Designer, Guest) and 14 pre-computed benchmark runs.
4. Verifies pre-recorded telemetry files (`storage/runs/` and `studio/public/sample_runs/`).
5. Configures offline mock engine mode (`MOCK_MATLAB=1`, `ENGINE_STRICT_LICENCE=0`).
6. Starts FastAPI backend on `http://127.0.0.1:8000` and Vite Studio on `http://127.0.0.1:5173`.
7. Automatically opens your default browser directly into the **Studio Demo Experience** (`http://127.0.0.1:5173/demo`).
8. **100% Air-Gapped**: Runs entirely offline with zero external network dependencies.

---

## 🐳 Docker Deployment

### 1. Local Development Stack (Full Service Architecture)
Spins up all 6 interconnected services with health checks and volume persistence:
- **`postgres`** (PostgreSQL 16 Alpine with persistent volume)
- **`redis`** (Redis 7 Alpine caching & job queue)
- **`minio`** (S3-compatible object storage with auto-provisioned `apath-logs` and `apath-scenarios` buckets)
- **`api`** (FastAPI backend running non-root `apath:10001` with automated Alembic migration entrypoint)
- **`worker`** (Simulation daemon processing queued runs)
- **`web`** (Studio SPA served via hardened Nginx Alpine with SSE reverse-proxying)

```bash
# Launch full local stack
docker compose up --build
```
- **Studio Web Console**: [http://localhost:3000](http://localhost:3000)
- **FastAPI Documentation**: [http://localhost:8000/docs](http://localhost:8000/docs)
- **MinIO S3 Console**: [http://localhost:9001](http://localhost:9001) (`minioadmin` / `minioadmin123`)

### 2. Production Deployment (Single VM or Managed Container)
For production environments, using strict resource limits, log rotation, and non-root security:

```bash
# 1. Generate cryptographic secrets
python scripts/generate_secrets.py

# 2. Review production environment
cp .env.production.example .env.production

# 3. Launch production stack with restarts and resource quotas
docker compose -f docker-compose.prod.yml up -d
```
- **Hardened Security**: Non-root containers (`UID 10001`), read-only root filesystems, dropped capabilities (`no-new-privileges:true`).
- **Resource Constraints**: CPU limits (1.5 - 2.0 cores) and memory ceilings (1.5 - 2.0 GB) per service.
- **Log Rotation**: `json-file` log driver with 50 MB max size and 5-file rotation.

---

## 💾 Database Migrations, Seeding & Secrets

### Database Migrations
Migrations are managed via Alembic and executed automatically on container boot:
```bash
# Apply pending migrations
python -m alembic -c backend/alembic.ini upgrade head

# Seed initial admin, researcher, and 14 pre-computed benchmark runs
python -m backend.app.seed
```

### Secrets Generation
Generate cryptographically random 64-byte JWT and CSRF secret keys plus high-entropy passwords:
```bash
python scripts/generate_secrets.py
```

---

## 📦 Disaster Recovery: Backups & Tested Restore

ADAPTIVE-PATH includes cross-platform backup and restore tools supporting both PostgreSQL (`pg_dump`) and SQLite (online backup API):

### 1. Create a Cryptographically Verified Backup
```bash
python scripts/backup.py
# Outputs: backups/apath_backup_YYYYMMDD_HHMMSS.tar.gz
# Also updates golden link: backups/apath_backup_latest.tar.gz
```
Every backup bundle includes:
- Dump of database (PostgreSQL SQL dump or SQLite binary snapshot).
- Complete object storage telemetry runs (`storage/runs/`).
- `manifest.json` with SHA-256 integrity checksums for every file.

### 2. Restore from Backup
```bash
python scripts/restore.py backups/apath_backup_latest.tar.gz
```
- Automatically verifies all SHA-256 hashes before unpacking.
- Atomic database restoration with engine connection pool cycling.
- Verifies restored run counts and disk integrity.

### 3. Automated Backup/Restore Regression Test
```bash
python -m pytest backend/tests/test_backup_restore.py -v
```

---

## 📊 Observability, Health Checks & Metrics

### Health Checks
- **Liveness Probe**: `GET /api/health` — returns HTTP 200 `{ "status": "ok", "version": "1.0.0" }`.
- **Readiness Probe**: `GET /api/health/ready` — actively verifies DB connection, disk writeability, and storage status. Returns HTTP 503 if dependencies fail.
- **Metrics Endpoint**: `GET /api/metrics` — exposes operational and simulation counters.

### Structured Logging
Set `APATH_LOG_FORMAT=json` or `ENVIRONMENT=production` in `.env` to emit high-throughput JSON access logs:
```json
{"timestamp":"2026-10-14T08:00:00Z","level":"INFO","event":"request_finished","request_id":"c6f3...","method":"GET","path":"/api/runs","status":200,"duration_ms":12.4,"client_ip":"127.0.0.1"}
```

### Prometheus & Grafana Configuration
Pre-configured monitoring configurations are provided in `monitoring/`:
- **Prometheus Scrape Config**: [`monitoring/prometheus.yml`](monitoring/prometheus.yml)
- **Alert Rules**: [`monitoring/alert_rules.yml`](monitoring/alert_rules.yml) (high error rates, worker latency, storage saturation)
- **Grafana Dashboard**: [`monitoring/dashboards/adaptive_path_dashboard.json`](monitoring/dashboards/adaptive_path_dashboard.json)

---

## 🎪 Demo Day Plan & Failure Drill Runbook

For presentation day, consult [`docs/DEMO_RUNBOOK.md`](docs/DEMO_RUNBOOK.md):
- **Pre-warming Checklist**: Cache warmup, pre-flight verification, browser tab staging.
- **Air-Gapped Offline Mode**: Verified operation without internet or active MathWorks license server.
- **Fallback Video**: Local pre-recorded demo video (`docs/demo_fallback.mp4` / Studio static demo mode) if hardware or projector fails.
- **10-Minute Rapid Failure Drill**: Step-by-step triage guide for sudden container crashes, corrupted databases, or port conflicts.

---

## 🧪 Testing & Verification

### 1. Run Unit Tests (100% Pass)
```bash
python -m pytest tests/ backend/tests/ -v
```

### 2. Run Pilot Experiment
```bash
python scripts/run_pilot.py
```

### 3. Backend API Manual Start (FastAPI + PostgreSQL / SQLite)
```bash
# 1. Apply database migrations
python -m alembic -c backend/alembic.ini upgrade head

# 2. Seed default users and 14 shipped runs
python -m backend.app.seed

# 3. Start API server
python -m uvicorn backend.app.main:app --reload --port 8000
```
- **Interactive Swagger Docs**: [http://localhost:8000/docs](http://localhost:8000/docs)
- **ReDoc Documentation**: [http://localhost:8000/redoc](http://localhost:8000/redoc)
- **OpenAPI 3.1.0 Specifications**: [`schemas/openapi.json`](schemas/openapi.json) and [`schemas/openapi.yaml`](schemas/openapi.yaml)
- **Export Schema Command**: `python export_openapi.py`

---

## 🔐 Endpoint Role Requirements & Authorization Matrix

Enforced strictly via a **Single Unified Authorization Layer** (`Role x Action x Ownership`), avoiding scattered ad-hoc checks. Standard error format on 4xx/5xx: `{"code": str, "message": str, "details": dict, "request_id": str}`.

| Endpoint | Method | Action / Purpose | Guest | Researcher | Designer | Admin | Ownership & Security Rules |
| :--- | :---: | :--- | :---: | :---: | :---: | :---: | :--- |
| `/health` | `GET` | Liveness health check | ✅ | ✅ | ✅ | ✅ | Public operational probe |
| `/health/ready` | `GET` | Readiness probe (DB + Storage) | ✅ | ✅ | ✅ | ✅ | Returns 503 if DB/disk fails |
| `/metrics` | `GET` | Operational metrics | ✅ | ✅ | ✅ | ✅ | Prometheus / JSON metrics |
| `/api/auth/register` | `POST` | User registration | ✅ | ✅ | ✅ | ✅ | Argon2id password hashing |
| `/api/auth/login` | `POST` | Authenticate & issue tokens | ✅ | ✅ | ✅ | ✅ | Lockout backoff (5 fails = lock), rotating refresh cookie |
| `/api/auth/refresh` | `POST` | Rotate refresh token | ✅ | ✅ | ✅ | ✅ | Token family reuse detection & instant revocation |
| `/api/auth/logout` | `POST` | Revoke session & clear cookies | ✅ | ✅ | ✅ | ✅ | Clears SameSite httpOnly cookies |
| `/api/auth/guest` | `POST` | Anonymous preview token | ✅ | ✅ | ✅ | ✅ | 24h scoped guest token |
| `/api/auth/me` | `GET` | Current user profile | ❌ | ✅ | ✅ | ✅ | Requires active session |
| `/api/auth/verify-email` | `POST` | Email verification | ✅ | ✅ | ✅ | ✅ | One-time token verification |
| `/api/auth/forgot-password` | `POST` | Request password reset | ✅ | ✅ | ✅ | ✅ | Dispatches one-time secure token |
| `/api/auth/reset-password` | `POST` | Complete password reset | ✅ | ✅ | ✅ | ✅ | Revokes all prior sessions |
| `/api/auth/sessions` | `GET` | List active sessions | ❌ | ✅ | ✅ | ✅ | Shows IP, user-agent, expiry |
| `/api/auth/sessions/{id}` | `DELETE` | Revoke specific session | ❌ | ✅ | ✅ | ✅ | Session family enforcement |
| `/api/auth/sessions/revoke-all` | `POST` | Revoke all other sessions | ❌ | ✅ | ✅ | ✅ | Retains current session only |
| `/api/auth/account` | `DELETE` | Permanently delete account | ❌ | ✅ | ✅ | ✅ | Requires password verification |
| `/api/scenarios` | `GET` | List catalog & variants | ✅ | ✅ | ✅ | ✅ | Public scenario metadata |
| `/api/scenarios/{id}` | `GET` | Get scenario details | ✅ | ✅ | ✅ | ✅ | Target distance, speed, seeds |
| `/api/scenarios/variants` | `POST` | Author scenario variant | ❌ | ❌ | ✅ | ✅ | **Designers & Admins only** |
| `/api/runs` | `POST` | Enqueue simulation job | ❌ | ✅ | ✅ | ✅ | Quotas enforced; `Idempotency-Key` header |
| `/api/runs/batch` | `POST` | Enqueue batch sweep | ❌ | ✅ | ✅ | ✅ | Multi-seed / multi-planner sweep |
| `/api/runs` | `GET` | Query & list runs (paged) | Shipped | Own+Ship | Own+Ship | All | Guest automatically scoped to shipped |
| `/api/runs/{id}` | `GET` | Run summary | Shipped | Own+Ship | Own+Ship | All | Ownership check enforced |
| `/api/runs/{id}/cancel` | `POST` | Cancel running simulation | ❌ | Own | Own | All | **Cooperative worker cancellation** |
| `/api/runs/{id}/retry` | `POST` | Retry failed run | ❌ | Own | Own | All | Re-enqueues with exponential backoff |
| `/api/runs/{id}/stream` | `GET` | Real-time SSE stream | ❌ | Own+Ship | Own+Ship | All | Server-Sent Events cycle progress |
| `/api/runs/{id}/log` | `GET` | Download / stream run log | Shipped | Own+Ship | Own+Ship | All | **RFC 7233 HTTP Range (206) Partial Content** |
| `/api/runs/{id}/manifest` | `GET` | Lightweight run manifest | Shipped | Own+Ship | Own+Ship | All | Geometry + metrics (omits frames) |
| `/api/runs/{id}/frames` | `GET` | Temporal windowed frames | Shipped | Own+Ship | Own+Ship | All | `start_time` & `end_time` paged slices |
| `/api/benchmarks/summary` | `GET` | Statistical 95% CIs | ✅ | ✅ | ✅ | ✅ | 1,000 bootstrap resamples (G5) |
| `/api/benchmarks/compare` | `GET` | Pairwise comparison deltas | ✅ | ✅ | ✅ | ✅ | Collision diff %, clearance gain, jerk ratio |
| `/api/failures` | `GET` | Module attribution explorer | ❌ | ✅ | ✅ | ✅ | Filter by Perception, Prediction, Risk, Planning |
| `/api/reports` | `POST` | Generate research report | ❌ | ✅ | ✅ | ✅ | Synthesizes Markdown evaluation document |
| `/api/reports` | `GET` | List generated reports | ❌ | ✅ | ✅ | ✅ | Lists research reports |
| `/api/reports/{id}` | `GET` | Get report document | ❌ | ✅ | ✅ | ✅ | Formatted Markdown + JSON |
| `/api/settings/me` | `GET` / `PUT` | Read / update preferences | ❌ | ✅ | ✅ | ✅ | User UI & planner presets |
| `/api/admin/users` | `GET` | List users & quotas | ❌ | ❌ | ❌ | ✅ | **Admin only** (no N+1 via joinedload) |
| `/api/admin/users/{id}/role` | `PUT` | Change user role | ❌ | ❌ | ❌ | ✅ | **Admin only** (audit logged) |
| `/api/admin/users/{id}/quota` | `PUT` | Update run quotas | ❌ | ❌ | ❌ | ✅ | **Admin only** (concurrency & daily limits) |
| `/api/admin/audit-logs` | `GET` | Query security audit trail | ❌ | ❌ | ❌ | ✅ | **Admin only** (immutable log) |
| `/api/admin/system-stats` | `GET` | System & worker stats | ❌ | ❌ | ❌ | ✅ | **Admin only** (active jobs, storage) |

---

### 4. Start ADAPTIVE-PATH Studio (Web Console)
```bash
cd studio
npm run dev
```
- Open `http://localhost:5173/` in your browser.
- **Offline / Zero-Install Mode**: The Studio is pre-bundled with 14 curated sample runs in `studio/public/sample_runs/`, enabling judges to load and replay runs in &lt;10 seconds without any backend or database setup.

---

## ♿ Accessibility & UI Principles (WCAG 2.2 AA)

- **Keyboard Navigation**: Reach and operate every control without a mouse.
  - `Space`: Play / Pause replay
  - `←` / `→`: Step backward / forward 0.1s
  - `[` / `]`: Adjust playback speed (0.5x, 1.0x, 2.0x)
  - `L`: Toggle risk field layer
  - `?`: Open keyboard help modal
- **Screen Reader Support**: Semantic landmarks, single `<h1>` per route, ARIA live regions announcing events: `Replanned at 0.7s: cattle crossing, risk 0.72`.
- **Non-Color-Only Risk Representation**: Risk is denoted through striped hazard patterns, text labels (`LOW`, `MEDIUM`, `HIGH`, `CRITICAL`), and numerical percentages.
- **Theme Support**: Dark theme (default), Light theme, and High-Contrast (WCAG AAA).

---

## 📄 License & Attribution
Developed for Smart India Hackathon 2026 (Problem SIH26037, MathWorks). Simulation and research benchmarking only.
