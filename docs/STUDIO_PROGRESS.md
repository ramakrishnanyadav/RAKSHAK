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
| 2026-11-03 | Proposed UX & Plain-English Design | **COMPLETED** | Formulated redesign plan for Landing, Dashboard, Replay, and Benchmark views with simple non-technical copy and tooltips. |
| Pending | Audit & Design Review Authorization | **AWAITING APPROVAL** | Paused for user approval before modifying application source code. |
| Future | Build & Type Repair | Pending Approval | Fix `CompareView.tsx` and `types/api.ts` compile errors to restore clean `npm run build`. |
| Future | Plain-English UI Implementation | Pending Approval | Implement friendly copy, scenario catalog alignment, and visual canvas legends. |
| Future | Verification & E2E Validation | Pending Approval | Run Vitest suite, Playwright E2E tests, and verify WCAG 2.2 AA compliance. |

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
