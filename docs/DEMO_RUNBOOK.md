# ADAPTIVE-PATH Studio — Demo Machine Runbook

**Audience**: Judges, Reviewers, and Demo Presenters  
**Problem Statement**: SIH26037 (MathWorks / Smart India Hackathon 2026)  
**System**: Risk-Aware Predictive Path Planning & Simulation Console for Unstructured Indian Roads  
**Classification**: Research & Simulation Prototype (NOT road-ready safety software)

---

## 1. Executive Summary & Architecture Decoupling

ADAPTIVE-PATH Studio is architected with a strict **Engine Adapter Boundary** ([ADR-005](file:///c:/Users/Ramakrishna/Downloads/MINI/docs/decisions/ADR-005-engine-adapter-plugin.md)):

```
┌────────────────────────────────────────────────────────┐
│             ADAPTIVE-PATH Studio Web UI                │
│       (React 18 + TypeScript + 60 FPS HTML5 Canvas)     │
└───────────────────────────┬────────────────────────────┘
                            │ HTTP / SSE Stream
┌───────────────────────────▼────────────────────────────┐
│              Studio API & Worker Service               │
│          (FastAPI + SQLite/Postgres + Job Queue)       │
└───────────────────────────┬────────────────────────────┘
                            │ EngineAdapter Interface
             ┌──────────────┼──────────────┐
             │              │              │
    ┌────────▼───────┐┌─────▼──────┐┌──────▼────────┐
    │ PythonAdapter  ││MatlabAdapter││ ReplayAdapter │
    │ (Reference AV) ││(RoadRunner)││ (Pre-recorded)│
    └────────┬───────┘└─────┬──────┘└──────┬────────┘
             │              │              │
             └──────────────┼──────────────┘
                            ▼
           apath-log v1 JSON / Columnar Storage
```

### Key Architectural Invariant:
**Unplugging MATLAB does not break the Studio.**  
If MATLAB licenses fail, time out, or MATLAB is completely uninstalled, the Studio continues running with zero downtime using the Python Reference Engine and Replay Adapters. Runs from either engine render with **identical visual fidelity** in the Studio viewer.

---

## 2. Pre-Flight Checklist

| Component | Minimum Requirement | Recommended | Status Check Command |
| :--- | :--- | :--- | :--- |
| **Operating System** | Windows 10/11, Ubuntu 22.04, or macOS | Windows 11 / Ubuntu 22.04 | `python -c "import platform; print(platform.platform())"` |
| **Python** | Python 3.10+ (PyTorch, ONNX, NumPy) | Python 3.11 / 3.14 | `python --version` |
| **Node.js** | Node.js 18+ (npm 9+) | Node.js 20 LTS | `node -v && npm -v` |
| **MATLAB** | *Optional* (R2022b+ with Automated Driving Toolbox) | Zero-Licence Emulation Supported | `matlab -batch "disp('MATLAB Ready')"` |
| **Ports** | `8000` (Backend API), `5173` (Studio UI) | Free & unbound | `netstat -ano \| findstr 8000` |

---

## 3. Environment Configuration (`.env`)

Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

Key environment parameters:
```ini
# Engine Configuration
APATH_ENGINE_ADAPTER_DEFAULT=python   # Options: python | matlab | replay
MATLAB_BIN=matlab                     # Path to MATLAB executable (if installed)
MOCK_MATLAB=0                         # Set to 1 to force zero-licence offline mode
ENGINE_STRICT_LICENCE=0               # Set to 1 to strictly fail on missing licence
RUN_TIMEOUT_S=120                     # Maximum process execution timeout
REPLAY_DELAY_MS=5                     # Pacing delay between replayed frames
STORAGE_DIR=./storage                 # Location for apath-log/v1 files
```

---

## 4. Quick-Start (Launching the Stack)

### Step 1: Run the Automated Smoke Test
Before opening the browser, verify end-to-end adapter health and cross-engine metric parity:
```bash
python scripts/smoke_engine_adapters.py
```
*Expected Output*: `ALL ENGINE ADAPTER SMOKE TESTS PASSED (100% OPERATIONAL)`.

### Step 2: Start the Backend API & Simulation Worker
In Terminal 1:
```bash
python -m uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 --reload
```
- API Documentation: `http://localhost:8000/docs`
- Health check: `http://localhost:8000/api/health`

### Step 3: Start the Studio Web UI
In Terminal 2:
```bash
cd studio
npm run dev
```
- Studio Web Console: `http://localhost:5173`

---

## 5. Live Demonstration Scenarios

### Demo Flow 1: Offline Zero-Compute Replay (Instant Demo)
*Demonstrates instant presentation mode without burning simulation CPU.*
1. Navigate to `http://localhost:5173/demo` (Guest Mode).
2. Go to **Runs** -> Click on any pre-recorded run (e.g. `SCENARIO_5_CATTLE_CROSSING` with planner `P3`).
3. Open the **Canvas Top-Down Replay Viewer**:
   - Scrub the timeline slider at $0.25\times$, $1.0\times$, $2.0\times$, $4.0\times$.
   - Toggle visualization layers:
     - **Road Edges & Free Space** (unstructured road boundary polylines)
     - **Dynamic Obstacles** (cattle, two-wheelers, auto-rickshaws)
     - **Predicted Futures & Uncertainty Cones** (95% conformal bounds)
     - **Spatiotemporal Risk Field** (color-coded ego collision hazard)
     - **Chosen Path vs Replanned Trajectory**
   - Click any agent to inspect predicted mode weights and velocities in the telemetry drawer.

---

### Demo Flow 2: Live Python Closed-Loop Simulation
*Demonstrates closed-loop perception $\to$ prediction $\to$ risk $\to$ planning $\to$ control.*
1. In the Studio UI, click **New Simulation Run**.
2. Select:
   - **Scenario**: `SCENARIO_5_CATTLE_CROSSING`
   - **Planner**: `P3` (Adaptive Risk-Triggered Replan)
   - **Engine Adapter**: `Python Reference Engine`
   - **Seed**: `1000`
3. Click **Launch Run**:
   - Observe real-time SSE progress streaming at 30+ FPS.
   - Review live telemetry (ego speed, clearance, jerk, replan trigger reason).
   - Once completed, inspect final metrics and verify zero collisions.

---

### Demo Flow 3: MATLAB / RoadRunner Interoperability
*Demonstrates official MathWorks submission path (SIH26037).*
1. In **New Simulation Run**, select **Engine Adapter**: `MATLAB / RoadRunner`.
2. Launch run:
   - If MATLAB is installed, invokes headless batch mode executing `apath_log_v1_export.m`.
   - If MATLAB is absent, the zero-licence bridge emulates RoadRunner scenario dynamics.
3. Compare the generated log against the Python run:
   - Both outputs are validated against `schemas/apath-log-v1.json`.
   - Metric parity:
     - Goal reached: Identical
     - Collision: Identical
     - Clearance difference: $< 0.35$ m
     - Speed difference: $< 0.50$ m/s

---

### Demo Flow 4: The "Unplugged MATLAB" Test
*Proves resilience against licence failure on demo day.*
1. In `.env` or in the terminal session, simulate MATLAB absence:
   ```bash
   export MOCK_MATLAB=1   # Linux/macOS
   $env:MOCK_MATLAB="1"   # Windows PowerShell
   ```
2. In the UI, launch both MATLAB and Python runs.
3. Observe:
   - The Studio does **not** crash or freeze.
   - The UI displays clean status tags and streams simulation frames normally.
   - No corrupted `.json` files appear in `storage/runs/`.

---

## 6. Failure Handling Demonstrations

The system handles all five critical simulation failure modes with defined states and zero data corruption:

| Failure Mode | Trigger Simulation | Resulting Run State | Behavior & Safety Guarantee |
| :--- | :--- | :--- | :--- |
| **Engine Crash** | Process dies or exits $\neq 0$ | `FAILED` (`ENGINE_CRASH`) | Subprocess terminated; error report logged; partial frames saved to `.partial.json`; primary store uncorrupted. |
| **Hung Run / Timeout** | Simulation loop blocks $> 120$ s | `FAILED` (`TIMEOUT`) | Process forcibly killed via SIGKILL; error report logs last timestamp; worker releases concurrency slot. |
| **Licence Unavailable** | `MATLAB_FORCE_LICENSE_ERROR=1` | `FAILED` (`LICENCE_UNAVAILABLE`) | Rejects immediately without wasting retries; error report provides actionable remedy (`Set MOCK_MATLAB=1`). |
| **Schema Mismatch** | Engine emits malformed JSON | `FAILED` (`SCHEMA_MISMATCH`) | Strict validator intercepts file; rejected from database; errors pinpoint exact invalid property path. |
| **User Cancellation** | User clicks "Cancel" in UI | `CANCELLED` (`CANCELLED_BY_OPERATOR`)| Cooperative check halts engine at next step; partial frames saved cleanly; quota refunded. |

---

## 7. Verification Test Suite

Run the complete 101-test regression suite to verify zero regressions across all modules:
```bash
python -m pytest tests/ -v
```
- `tests/test_engine_adapters_contract.py` (13 tests): Adapter lifecycle, cancellation, schema validity, and parity.
- `tests/test_ml.py` (10 tests): Track A/B prediction, conformal calibration, ONNX parity ($< 10^{-4}$), and risk engine.
- `tests/test_planners.py` (8 tests): B0, B1, B2, P1, P2, P3 planners.
- `tests/test_sensors.py` (4 tests): Sensor models, noise, dropout, and transport delays.
- `tests/test_controllers.py` (3 tests): Kinematic bicycle, Pure Pursuit, and PID controllers.

---

## 8. Troubleshooting

### Problem: Port 8000 or 5173 is already in use
```bash
# Windows
netstat -ano | findstr 8000
taskkill /PID <PID> /F

# Linux/macOS
lsof -i :8000
kill -9 <PID>
```

### Problem: MATLAB batch invocation fails with licence checkout error
1. Set `MOCK_MATLAB=1` in your environment or `.env` file.
2. Restart backend worker to activate zero-licence emulation mode.

### Problem: Canvas top-down replay is black or blank
1. Check browser console (`F12`) for WebGL / 2D context errors.
2. Verify that `storage/runs/{run_id}.json` exists and is non-empty.
3. Check `http://localhost:8000/api/runs/{run_id}` returns valid JSON.

---

## 9. Demo Day Operational Plan

### 9.1 Pre-Warming Environment Protocol (T-60 Minutes)
To prevent cold-start latencies, JIT compilation lags, or unseeded states during live judging:
1. **Pre-heat Database & Cache**:
   ```bash
   python -m alembic -c backend/alembic.ini upgrade head
   python -m backend.app.seed
   ```
2. **Pre-heat PyTorch & ONNX Inference Engines**:
   ```bash
   python -c "import onnxruntime; from engine.ml.predictor import TrackBPredictor; p = TrackBPredictor(); print('ONNX Pre-warmed:', p.onnx_available)"
   ```
3. **Pre-build Studio Frontend**:
   ```bash
   cd studio && npm run build
   ```
4. **Pre-verify Shipped Runs**:
   Confirm that all 14 baseline and adaptive runs exist in `storage/sample_runs/` and `studio/public/sample_runs/`.

### 9.2 Offline Air-Gapped Mode Execution
Venues often suffer Wi-Fi degradation, captive portals, or mobile hotspot throttling.
The platform is 100% self-contained:
```bash
# Launch air-gapped demo with zero internet connectivity
python scripts/start_demo.py
```
- Operates entirely on `127.0.0.1:8000` and `127.0.0.1:5173`.
- Bypasses external CDNs (all fonts, Lucide SVG icons, and vendor bundles are local).
- Emulates MATLAB cosimulation without remote license server polling.

### 9.3 Fallback Recorded Demo Video
In the catastrophic event of a host OS failure or projector GPU driver crash:
- **Location**: `docs/media/demo_video_cattle_crossing.mp4` and high-resolution WebP session recording in IDE artifacts.
- **Content**: 1080p 60 FPS recording of the flagship Cattle Crossing scenario demonstrating:
  1. Lateral occlusion entry and dynamic herd detection.
  2. Conformal prediction cone expansion.
  3. Calibrated risk field spike to 0.84 (Critical).
  4. Instantaneous adaptive replanning with smooth obstacle circumnavigation.
  5. Statistical ablation comparison chart proving 0% collision rate for P3 vs 100% for B0/P1.

---

## 10. 10-Minute Rapid Failure Drill Runbook

If an anomaly occurs during a live presentation, follow this strict 10-minute drill:

```
┌────────────────────────────────────────────────────────────────────────┐
│                    10-MINUTE RAPID FAILURE DRILL                       │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
           ┌────────────────────────┼────────────────────────┐
           ▼                        ▼                        ▼
     [Min 00 - 02]            [Min 02 - 04]            [Min 04 - 06]
   Port / Process Hung     MATLAB License Fails     Network / Wi-Fi Drops
           │                        │                        │
           ▼                        ▼                        ▼
   Kill ports 8000/5173     Toggle MOCK_MATLAB=1     Switch to One-Command
   Restart start_demo.py    Instant Python fallback   Offline Demo Bundle
           │                        │                        │
           └────────────────────────┼────────────────────────┘
                                    │
           ┌────────────────────────┴────────────────────────┐
           ▼                                                 ▼
     [Min 06 - 08]                                     [Min 08 - 10]
   Database Corrupted                                Total Laptop Crash
           │                                                 │
           ▼                                                 ▼
   Execute restore.py in 15s                         Play Backup Demo Video
   Verified from latest backup                        or Present Shipped HTML
```

### Drill 1 (Minutes 00-02): Port Conflict or Stale Process
* **Symptom**: `OSError: [Errno 98] Address already in use: 8000`.
* **Action**:
  - Windows: `netstat -ano | findstr :8000` -> `taskkill /F /PID <PID>`
  - Linux/macOS: `lsof -ti :8000,:5173 | xargs kill -9`
  - Re-run: `python scripts/start_demo.py`

### Drill 2 (Minutes 02-04): MATLAB License Drops Mid-Presentation
* **Symptom**: `MatlabLicenseUnavailableError: License manager error -15`.
* **Action**:
  - In the Studio UI dropdown, immediately select **Engine Adapter: Python Reference Engine**.
  - Or in the terminal, set `export MOCK_MATLAB=1` / `$env:MOCK_MATLAB="1"`.
  - Re-launch the run. Python executes with identical `apath-log/v1` schema output in under 50 ms.

### Drill 3 (Minutes 04-06): Complete Venue Internet Loss
* **Symptom**: Browser shows `DNS_PROBE_FINISHED_NO_INTERNET` when attempting external requests.
* **Action**:
  - Open browser tab directly to `http://localhost:5173/demo`.
  - The Studio automatically detects offline status, renders the offline banner, and streams all 14 pre-bundled verified sample runs locally.

### Drill 4 (Minutes 06-08): Database or Storage State Corrupted
* **Symptom**: Database query exception or malformed test run record.
* **Action**:
  ```bash
  # Execute automated backup restore in under 15 seconds
  python scripts/restore.py backups/apath_backup_latest.tar.gz
  ```
  - Re-seeds and restores the database to a verified golden checkpoint.

### Drill 5 (Minutes 08-10): Total Display or Machine Freeze
* **Symptom**: Machine freezes, projector disconnects, or OS blue screen.
* **Action**:
  - Open pre-rendered fallback video (`docs/media/demo_video_cattle_crossing.mp4`) on mobile tablet/backup machine.
  - Walk judges through the 5-scenario benchmark comparison tables and failure taxonomy charts printed in `docs/PILOT_REPORT.md`.

