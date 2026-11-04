# ADAPTIVE-PATH Studio — UI Development & UX Progress Log

**Branch:** `studio/ui-development`  
**Base Research Commit:** `a33e133` (Gate G3 Approved Baseline)  
**Governance Invariant:** Independent of research progress log (`docs/PROGRESS.md`). Zero modification to `engine/planners/`, `engine/risk/`, `engine/prediction/`, calibration artifacts, seed registries, or simulation metrics.

---

## 1. Workstream Overview

The Studio UI development workstream focuses on creating a modern, accessible, professional frontend experience for the ADAPTIVE-PATH platform. The studio visualizes autonomous vehicle simulation replays, comparative multi-planner benchmarks, failure attributions, and research telemetry.

### Core Principles
1. **Plain-English Accessibility**: Default interface language must be simple, professional English understandable to first-time non-technical visitors, judges, and evaluators, while retaining technical tooltips for researchers.
2. **WCAG 2.2 Level AA Compliance**: 200% text scaling, high-contrast themes, keyboard navigation, screen reader live announcements, and accessible table toggles for all charts.
3. **Dual Execution Modes**: Seamlessly operates in **Offline / Demo Mode** (pre-bundled verified runs and manifests) and **Live Simulation Mode** (connected to Python backend engine).
4. **Strict Isolation**: Frontend source code changes do not alter underlying engine planners or research definitions.

---

## 2. Milestone Tracking

