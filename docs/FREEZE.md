# ADAPTIVE-PATH — POST-RELEASE FREEZE POLICY & REFERENCE RELEASE RECORD

**Release Commit:** `d489ed9`  
**Branch:** `studio/ui-development`  
**Base Research Commit:** `a33e133` (Gate G3 Approved Baseline)  
**Freeze Status:** **ACTIVE & ENFORCED**  
**Effective Date:** 2026-11-04  

---

## 1. Post-Release Freeze Directives

Pursuant to the final release approval for the Smart India Hackathon 2026 (SIH26037 — MathWorks) demonstration:

1. **Frozen UI Architecture**:
   - The four-workspace navigation hierarchy (**Home**, **Simulate**, **Results**, **Research**) is frozen. No further restructuring of routes, sidebars, or layout hierarchies is permitted.
2. **Protected Research Engine**:
   - Zero changes to `engine/planners/` (B0, B1, B2, P1, P2, P3).
   - Zero changes to `engine/risk/field.py` ($G^2$ continuous spatial risk formulation).
   - Zero changes to `engine/prediction/` and conformal uncertainty calibration artifacts.
   - Zero changes to evaluation seed protocols or dataset splits.
3. **Protected Validation Evidence**:
   - Validation B manifest (`runs/val_b_manifest.json`) and Gate G3 benchmarks are frozen. No metrics may be altered or embellished for presentation purposes.
4. **Change Control Protocol**:
   - Only reproducible critical (P0) or high-severity (P1) defects that threaten demonstration stability may be touched.
   - Any proposed change must be isolated, verified with full unit/backend tests, and committed separately.
5. **Demonstration Focus**:
   - The objective is demonstration reliability, deterministic execution, and scientific transparency — not additional feature development.
6. **Regulatory Boundary**:
   - ADAPTIVE-PATH is an academic research simulation platform developed for SIH 2026. Do not claim production vehicle deployment readiness or real-world road-safety certification.

---

## 2. Verified Demonstration Routes & Endpoints

| Workflow Stage | Route / Endpoint | Verified Functionality | Fallback Mechanism |
| :--- | :--- | :--- | :--- |
| **Home Overview** | `/app` | Live KPI cards (14 test runs, 86% completion, 79% collision-free, 18.5 ms planning latency), mode switcher. | Offline sample runs manifest (`/sample_runs/manifest.json`). |
| **Scenario Catalog** | `/app/scenarios` | 5 Canonical Indian road scenarios with road width, speed limit, and traffic dynamics. | Pre-rendered scenario cards matching `engine/scenarios/registry.py`. |
| **Start Simulation** | `/app/runs/new` | Guided 3-step preparation workflow. Step 1: Environment; Step 2: Strategy (Simple P3 vs B0 / Research 6 Planners); Step 3: Seed review & real launch. | Pre-bundled offline run links displayed when backend offline. |
| **Live Replay** | `/app/runs/:id` | 30+ FPS canvas playback, visual legend, scrub timeline, multi-speed playback, and Judge Fast-Track button. | Pre-packaged static logs in `studio/public/sample_runs/*.json`. |
| **Side-by-Side Compare**| `/app/compare` | Dual synchronized viewports comparing Baseline (B0/B1) vs ADAPTIVE-PATH (P3) on identical seed. | Pre-loaded Scenario 5 Cattle Crossing dual-log comparison. |
| **Research Benchmark** | `/app/benchmark` | Authentic Gate G3 Validation B dataset ($N=25$ episodes across all 6 planners and 5 scenarios). | Static fallback to `/data/val_b_manifest.json`. |
| **Failure Analysis** | `/app/failures` | Attribution taxonomy across perceptual occlusions, dynamic hazards, and boundary constraints. | Pre-analyzed Gate G3 failure episodes. |
| **Audit Reports** | `/app/reports` | Formatted validation report with CSV export for verification. | Client-side CSV generation from authentic metrics. |

---

## 3. Authentic Backup Replay Artifacts

For live presentations where network connectivity or external services may be degraded, the application includes bit-identical, verified pre-bundled run traces:

- **Flagship Demonstration Run (P3 Adaptive AI)**:
  `studio/public/sample_runs/run_scenario_5_cattle_crossing_p3_tune_s1000.json`
  - Scenario: Sudden Cattle Crossing (`SCENARIO_5_CATTLE_CROSSING`)
  - Planner: P3 Adaptive Replanner
  - Outcome: Goal Reached, 0 Collisions, $2.4\text{m}$ min clearance, 3 event-triggered replans, smooth passing maneuver.
