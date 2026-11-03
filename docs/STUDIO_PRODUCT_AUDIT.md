# ADAPTIVE-PATH Studio — Complete Product & UX Audit

**Date:** 2026-11-03  
**Auditor:** Principal Product Designer, Enterprise UX Architect, Senior React Engineer & Quality Auditor  
**Branch:** `studio/ui-development`  
**Base Research Commit:** `a33e133` (Gate G3 Approved Baseline)  
**Execution Scope:** Phase 1 — Comprehensive Audit Only (No application source modifications)

---

## 1. Overall Product Assessment

ADAPTIVE-PATH Studio is intended to serve as a high-fidelity commercial-grade simulation workspace for risk-aware autonomous driving on unstructured Indian mixed-traffic roads. It must simultaneously satisfy three primary stakeholder groups:
1. **General Users & First-Time Observers**: Require simple, natural, everyday English, clear visual intuition, zero jargon, and straightforward operation.
2. **SIH 2026 Evaluators & Technical Judges**: Need to immediately understand how the autonomous vehicle perceives the world, predicts obstacle motion, evaluates danger, and avoids collisions without painted lane lines.
3. **Research Engineers**: Require low-level inspection of calibrated prediction uncertainty envelopes, continuous risk fields, trajectory candidate cost breakdowns, and emergency safety maneuvers.

### Executive Diagnosis
While the application possesses a functional React 18 / TypeScript architecture with custom Canvas rendering, TanStack Query, and WCAG accessibility provisions (text scaling, high-contrast theme), **the current product suffers from critical usability and architectural flaws**:
- **Severe Language Barrier**: The user interface reads like an academic journal paper rather than professional commercial software. Headings like *"Continuous G² Clothoid Corridors"*, *"Distribution-Free Conformal Prediction Bounds"*, and unexplained acronyms like *MRM*, *DWA-VO*, and *CTRV* alienate first-time users.
- **Fragmented User Workflows**: Instead of a cohesive 3-step workflow (Choose Scenario $\to$ Choose Strategy $\to$ Review & Run), simulation launching is isolated in `/app/runs/new`, replays are in `/app/runs/:id`, benchmarks in `/app/benchmark`, and failures in `/app/failures`.
- **TypeScript Production Build Blocker**: `npm run build` fails with 6 compilation errors in `CompareView.tsx` and `types/api.ts`, preventing clean production deployment.
- **Data Model Disconnect**: Scenario names in the frontend catalog (`Scenarios.tsx`) diverge from the canonical backend catalog in `engine/scenarios/registry.py`.
- **Static / Mocked Displays**: Benchmarks, reports, and failure views contain hardcoded tables from October 14, 2026, failing to expose authentic validation artifacts (e.g. `runs/val_b_manifest.json`).

---

## 2. Core Workspace Inspection

| Workspace | Existing Route | Functional Status | Visual Screenshot | Key Usability / Engineering Finding |
| :--- | :--- | :--- | :--- | :--- |
| **Home / Landing** | `/` | **Partially Working** | `docs/screenshots/01_landing_home.png` | Dense academic hero text. Does not explain *what* the system does in simple terms. Dual CTA confuses users ("Explore Demo" vs "Launch Studio Console"). |
| **Dashboard** | `/app` | **Partially Working** | `docs/screenshots/02_dashboard.png` | Displays 4 KPI cards and a run list table. KPI metrics (e.g. "P95 Latency 18.5ms") lack context. Table action buttons jump directly to replay. |
| **Simulation Preparation** | `/app/runs/new` | **Partially Working** | `docs/screenshots/03_simulation_preparation.png` | Form offers "Single" and "Batch" modes. When backend is offline, launching fails without a helpful offline notice. Uses academic parameter labels ($\alpha$, $R_{\text{crit}}$). |
| **Live Simulation & Replay** | `/app/runs/:id` | **Fully Working** | `docs/screenshots/04_live_simulation_replay.png` | Fast 30+ FPS 2D canvas with 5 layer toggles. Highly functional but lacks an on-canvas visual color legend (e.g., what does yellow vs blue mean?). |
| **Scenarios Catalog** | `/app/scenarios` | **Partially Working** | `docs/screenshots/05_scenarios_catalog.png` | Displays 6 scenario cards, but names diverge from the canonical 5 scenarios in `engine/scenarios/registry.py`. |
| **Comparative Replay** | `/app/compare` | **Broken (Build Error)** | `docs/screenshots/06_compare_view.png` | Side-by-side synchronized canvas. Fails `npm run build` due to `'Tie'` vs `'neutral'` type error. Telemetry delta calculations work once loaded. |
| **Benchmark Results** | `/app/benchmark` | **Partially Working** | `docs/screenshots/07_benchmark_results.png` | Hardcoded mock array of tuning seed 1000 pilot data. Does not load authentic validation manifests (`val_b_manifest.json`). |
| **Failure Explorer** | `/app/failures` | **Partially Working** | `docs/screenshots/08_failures_view.png` | 4 hardcoded failure records with module attribution. Interactive jump-to-time into Replay works. |
| **Reports & Export** | `/app/reports` | **Partially Working** | `docs/screenshots/09_reports_export.png` | Displays static markdown from October 14, 2026. Copy and download buttons work. |
| **Settings & Accessibility** | `/app/settings/profile` | **Fully Working** | `docs/screenshots/10_settings_profile.png` | Text scaling ($100\%$ to $200\%$) and high-contrast theme (`docs/screenshots/11_high_contrast_replay.png`) work reliably. |

