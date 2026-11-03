# ADAPTIVE-PATH — Role-Based User Guide

> **Simulation and research platform only** — strictly not road-ready software; never claim real-world safety.  
> Target System: ADAPTIVE-PATH Studio (Smart India Hackathon 2026, Problem SIH26037)

---

## 👥 Table of Roles & Capabilities

| Feature / Action | Guest / Evaluator | Researcher | Scenario Designer | Administrator |
| :--- | :---: | :---: | :---: | :---: |
| **Browse Scenario Catalog** | ✅ | ✅ | ✅ | ✅ |
| **Replay Shipped Benchmark Runs** | ✅ (14 Curated) | ✅ | ✅ | ✅ |
| **Multi-Layer 2D Canvas & Timeline** | ✅ | ✅ | ✅ | ✅ |
| **Statistical Benchmark Tables (95% CI)** | ✅ | ✅ | ✅ | ✅ |
| **Pairwise Baseline Comparison (B1 vs P3)**| ✅ | ✅ | ✅ | ✅ |
| **Launch Single Simulation Run** | ❌ | ✅ | ✅ | ✅ |
| **Launch Multi-Seed Batch Sweeps** | ❌ | ✅ | ✅ | ✅ |
| **Live SSE Telemetry Streaming** | ❌ | ✅ | ✅ | ✅ |
| **Download Raw apath-log/v1 Telemetry** | Shipped only | ✅ | ✅ | ✅ |
| **Failure Mode Attribution Explorer** | ❌ | ✅ | ✅ | ✅ |
| **Automated Research Report Generator** | ❌ | ✅ | ✅ | ✅ |
| **Author Scenario Variants** | ❌ | ❌ | ✅ | ✅ |
| **User Role & Quota Management** | ❌ | ❌ | ❌ | ✅ |
| **System Health & Worker Monitoring** | ❌ | ❌ | ❌ | ✅ |
| **Immutable Security Audit Log Queries** | ❌ | ❌ | ❌ | ✅ |

---

## 1. 🎓 Guest & Evaluator Guide

The Guest mode is designed for hackathon judges, peer reviewers, and evaluators who want to inspect the system immediately without creating an account or installing local database servers.