| Date | Phase / Milestone | Status | Key Deliverable / Finding |
| :--- | :--- | :--- | :--- |
| 2026-11-03 | Studio UI Branch Creation | **COMPLETED** | Created isolated branch `studio/ui-development` based on `a33e133`. |
| 2026-11-03 | Comprehensive Studio Audit | **COMPLETED** | Audited all 18 views, build status, types, i18n, and WCAG accessibility. Identified 6 TypeScript build blockers and excessive academic jargon. |
| 2026-11-03 | Real Workspace Screenshot Capture | **COMPLETED** | Captured 11 high-res authentic screenshots across all views using headless Playwright (`docs/screenshots/`). |
| 2026-11-03 | Deliverable Documentation Suite | **COMPLETED** | Generated `STUDIO_PRODUCT_AUDIT.md`, `STUDIO_PAGE_INVENTORY.md`, `STUDIO_COMPONENT_MAP.md`, `STUDIO_API_INTEGRATION_MAP.md`, `STUDIO_LANGUAGE_AUDIT.md`, `STUDIO_GAP_ANALYSIS.md`. |
| 2026-11-03 | Phase 1 Audit Gate Approval | **APPROVED** | Phase 1 audit approved by user at commit `20d68b3`. Phase 2 implementation authorized with strict engine protection invariants. |
| 2026-11-03 | P0: Production Build & Type Repair | **COMPLETED** | Corrected `CompareView.tsx` result mapping (`'Tie'` -> `'neutral'`) and aligned `api.ts` `RunManifest.metrics` (`near_miss_count`, `mean_jerk_m_s3`) to authoritative schema `engine/apath_log/schema.py`. `npm run build` exits 0. Vitest passes 17/17. Commit `6b99267`. |
| 2026-11-03 | P0: Canonical Scenario Synchronization | **COMPLETED** | Synchronized `Scenarios.tsx`, `ScenarioDetail.tsx`, and `NewRun.tsx` to the 5 canonical scenarios in `engine/scenarios/registry.py`. Added `LEGACY_SCENARIO_COMPATIBILITY_MAP` for historical run replay compatibility. Verified 5 canonical cards, 5 selection options, and engine world builders. Vitest passes 24/24. Commit `53b5bfe` / `6b41a02`. |
| 2026-11-04 | P0: Plain-English Content Simplification | **COMPLETED** | Overhauled `Landing.tsx` with approved positioning ("Smart Driving for India's Unpredictable Roads"), 3 clear driving pillars, walkthrough sections, and non-commercial research prototype notice. Overhauled `Dashboard.tsx` KPIs to "Total Test Runs", "Completed Trips", "Collision-Free Runs", and "Average Planning Time" with defined calculations. Exposed all 6 canonical planners in `NewRun.tsx`. Refined i18n and telemetry labels. Vitest passes 24/24. Commit `1c4d120`. |
| 2026-11-04 | P0: Visual Canvas Legend & Interpretation | **COMPLETED** | Completed 1:1 renderer color and geometry audit of `ReplayCanvas.tsx`. Implemented semi-transparent, non-obstructive visual interpretation legend (`bottom: 12px; left: 12px`) mapping Self-Driving Car (`#0284c7`), Planned Route (`#10b981`), Moving Traffic (`#f59e0b`), Safety Margins (`#38bdf8`), Hazard Risk Area (`#ef4444` crosshatch), and Road Boundaries (`#64748b`). Added interactive layer toggles with keyboard accessibility and hide/show collapse state. Updated screenshot `04_live_simulation_replay.png`. Added 2 unit tests in `ReplayCanvas.test.tsx` (25/25 vitest tests pass; `npm run build` exits 0). Commit `7961d2b`. |
| 2026-11-04 | P1: Guided 3-Step Simulation Experience | **COMPLETED** | Redesigned `NewRun.tsx` into a guided 3-step workflow (Step 1: Choose Environment with 5 canonical scenarios; Step 2: Choose Driving Strategy with Simple Mode P3 Adaptive vs B0 Baseline, and Research Mode exposing all 6 authentic planners B0, B1, B2, P1, P2, P3 with experimental purposes; Step 3: Review Configuration & Launch with seed validation and real engine dispatch). Added real error handling without mock simulation faking. Added 6 comprehensive unit tests in `NewRun.test.tsx` (31/31 Vitest tests pass; `npm run build` exits 0). Updated screenshot `03_simulation_preparation.png`. Commit `c42e683`. |
| 2026-11-04 | P1: Authentic Benchmark Integration | **COMPLETED** | Replaced hardcoded benchmark data in `BenchmarkView.tsx` with authentic research validation dataset from `runs/val_b_manifest.json` ("Validation B — Research Experiment", Gate G3). Added backend endpoint `GET /api/benchmarks/val_b` with fallback to `/data/val_b_manifest.json`. Displays authentic research provenance (Git commit `07fa1ff019`, timestamp, seeds `[2005..2009]`, $N = 25$ pooled episodes across 5 scenarios, and per-scenario breakdowns). Displays exact metrics per `engine/metrics.py` (goal completion rate, collision rate, mean min clearance, mean jerk, P95 latency, temporal near-miss frames with per-episode rate, and MRM activations/recoveries). Added 4 unit tests in `BenchmarkView.test.tsx` (35/35 Vitest tests pass; `npm run build` exits 0). Updated screenshot `07_benchmark_results.png`. Commit `316a8c6`. |
| 2026-11-04 | P1: 4-Workspace Navigation Restructuring | **COMPLETED** | Consolidated navigation into four distinct primary workspaces: **HOME** (Overview `/app`), **SIMULATE** (Scenarios `/app/scenarios`, New Simulation `/app/runs/new`), **RESULTS** (Run History `/app/runs`, Compare Runs `/app/compare`, Reports `/app/reports`), and **RESEARCH** (Benchmark `/app/benchmark`, Failure Analysis `/app/failures`). Nested Compare inside Results. Kept Settings and Admin as secondary utilities at the bottom. Preserved deep link URLs, active-item indicators, and added full ARIA accessible navigation structure. Added 5 unit tests in `NavigationRail.test.tsx` (40/40 Vitest tests pass; `npm run build` exits 0). Updated screenshots `02_dashboard.png` and `06_compare_view.png`. Commit `9f54108`. |
| 2026-11-04 | P1: Simple Mode & Research Mode | **COMPLETED** | Implemented persistent dual-mode architecture: **Simple Mode** (plain-English vehicle decisions, P3 recommended vs B0 baseline, simplified telemetry, uncluttered canvas layers) and **Research Mode** (all 6 canonical planners, full continuous risk-field metrics, 95% conformal prediction envelopes with explicit calibration provenance & out-of-distribution disclosure, P95 latency). Synced across HeaderBar, NewRun preparation, Replay Viewer, Dashboard, and Comparative Replay. Preserved user scenario and planner context across mode transitions. Fixed Windows path resolution in simulation worker (`backend/app/worker.py`). Added 2 unit tests in `PresentationMode.test.tsx` (42/42 Vitest tests pass, 19/19 backend pytest tests pass; `npm run build` exits 0). Recaptured all 11 authentic screenshots. |
| 2026-11-04 | Final Release Gate Audit | **PASSED (READY FOR DEMO)** | Completed full end-to-end verification, backend simulation lifecycle, research integrity validation (zero modifications to `engine/` or calibration tables), UI quality audit, accessibility compliance, and SIH demonstration playbook. |