---

## 3. The Five Most Critical Usability Problems (With Screenshot Evidence)

### Problem 1: Unintelligible Academic Jargon on Entry Screen
- **Evidence**: [`docs/screenshots/01_landing_home.png`](file:///C:/Users/Ramakrishna/Downloads/MINI/docs/screenshots/01_landing_home.png)
- **Description**: The primary hero section reads: *"A dedicated research platform evaluating non-lane-bound trajectory optimization, conformal uncertainty envelopes, calibrated continuous risk fields, and sub-50ms event-triggered replanning on unstructured Indian mixed-traffic roads."* Feature cards tout *$G^2$ clothoid corridors* and *marginal coverage guarantees*.
- **User Impact**: A non-technical visitor or general evaluator immediately feels lost and cannot grasp the core vehicle capability (navigating roads without lane lines and avoiding unexpected obstacles).

### Problem 2: Missing On-Canvas Visual Color Legend
- **Evidence**: [`docs/screenshots/04_live_simulation_replay.png`](file:///C:/Users/Ramakrishna/Downloads/MINI/docs/screenshots/04_live_simulation_replay.png)
- **Description**: The simulation replay canvas renders blue rectangles, yellow rectangles, green trajectories, red safety zones, and white circles, but provides **zero visual legend** explaining what each color and shape represents.
- **User Impact**: First-time observers cannot tell which box is the self-driving car, which boxes are cattle or pedestrians, or what the red shaded zones signify.

### Problem 3: Disconnected Simulation Workflow
- **Evidence**: [`docs/screenshots/02_dashboard.png`](file:///C:/Users/Ramakrishna/Downloads/MINI/docs/screenshots/02_dashboard.png) and [`docs/screenshots/03_simulation_preparation.png`](file:///C:/Users/Ramakrishna/Downloads/MINI/docs/screenshots/03_simulation_preparation.png)
- **Description**: To run a simulation, the user must navigate from Dashboard to a separate "Launch Run" form (`/app/runs/new`), fill out dense technical dropdowns, click launch, and then be redirected to a separate replay screen. There is no guided, step-by-step preparation flow (Scenario $\to$ Strategy $\to$ Start).
- **User Impact**: High cognitive friction and multiple unnecessary page jumps.

### Problem 4: Hardcoded Mock Data Presented as Empirical Results
- **Evidence**: [`docs/screenshots/07_benchmark_results.png`](file:///C:/Users/Ramakrishna/Downloads/MINI/docs/screenshots/07_benchmark_results.png) and [`docs/screenshots/09_reports_export.png`](file:///C:/Users/Ramakrishna/Downloads/MINI/docs/screenshots/09_reports_export.png)
- **Description**: `BenchmarkView.tsx` and `ReportsView.tsx` render static string literals from October 14, 2026. While the underlying research engine has authentic validation manifests (`runs/val_b_manifest.json`), the Studio frontend presents stale pilot numbers.
- **User Impact**: Violates enterprise product integrity; SIH evaluators see static numbers rather than authentic simulation evidence.

### Problem 5: Cryptic Technical Telemetry Metrics
- **Evidence**: [`docs/screenshots/04_live_simulation_replay.png`](file:///C:/Users/Ramakrishna/Downloads/MINI/docs/screenshots/04_live_simulation_replay.png)
- **Description**: Below the replay canvas, telemetry meters display *"Max Jerk: 2.80 m/s³"*, *"Risk Field: 0.12"*, *"Replans Triggered: 23"*, and *"P95 Latency: 16.76 ms"*.
- **User Impact**: None of these values have layperson explanations. A general user does not know that "jerk" means driving smoothness, or that lower replan latency means faster computer reaction time.

---

## 4. Critical Engineering & Build Risks

1. **Production Build Failure**:
   Running `npm run build` halts with 6 TypeScript errors:
   - `CompareView.tsx`: Lines 159, 166, 173, 180, 187 attempt to assign `'Tie'` to `'A' | 'B' | 'neutral'`.
   - `ReplayView.tsx`: Line 146 references `mean_jerk_m_s3`, which is omitted from `RunManifest.metrics` in `api.ts`.
2. **Missing Live Runner Streaming Contract**:
   `NewRun.tsx` enqueues a simulation via `POST /api/v1/runs`, but there is no real-time WebSocket or Server-Sent Events (SSE) stream to display vehicle motion *as it computes*. The user must wait until the full simulation terminates and download the entire JSON run log.
3. **Scenario Catalog Desynchronization**:
   `Scenarios.tsx` specifies 6 scenario IDs (`SCENARIO_1_UNSTRUCTURED_ROUNDABOUT`, `SCENARIO_2_WRONG_WAY_AUTO`, etc.), whereas the Python reference engine recognizes 5 canonical IDs (`SCENARIO_1_VILLAGE_ROAD`, `SCENARIO_2_URBAN_INTERSECTION`, `SCENARIO_3_HIGHWAY_MERGE`, `SCENARIO_4_DENSE_MARKET`, `SCENARIO_5_CATTLE_CROSSING`).