- **Flagship Baseline Comparison Run (B1 DWA-VO)**:
  `studio/public/sample_runs/run_scenario_5_cattle_crossing_b1_tune_s1000.json`
  - Scenario: Sudden Cattle Crossing (`SCENARIO_5_CATTLE_CROSSING`)
  - Planner: B1 Reactive Dynamic Window Approach
  - Outcome: Near-Miss / Emergency Stop Failure, $< 0.5\text{m}$ clearance, rough deceleration ($> 14\text{ m/s}^3$ jerk).
- **All Scenario Backup Traces**:
  - Village Road: `run_scenario_1_village_road_p3_tune_s1000.json` & `b1`
  - Urban Intersection: `run_scenario_2_urban_intersection_p3_tune_s1000.json` & `b1`
  - Highway Merge: `run_scenario_3_highway_merge_p3_tune_s1000.json` & `b1`
  - Dense Market: `run_scenario_4_dense_market_p3_tune_s1000.json` & `b1`

---

## 4. Metric Provenance & Traceability

All metrics displayed in the Studio are traceable to authoritative research definitions in `engine/metrics.py`:

| Metric Name | Studio Representation | Authoritative Definition (`engine/metrics.py`) | Provenance Artifact |
| :--- | :--- | :--- | :--- |
| **Goal Completion Rate** | "Completed Trips (%)" | Fraction of episodes where ego vehicle reached goal region without collision. | `runs/val_b_manifest.json` |
| **Collision Rate** | "Collision-Free Runs (%)" | Fraction of episodes where ego vehicle bounding box intersected any obstacle. | `runs/val_b_manifest.json` |
| **Min Clearance Distance** | "Hazard Buffer (m)" | Euclidean distance from ego bounding box to nearest obstacle boundary across all frames. | `RunLog.metrics.min_clearance_m` |
| **Mean / Peak Jerk** | "Ride Smoothness ($m/s^3$)" | Rate of change of longitudinal/lateral acceleration: $j(t) = \frac{da(t)}{dt}$. | `RunLog.metrics.max_jerk_m_s3` |
| **P95 Latency** | "Planning Time (ms)" | 95th percentile execution latency per planning cycle at 10 Hz. | `RunLog.metrics.p95_latency_ms` |
| **Near-Miss Frame Rate** | "Near-Miss Rate (frames/ep)" | Number of simulation frames where clearance $< 1.0\text{m}$ without physical collision. | `runs/val_b_manifest.json` |
| **MRM Interventions** | "Minimum Risk Maneuvers" | Number of times risk exceeded $\Phi_{\text{thresh}} = 0.65$, triggering emergency fallback. | `runs/val_b_manifest.json` |

---

## 5. Documented Known Limitations

1. **Simulation Scope**:
   - The engine simulates 2D planar kinematics and collision geometry using continuous clothoid corridors and separating axis theorem (SAT). It does not model complex 3D vehicle dynamics (e.g. suspension pitch/roll, wet tyre slip curves).
2. **Conformal Exchangeability Boundary**:
   - Conformal prediction guarantees $95\%$ marginal coverage strictly when test-time traffic behavior conforms to calibration distribution assumptions.
   - The Studio explicitly discloses in Research Mode that baseline planners (B0-B2) or severe out-of-distribution shifts do not carry finite-sample coverage guarantees.
3. **Hardware & Adapter Latencies**:
   - The default engine adapter is `python_inprocess`. When testing with MATLAB RoadRunner co-simulation, inter-process communication latency may introduce up to $5\text{–}10\text{ms}$ overhead beyond raw planning execution.
4. **Screen Reader Live Verbosity**:
   - For users utilizing screen readers, the speech narration feature announces replan events at 10 Hz. In dense traffic scenes with frequent replans, users are advised to use the keyboard shortcut `M` to mute speech narration if audio queue saturation occurs.

---

## 6. Demonstration Readiness Checklist

- [x] Node.js production build succeeds cleanly (`npm run build`).
- [x] All 42 Vitest frontend tests pass (`npm test`).
- [x] All 24 backend pytest tests pass (`pytest`).
- [x] 11 authentic Playwright screenshots captured and committed in `docs/screenshots/`.
- [x] Offline fallback verified: Studio operates smoothly without backend connection.
- [x] Simple Mode and Research Mode toggles verified with state persistence.
- [x] Legend color key matches renderer semantics 1:1.
- [x] Zero engine, calibration, or research metric files modified.
- [x] Reference release commit `d489ed9` locked on `studio/ui-development`.