---

## 3. Comprehensive Studio Audit Findings

### A. Build & Compilation Status
- **Vitest Unit Tests**: **17 / 17 PASSED** across 5 test suites (`I18n.test.tsx`, `ReplayCanvas.test.tsx`, `StatusState.test.tsx`, `ReplayTimeline.test.tsx`, `AccessibleTable.test.tsx`).
- **Production Build (`npm run build`)**: **FAILED (6 TypeScript Errors)**:
  1. `src/pages/CompareView.tsx(159, 166, 173, 180, 187)`: Type error: `'Tie'` is not assignable to type `'A' | 'B' | 'neutral'`. (Lines 145–150 assign `'Tie'` instead of `'neutral'`).
  2. `src/pages/ReplayView.tsx(146, 50)`: Property `mean_jerk_m_s3` does not exist on type `RunManifest.metrics` in `studio/src/types/api.ts`.
- **Remediation Plan (Post-Approval)**:
  - Update `studio/src/types/api.ts` to include `mean_jerk_m_s3?: number;` and `near_miss_count?: number;` on `RunManifest.metrics`.
  - Fix `better` values in `CompareView.tsx` to map `'Tie'` to `'neutral'`.

### B. Language & Non-Technical Usability Audit
- **Current Defect**: Current text across `Landing.tsx`, `Dashboard.tsx`, and `Scenarios.tsx` relies heavily on academic, research-centric jargon:
  - *"Non-Lane Driveable Space (G2): Optimizes continuous $G^2$ clothoid corridors over irregular road boundaries..."*
  - *"Conformal Prediction Cones (G3): Multi-hypothesis motion forecasting... guaranteeing 95% marginal coverage"*
  - Technical abbreviations presented without context: *MRM*, *DWA-VO*, *CTRV*, *P95 Latency*, *Separating Axis Theorem*.
- **Impact**: Non-technical visitors or first-time evaluators struggle to understand the core purpose of the project.
- **Proposed Redesign**:
  - Replace dense academic language with clear, friendly, benefit-driven English.
  - Retain technical depth through optional hover tooltips and an "Expand Technical Details" toggle for research juries.

### C. Scenario Model & Catalog Alignment
- **Current Defect**: `Scenarios.tsx` hardcodes 6 legacy scenario names (e.g. `SCENARIO_1_UNSTRUCTURED_ROUNDABOUT`, `SCENARIO_2_WRONG_WAY_AUTO`), which do not match the canonical 5 scenarios in `engine/scenarios/registry.py` (`SCENARIO_1_VILLAGE_ROAD`, `SCENARIO_2_URBAN_INTERSECTION`, `SCENARIO_3_HIGHWAY_MERGE`, `SCENARIO_4_DENSE_MARKET`, `SCENARIO_5_CATTLE_CROSSING`).
- **Remediation Plan**: Align the scenario catalog cards to the official 5 scenarios with descriptive real-world context (Village Road, Urban Intersection, Highway Merge, Dense Market, Sudden Cattle Crossing).

### D. Replay Viewer & Canvas Usability
- **Strengths**: Canvas renderer supports 5 layer toggles (World, Tracks, Conformal Cones, Risk Field, Ego Plan) and 30+ FPS performance.
- **Identified UX Enhancements**:
  - Add a persistent visual color key/legend on the canvas (Blue: Autonomous Vehicle, Yellow: Other Vehicles/Animals, Red: High Collision Risk, Green: Clear Driveable Space).
  - Add human-friendly descriptions next to telemetry meters (e.g. "Ride Smoothness" next to Jerk).

---

## 4. Documented Integration Dependencies
1. **Dynamic Benchmark Manifest Loading**:
   - Backend API or static route to serve `runs/val_b_manifest.json` so `BenchmarkView.tsx` displays authentic Validation B empirical data instead of hardcoded pilot numbers.
2. **Offline Simulation Notice**:
   - In `NewRun.tsx`, when backend is disconnected, clearly display an informative status card guiding users to explore the 14 verified offline runs or launch the backend server.

---

## 5. Next Steps (Awaiting Approval)
1. Present this audit report and proposed UX design to the user for formal approval.
2. Upon approval, apply targeted fixes to `studio/src/types/api.ts` and `studio/src/pages/CompareView.tsx` to restore clean `npm run build`.
3. Implement proposed plain-English copy across Landing, Dashboard, and Scenario views.

