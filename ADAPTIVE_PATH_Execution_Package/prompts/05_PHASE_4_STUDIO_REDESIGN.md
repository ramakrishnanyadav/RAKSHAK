# 05 — PHASE 4: STUDIO EXPERIENCE REDESIGN AND LIVE SIMULATION
Read standing rules and PROGRESS. Confirm previous phase evidence. Preserve engine and contracts.

## Product objective
Make ADAPTIVE-PATH understandable to a non-expert in 30 seconds while keeping research depth one click away.

Three modes, one engine, one log format, one authoritative metrics service:

### Experience Mode
For judges and general audience. Simple one-screen demonstration.

### Research Mode
Predictions, uncertainty, risk, dynamics, planner internals, controller outputs, decision records and telemetry.

### Evaluation Mode
Planner comparisons, multi-seed results, CIs, effect sizes, calibration and failure cases.

## Flagship scenario
Open `/demo` directly into:
**Cattle Crossing — Narrow Unmarked Village Road.**

Do not redirect to a generic dashboard.

## Experience screen
- Large central top-down road simulation.
- Clearly identifiable autonomous vehicle.
- Other vehicles, cattle/pedestrians and road boundaries.
- Slim status bar: provenance, scenario, planner.
- Telemetry chips: speed, risk status, decision.
- Plain-language decision explanation.
- Timeline and play/pause/speed/reset.
- Actions: Run New Simulation and Replay Experiment.

## Provenance and run classes
Always show LIVE SIMULATION, RECORDED EXPERIMENT or SAMPLE DATA.
Also retain `run_class=experiment` or `run_class=interactive`.
A demo cancellation is interactive and excluded from research claims. An SAP experiment cancellation remains in ITT denominator.
Never silently fall back to sample data if engine execution fails.

## Visualization presets
- Driving View: road, vehicle, agents.
- Prediction View: plus possible futures and uncertainty.
- Decision View: plus real risk grid (if Phase 3 complete), selected path and decision markers.

If Phase 3 is not complete, show scalar risk explicitly labelled `SCALAR RISK`; do not render it as a spatial heatmap. Keep advanced controls in Research Mode.

## Audience terminology
Centralize copy in one file:
- Ego Vehicle -> Autonomous Vehicle.
- Conformal Prediction -> Future Movement Uncertainty.
- Multi-Hypothesis Prediction -> Possible Future Movements.
- Continuous Risk Field -> Road Danger Map (only if actual spatial field exists).
- Event-Triggered Replanning -> Automatic Early Replanning.
- MRM -> Safe Stop Procedure.
- P95 Latency -> Decision Processing Time.
- Ablation Study -> Planner Performance Comparison.

Technical terms remain in Research Mode with glossary.

## 90-second story
1. Normal driving.
2. Hazard appears.
3. System evaluates possible future movements.
4. Risk rises / trigger occurs.
5. Vehicle replans.
6. Vehicle steers, brakes or safely stops.
7. Actual measured evidence appears.

Every animation must reflect engine output. Never use decorative animation to imply an algorithm executed.

## Live lifecycle and transport
Prefer existing SSE. Add WebSocket only if SSE cannot satisfy reconnect/resume; document evidence.
States: CREATED, QUEUED, RUNNING, COMPLETED, FAILED, CANCELLED.
Unique run ID, timestamped transitions, sequence-numbered telemetry.
Handle cancellation, reconnection/resume, worker failure, incomplete logs and stale frames.
Measure simulation timestep, planner time and browser render separately.

## Pause semantics
Pause freezes simulation clock, environment, agents, controller, planner and RNG progression. Browser may render frozen state. Resume from exact state without reseeding. Test and document.

## Visual design
Professional restrained palette, consistent typography/spacing, strong hierarchy, keyboard access, contrast, reduced motion, 1280x720 projector support, Canvas requestAnimationFrame and sensible layer caching. Navigation: Experience / Research / Evaluation.

## Failure case view
Evaluation Mode lists worst runs per planner, failure attribution and decision records; allow replay.

## Automated Playwright acceptance at 1280x720
1. Launch real Python simulation; verify run ID and engine process.
2. Engine failure shows FAILED; no sample fallback.
3. Vehicle UI state at sequence N equals logged engine state at N; checksum or equivalent.
4. Mutation test: changing engine output changes UI.
5. Prediction/risk overlays use engine output; scalar risk clearly labelled until Phase 3.
6. Decision explanation comes from structured records.
7. Metrics come only from authoritative evaluation.
8. Provenance always visible; live/recorded distinct.
9. Failed/incomplete runs displayed and correctly aggregated.
10. Start, pause, resume, reset and cancel work.
11. Cancel terminates worker and marks CANCELLED.
12. Zero uncaught exceptions and zero console.error in scripted flow.
13. Measure first telemetry frame, render frame time and end-to-end duration.
14. Compare numeric budgets to Phase 0 baseline and document hardware.

## Acceptance
A genuine simulation or clearly labelled validated replay works end-to-end; no false live claims; metrics and decisions are traceable; accessible and stable at projector resolution.

Update PROGRESS and provide test evidence. Do not claim “flawless” without these checks.
