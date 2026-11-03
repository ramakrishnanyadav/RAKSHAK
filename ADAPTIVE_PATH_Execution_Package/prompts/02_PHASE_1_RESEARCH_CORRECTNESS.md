# 02 — PHASE 1: RESEARCH CORRECTNESS
Read standing rules and `docs/PROGRESS.md`. Confirm G1 approval. Work only on Phase 1.

## Critical ordering
F4 calibration integration MUST happen before the final F3 correction/validation. Changing uncertainty envelopes changes P3 risk and replanning behaviour. Therefore:
1. Define/approve metrics, risk and dynamics; stop at G2.
2. Implement F4 calibration integration.
3. Diagnose F3 using existing logs and validation data.
4. Fix F3 after F4 is wired.
5. Re-run all final F3 validation after calibration integration and the F3 fix.
6. Any later change to prediction envelopes, calibration, risk thresholds or controller behaviour invalidates the final F3 validation and requires another validation run.
Record this ordering in `docs/DECISIONS.md`.

## Step 1 — Definitions and G2
Prepare:
- `docs/METRICS.md`
- `docs/RISK_DEFINITION.md`
- Update `docs/DYNAMICS.md` if audit gaps remain.
- Draft `docs/SAP.md` using `templates/SAP_TEMPLATE.md`.

Define mathematically, with units, denominators and edge cases:
collision rate; goal completion; near miss; minimum clearance; longitudinal/lateral/vector jerk; mean absolute/RMS/max jerk; mean speed; progress efficiency; first intervention time; MRM activation/recovery; mean/P95 planner latency; safe-progress rate.

For jerk specify finite differences, variable dt, smoothing/filtering, initial samples, coordinate frame, signed/absolute/RMS definitions.

For near miss specify minimum clearance and TTC thresholds, justification and sensitivity thresholds.

For goal completion specify goal region, predicate, terminal speed, frame conventions and timeout.

For progress specify reference path, reverse motion and detours.

Risk definition must distinguish probability, severity and dimensionless risk score. Document static/dynamic/road-boundary/uncertainty components, normalization, weights, frame, temporal resolution and thresholds.

SAP must specify primary endpoint/contrast, baseline selection rule, hypothesis, margin if non-inferiority, alpha, power, sample-size method, paired analysis, secondary family, Holm correction and exclusions.

**STOP at G2.** Wait for explicit approval before implementing metric/risk thresholds or calibration changes.

## Step 2 — F4 calibration integration (after G2)
- Inspect actual predictor/calibrator call graph.
- Wire fitted quantile into the default prediction path.
- Calibration unit is independent simulation episode.
- One score per episode/class/horizon; document multi-agent aggregation (maximum is conservative but may widen envelopes).
- Episodes without class do not count as zero error.
- Use `k = ceil((n + 1) * (1 - alpha))`; k-th ordered score; if k > n use infinite quantile.
- Define minimum n. Below it, coverage unavailable; no default.
- Persist class/horizon quantiles and calibration artifact hash.
- Record calibration planner/scenario source.
- Add held-out episode-level coverage tests.
- Add tests for absent class, insufficient n, k > n, serialization and predictor use.
- Report envelope-width consequences.

## Step 3 — Authoritative metrics (F1, F2, F7)
Create/consolidate engine-side `engine/evaluation/` or existing equivalent. It is the single source for API/UI/reports/paper tables.
- No frontend metric re-derivation.
- No silent fallback.
- Missing values render `n/a` with reason.
- Legacy stored derived values labelled `legacy/unverified`.
- Unit tests use hand-calculated fixtures for every metric and edge case.
- Recompute historical metrics only as new versioned outputs; do not rewrite stored historical values.

## Step 4 — Failure attribution
Define one primary attribution per unsuccessful run plus secondary flags:
planner, prediction, controller, simulation infrastructure, timeout, incomplete, collision, deadlock or insufficient progress.
Document precedence and test it. Infrastructure faults must be distinguished from planner/controller failures.

## Step 5 — F3 diagnosis and correction, AFTER F4
Use actual run logs and validation data. Existing exposed frozen results are exploratory only.
Investigate:
- MRM activation/recovery and hysteresis.
- Stopped-vehicle recovery.
- Forward progress and trajectory feasibility.
- Risk threshold conservatism.
- Controller speed-profile tracking.
- Goal predicate, tolerance, coordinate frames and timeout.
- Steering/acceleration/jerk constraints.

Create `docs/P3_FAILURE_ANALYSIS.md` with counts and percentages from logs. Fix the verified cause. Add benign-scenario regression. Re-run validation after all F4/F3 changes. Never use new frozen data for tuning.

## Step 6 — F6 report and data split
- Generate PILOT_REPORT tables from authoritative metrics and versioned artifacts.
- Reconcile summary/table.
- Implement split guard.
- Existing exposed results labelled exploratory.
- Never overwrite old artifacts; use new versioned paths.

## Phase 1 exit
F1, F2, F3, F4, F6, F7 closed with evidence; F5 deferred; tests green or explicitly justified; P3 benign regression passes; calibration actually used; metrics authoritative; reproducible results command works; no silent fallbacks.

## STOP
Update PROGRESS and provide phase report. Do not proceed to Phase 2 without user instruction/approval.
