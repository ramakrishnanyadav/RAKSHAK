# ADAPTIVE-PATH Studio — Gap Analysis & Implementation Roadmap

**Date:** 2026-11-03  
**Auditor:** Principal Product Designer, Enterprise UX Architect & Senior React Engineer  
**Branch:** `studio/ui-development`

This document compares the current implementation state of ADAPTIVE-PATH Studio against the target commercial engineering product specifications, establishing an actionable P0/P1/P2 implementation roadmap.

---

## 1. Current State vs. Target Commercial Product

| Evaluation Dimension | Current Studio Implementation | Target Commercial Engineering Product | Gap Severity |
| :--- | :--- | :--- | :--- |
| **User Onboarding & First Impression** | Academic research portal. Explains complex mathematical concepts ($G^2$ clothoids, conformal bounds) on hero section without context. | Simple, welcoming, benefit-driven product experience. First-time non-technical visitors instantly understand what the self-driving car does. | **HIGH (P0)** |
| **Language & Terminology** | Heavy research-paper jargon (*Spatial Risk Field*, *MRM*, *DWA-VO*, *CTRV*, *P95 Latency*). | Plain, natural, professional English default (*Road Safety Map*, *Emergency Safe Stop*, *Reaction Time*) with progressive disclosure for technical details. | **HIGH (P0)** |
| **Production Build Stability** | `npm run build` fails with 6 TypeScript compile errors in `CompareView.tsx` and `types/api.ts`. | Clean compilation with zero TypeScript errors and zero warnings. | **CRITICAL (P0)** |
| **Simulation Canvas Usability** | 2D canvas renders road, vehicles, and paths at 30+ FPS, but lacks any visible color key or legend. | Canvas includes an intuitive, unobtrusive visual legend (Blue Ego, Yellow Traffic, Green Path, Red Hazard). | **HIGH (P0)** |
| **Simulation Preparation Flow** | Form in `/app/runs/new` presents technical inputs ($\alpha$, $R_{\text{crit}}$) and fails abruptly when backend is offline. | Clean 3-step preparation workflow: (1) Choose Scenario $\to$ (2) Choose Strategy $\to$ (3) Review & Start. Shows helpful offline demo guidance if engine is offline. | **HIGH (P1)** |
| **Scenario Catalog Alignment** | Displays 6 scenario cards with names that diverge from the official simulation engine catalog. | Synchronized with the 5 canonical engine scenarios (`SCENARIO_1_VILLAGE_ROAD` through `SCENARIO_5_CATTLE_CROSSING`). | **HIGH (P1)** |
| **Authentic Benchmark Data** | `BenchmarkView.tsx` displays hardcoded static mock arrays from Oct 14 pilot. | Dynamically loads and visualizes authentic simulation manifests (e.g. `runs/val_b_manifest.json`). | **MEDIUM (P1)** |
| **Accessibility Compliance (WCAG 2.2 AA)** | Strong baseline: text scaling (100%–200%), high contrast, screen reader announcements, and data table toggles implemented. | Retain all existing accessibility features while polishing visual focus states and contrast ratios. | **LOW (P2)** |

---

## 2. P0 / P1 / P2 Priority Roadmap

### P0 Priority: Essential Commercial Baseline & Build Stability
1. **Fix Production Build Errors (`npm run build`)**:
   - Resolve TypeScript errors in `studio/src/pages/CompareView.tsx` (map `'Tie'` string to `'neutral'`).
   - Add `mean_jerk_m_s3?: number;` and `near_miss_count?: number;` to `RunManifest.metrics` in `studio/src/types/api.ts`.
   - Verify `npm run build` exits with code 0.
2. **Plain-English Copy Overhaul**:
   - Rewrite `Landing.tsx` hero and feature cards using the approved simple terminology dictionary.
   - Update `Dashboard.tsx` KPI titles and table labels with plain-English headings.
   - Update `ReplayView.tsx` layer toggle names and telemetry meter subtitles.
3. **Canvas Visual Legend & Telemetry Polish**:
   - Add a clean, permanent on-canvas color legend in `ReplayCanvas.tsx`.
   - Add plain-language explanatory subtitles to the live telemetry bar (e.g., "Smooth Ride", "Safe Buffer").

---

### P1 Priority: Workflow Streamlining & Catalog Synchronization
4. **Guided 3-Step Simulation Preparation**:
   - Restructure `NewRun.tsx` into a guided 3-step card workflow:
     - **Step 1: Choose Road Challenge** (visual selection of the 5 Indian road scenarios).
     - **Step 2: Choose Driving Intelligence** (e.g., *ADAPTIVE-PATH Smart Detour* vs. *Standard Lane Follower*).
     - **Step 3: Review & Run** (summary of parameters with 1-click launch).
   - If backend is offline, provide a friendly button: *"Explore 14 Pre-Calculated Drives In Offline Mode"*.
5. **Scenario Catalog Synchronization**:
   - Realign `Scenarios.tsx` cards with the 5 canonical scenarios from `engine/scenarios/registry.py`.
   - Provide realistic road descriptions (unmarked rural asphalt, busy intersection, livestock crossing).
6. **Benchmark & Report Synchronization**:
   - Connect `BenchmarkView.tsx` to read authentic validation manifests (`runs/val_b_manifest.json`).
   - Allow exporting both a Non-Technical Executive Summary and a Technical Jury Report in `ReportsView.tsx`.

---

### P2 Priority: Enterprise Polish & Progressive Disclosure
7. **Research Mode Progressive Disclosure**:
   - Add an accessible toggle switch in the Replay Viewer: **[Simple View | Research View]**.
   - In Simple View: Display road, vehicles, and planned path with plain-English meters.
   - In Research View: Expose conformal uncertainty envelopes, spatial risk scalar values, candidate trajectory bundles, and emergency maneuver traces.
8. **Navigation Simplification**:
   - Streamline the sidebar navigation from 9 individual links into 4 core workspaces:
     - **Home** (`/app`)
     - **Simulate** (`/app/simulate` / `/app/runs/new`)
     - **Results & Compare** (`/app/results`)
     - **Research & Benchmarks** (`/app/research`)
     - Settings (`/app/settings/profile`)

---

## 3. Implementation Dependencies & Risks

1. **Research Codebase Protection (Absolute Constraint)**:
   - All UI development is strictly confined to `studio/` and frontend documentation.
   - Zero changes to `engine/planners/`, `engine/risk/`, `engine/prediction/`, calibration tables, seed registries, or simulation metrics.
2. **Dual Mode Reliability**:
   - The UI must continue to work 100% offline using pre-bundled JSON runs (`studio/public/sample_runs/`) when running without the FastAPI backend.
3. **WCAG 2.2 AA Regression Guard**:
   - Every modified screen must pass existing Vitest component tests (`npm test`) and maintain accessibility tokens (`tokens.css`).

