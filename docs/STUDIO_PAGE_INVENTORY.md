# ADAPTIVE-PATH Studio — Page Inventory

**Date:** 2026-11-03  
**Auditor:** Principal Product Designer & Senior React Engineer  
**Branch:** `studio/ui-development`

This document provides a comprehensive audit of all 18 existing view components in `studio/src/pages/`, documenting their route, purpose, current implementation state, and required product improvements.

---

## Page Inventory Table

| View Component | Route | Primary Purpose | Current Implementation State | Required Improvements |
| :--- | :--- | :--- | :--- | :--- |
| **`Landing.tsx`** | `/` | Product landing page, SIH overview, feature highlights, and entry points. | **Partially Working**<br>Interactive, links to `/demo` and `/app`. Academic hero copy. | Rewrite into clear, professional, plain English. Replace research jargon with benefit-oriented features. Add quick scenario preview video/gif. |
| **`Demo.tsx`** | `/demo` | Fast entry point for guest users without registration. | **Fully Working**<br>Auto-calls `guestLogin()` and redirects to `/app`. | Make transition smoother with a friendly loading card explaining that 14 verified simulation runs are being prepared. |
| **`Dashboard.tsx`** | `/app` | Main dashboard; overview of simulation runs and high-level KPIs. | **Partially Working**<br>Loads runs from API or falls back to `/sample_runs/manifest.json`. | Convert into the new unified **HOME** workspace. Replace raw KPIs with intuitive badges. Provide 1-click "New Simulation" button. |
| **`NewRun.tsx`** | `/app/runs/new` | Simulation preparation and launch console. | **Partially Working**<br>Form supports single and batch parameters; posts to backend. | Transform into the **SIMULATE (Prepare)** step-by-step workflow: Step 1 (Choose Road Scenario) $\to$ Step 2 (Choose Driving Strategy) $\to$ Step 3 (Review & Start). Add offline fallback helper. |
| **`ReplayView.tsx`** | `/app/runs`<br>`/app/runs/:id` | Core 2D canvas simulation visualizer, timeline playback, and telemetry meters. | **Fully Working**<br>30+ FPS canvas rendering with 5 layer toggles, scrubber, and accessible data table toggle. | Add persistent on-canvas visual color legend. Add plain-English subtitles to telemetry meters (e.g. "Ride Smoothness" next to Jerk). Enable progressive disclosure for Research Mode. |
| **`CompareView.tsx`** | `/app/compare` | Dual side-by-side synchronized canvas for comparing two driving strategies. | **Broken (Build Error)**<br>Contains TypeScript error with `'Tie'` string assignment; otherwise functional. | Fix TypeScript type assignment. Integrate within the **RESULTS** workspace to allow instant comparison between baseline and adaptive planners on any selected scenario. |
| **`Scenarios.tsx`** | `/app/scenarios` | Catalog of Indian mixed-traffic road scenarios. | **Partially Working**<br>Displays 6 cards with descriptions, agent mix, and road geometry. | Realign scenario cards with the 5 canonical engine scenarios (`SCENARIO_1_VILLAGE_ROAD` through `SCENARIO_5_CATTLE_CROSSING`). Add visual thumbnail illustration for each road condition. |
| **`ScenarioDetail.tsx`**| `/app/scenarios/:id`| In-depth scenario specifications, agent spawn ranges, and default run launch. | **Partially Working**<br>Displays parameters and quick-launch button. | Simplify parameter descriptions into human terms (e.g., "Road Width: 6.4m to 7.6m (Narrow, 2-lane asphalt with unpaved dirt shoulders)"). |
| **`BenchmarkView.tsx`**| `/app/benchmark`| Ablation benchmark table comparing all 6 planners with bootstrap confidence intervals. | **Partially Working**<br>Uses hardcoded static pilot array from Oct 14. Accessible table toggle works. | Connect to dynamic benchmark manifest loader (`val_b_manifest.json`). Present plain-English performance comparisons (e.g. "Zero Collisions", "89% Smoother Ride"). |
| **`FailuresView.tsx`** | `/app/failures` | Attribution taxonomy classifying simulation failures into perception, prediction, risk, planning. | **Partially Working**<br>Static list of 4 failure records with functional jump-to-time in Replay. | Link dynamically to actual simulation runs flagged with `failure_tag`. Explain failure causes in plain terms (e.g., "Animal stopped abruptly mid-road"). |
| **`ReportsView.tsx`**  | `/app/reports` | Research synthesis reports for competition and jury submission. | **Partially Working**<br>Static markdown string from Oct 14 with copy and download buttons. | Allow exporting reports based on actual selected runs or authentic validation manifests. Provide both Executive Summary (simple) and Technical Jury formats. |
| **`SettingsView.tsx`** | `/app/settings/profile` | User preferences, visual theme, text scaling, and audio announcements. | **Fully Working**<br>WCAG 2.2 AA compliant. Cycles Light, Dark, High-Contrast, and text scales 100%–200%. | Keep as a clean secondary workspace. Group accessibility toggles prominently. |
| **`AdminView.tsx`**    | `/admin/users` | User management and audit logs for administrative accounts. | **Partially Working**<br>Visible only for admin role. | Ensure safe mock/guest behavior when running in offline standalone mode. |
| **`Login.tsx`**        | `/login` | Email/password sign-in with guest bypass option. | **Fully Working**<br>Form validation and guest login. | Ensure guest mode is prominently highlighted for zero-friction evaluation. |
| **`Signup.tsx`**       | `/signup` | User account registration. | **Fully Working**<br>Form validation and role assignment. | Secondary view; maintain as clean standard form. |
| **`ResetPassword.tsx`**| `/reset-password` | Password recovery form. | **Fully Working**<br>Standard multi-step reset form. | Secondary view; maintain as clean standard form. |
| **`NotFound.tsx`**     | `*` | 404 error page. | **Fully Working**<br>Accessible fallback with navigation back to Home. | Maintain. |
| **`Overview.tsx`**     | (Legacy) | Deprecated prototype dashboard replaced by `Dashboard.tsx`. | **Deprecated / Redundant** | Mark for deprecation/cleanup. |

---

## Consolidation into Proposed 4-Workspace Product Architecture

To eliminate navigation confusion and cognitive overload, the 18 views will be organized into 4 primary intuitive workspaces:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        PRIMARY PRODUCT NAVIGATION                      │
├───────────────────┬────────────────────────────────────────────────────┤
│ 1. HOME           │ Combines Landing / Overview, System Readiness,     │
│                   │ Recent Simulation Runs, and Scenario Library.      │
├───────────────────┼────────────────────────────────────────────────────┤
│ 2. SIMULATE       │ Guided 3-step preparation: Scenario -> Strategy    │
│                   │ -> Review & Run, with Live Road Canvas.            │
├───────────────────┼────────────────────────────────────────────────────┤
│ 3. RESULTS        │ What happened: Success/Failure status, clearance,  │
│                   │ driving smoothness, Replay Viewer, side-by-side    │
│                   │ Comparison, and Downloadable Reports.              │
├───────────────────┼────────────────────────────────────────────────────┤
│ 4. RESEARCH       │ Deep dive for engineers: Predicted obstacle paths, │
│                   │ 95% confidence cones, road safety heatmaps,        │
│                   │ candidate paths, and failure attribution.          │
└───────────────────┴────────────────────────────────────────────────────┘
```