### Step 1: Accessing the Studio
1. Open your browser and navigate to the Studio Web Console:
   - **Local Dev / Standalone**: [http://localhost:5173/demo](http://localhost:5173/demo)
   - **Dockerized**: [http://localhost:3000/demo](http://localhost:3000/demo)
2. If prompted on the login screen, click **"Continue as Guest"** to obtain an anonymous preview token.

### Step 2: Browsing the 5 Scenario Families
1. Navigate to the **Scenarios** tab from the top navigation bar.
2. Select any of the 5 Indian road scenario cards:
   - `SCENARIO_1_VILLAGE_ROAD`: Narrow unmarked asphalt with oncoming heavy vehicles.
   - `SCENARIO_2_URBAN_INTERSECTION`: Unsignalized junction with swarming two-wheelers and auto-rickshaws.
   - `SCENARIO_3_HIGHWAY_MERGE`: High-speed corridor with slow vehicles merging at acute angles.
   - `SCENARIO_4_DENSE_MARKET`: High occlusion corridor with sudden crossing pedestrians.
   - `SCENARIO_5_CATTLE_CROSSING`: Wandering bovine obstacles halting mid-lane.

### Step 3: Replaying a Simulation on the 2D Canvas
1. In the **Runs** or **Overview** tab, select a pre-computed run (e.g., `SCENARIO_5_CATTLE_CROSSING` with planner `P3` on seed `1000`).
2. Use the **Interactive Replay Canvas**:
   - Press `Space` to Play/Pause.
   - Drag the timeline scrubber to scrub forwards and backwards in time ($dt = 0.1\text{ s}$).
   - Click the **Replan Flag Pin** on the timeline to jump directly to the exact millisecond when the dynamic replan fired.
3. Toggle visual visualization layers using the layer selector:
   - **World**: Road boundaries, lane markings, curbs, vendor stalls.
   - **Dynamic Tracks**: Tracked bounding boxes and velocities of other agents.
   - **Conformal Uncertainty Envelopes**: Calibrated 95% spatial prediction cones.
   - **Risk Field Heatmap**: Continuous potential field $R(x, y)$ with color-blind safe palettes.
   - **Planned Trajectory**: Active candidate trajectory waypoints.

### Step 4: Comparing Planners Side-by-Side
1. Click **Compare** in the navigation bar.
2. Select **Baseline B1 (Reactive DWA-VO)** on the left and **Flagship P3 (Risk-Adaptive)** on the right for the same scenario and seed.
3. Observe how P3 replans $1.60\text{ s}$ earlier than B1, avoiding the harsh emergency brake that B1 requires.

---

## 2. 🔬 Researcher Guide

Researchers have full capability to enqueue new simulation experiments, perform parameter sweeps, access raw telemetry, and evaluate statistical hypotheses.

### Step 1: Authentication
1. Log in using your researcher credentials or register via `/api/auth/register`.
2. Default seed credentials:
   - **Email**: `researcher@adaptivepath.local`
   - **Password**: `Researcher#2026!`

### Step 2: Launching Simulations
1. Navigate to **Launch Run**.
2. Select your experiment parameters:
   - **Scenario**: Choose from the 5 scenario families.
   - **Planner**: Choose from the ablation ladder (`B0` Static, `B1` Reactive DWA, `B2` Hybrid A*, `P1` Nominal Predictive, `P2` Risk-Aware, `P3` Risk-Adaptive).
   - **Seed**: Enter a seed or pick from the protocol splits (`tune`: 1000–1009, `validate`: 2000–2009, `frozen_test`: 3000–3029).
3. Click **Enqueue Run**. The API returns an immediate `202 Accepted` and streams execution progress via Server-Sent Events (SSE).

### Step 3: Launching Batch Sweeps
1. Navigate to **Batch Sweeps**.
2. Select multiple planners (`B1`, `P2`, `P3`) and a seed range (e.g. frozen-test seeds 3000 to 3029).
3. Click **Execute Batch**. The worker daemon schedules tasks concurrently while respecting your user concurrency quota.

### Step 4: Statistical Evaluation & Confidence Intervals
1. Navigate to **Benchmarks**.
2. The benchmark engine presents the pre-computed or live aggregated statistics across matched seeds:
   - **Collision Rate** with 95% bootstrap confidence intervals ($B=1,000$).
   - **Minimum Clearance Margin** ($m$).
   - **Mean Jerk** ($m/s^3$).
   - **P95 Cycle Latency** ($ms$).
3. Click **Export Report** to download an academic-ready Markdown document summarizing hypothesis tests (paired McNemar and Wilcoxon signed-rank tests).

### Step 5: Failure Mode Explorer
1. Navigate to **Failures**.
2. Filter recorded hazardous incidents ($d < 2.0\text{ m}$) across the 4-tier taxonomy:
   - **Perception Failure**: Sensor occlusion or dropout.
   - **Prediction Failure**: Actor motion diverged from multimodal forecast.
   - **Risk Field Failure**: Potential field gradient underestimation.
   - **Planning/Control Failure**: Kinematic actuator saturation or trajectory timeout.

---

## 3. 🎨 Scenario Designer Guide

Designers construct new road geometries, traffic distributions, and stress-test scenarios.

### Step 1: Authentication
1. Log in with Designer credentials:
   - **Email**: `designer@adaptivepath.local`
   - **Password**: `Designer#2026!`

### Step 2: Authoring a Scenario Variant
1. Send a `POST /api/scenarios/variants` request or use the Studio Scenario Editor:
```json
{
  "scenario_family": "SCENARIO_5_CATTLE_CROSSING",
  "variant_name": "SCENARIO_5_MONSOON_FOG",
  "road_width_m": 5.5,
  "friction_coefficient": 0.45,
  "sensor_range_m": 35.0,
  "obstacle_density": "HIGH",
  "agent_perturbation_noise": 1.5,
  "seed_split": "tune"
}
```
2. Parameter definitions:
   - `road_width_m`: Lateral asphalt clearance between shoulders.
   - `friction_coefficient`: Available tire adhesion limit (simulating rain or mud).
   - `sensor_range_m`: LiDAR/camera field-of-view cutoff.
   - `agent_perturbation_noise`: Variance scaling factor for non-lane motion.

### Step 3: Validating Variant Balance
1. Run a 5-seed sanity sweep on baseline `B0` to ensure the scenario is solvable without forcing impossible physical collisions.
2. Confirm that baseline `B1` and flagship `P3` demonstrate distinguishable clearance margins.

---

## 4. 🛡️ Administrator Guide

Administrators maintain system security, manage user quotas, monitor workers, and execute disaster recovery procedures.

### Step 1: Authentication
1. Log in with Administrator credentials:
   - **Email**: `admin@adaptivepath.local`
   - **Password**: `Admin#2026!`

### Step 2: Managing Users & Quotas
1. Navigate to **Admin Console** (`/admin/users`).
2. Adjust user roles (`Guest`, `Researcher`, `Designer`, `Admin`).
3. Set concurrency and daily execution limits:
   - **Max Concurrent Jobs**: Limit concurrent simulations per researcher to prevent queue starvation.
   - **Daily Run Budget**: Cap daily compute allocations.

### Step 3: Monitoring System Health & Workers
1. Check **System Stats** (`/admin/system-stats`):
   - Active worker pool size and worker heartbeats.
   - Queue depth and average job turnaround latency.
   - Object storage disk utilization for telemetry logs.
2. Health Probes:
   - Liveness: `curl http://localhost:8000/api/health`
   - Readiness: `curl http://localhost:8000/api/health/ready`

### Step 4: Security Audit Trail
1. Query `/api/admin/audit-logs` to inspect an immutable chronological record of:
   - Authentication events (logins, logouts, lockouts, token revocations).
   - Role updates and permission escalations.
   - Scenario and variant authoring operations.
   - Deletion requests.

### Step 5: Backup & Disaster Recovery
1. **Trigger Manual Backup**:
   ```bash
   python scripts/backup.py
   ```
2. **Execute Tested Recovery**:
   ```bash
   python scripts/restore.py backups/apath_backup_latest.tar.gz
   ```
3. Run verification regression suite:
   ```bash
   python -m pytest backend/tests/test_backup_restore.py -v
   ```
