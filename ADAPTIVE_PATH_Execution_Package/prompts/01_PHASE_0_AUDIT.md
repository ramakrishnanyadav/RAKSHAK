# 01 — PHASE 0: EVIDENCE-BASED REPOSITORY AUDIT
Read `00_STANDING_ENGINEERING_RULES.md` and `docs/PROGRESS.md` first.

## Objective
Understand the actual repository and establish a trustworthy baseline. No behavioural changes or feature implementation.

## Step 0 — Repository safety first
1. Inspect current directory and Git status.
2. If not a Git repository: initialize Git, commit untouched ZIP contents, tag `baseline-v0`.
3. If already a repository: inspect history/tags; preserve everything. Create a unique baseline tag if needed.
4. Create dedicated branch `research/phase-0-audit` or a unique equivalent.
5. Never delete/overwrite artifacts or run destructive commands.
6. Record baseline commit and branch in `docs/PROGRESS.md`.

## Step 1 — Baseline
Run existing backend, frontend and engine test suites. Discover commands from repository configuration; do not guess.
Record actual:
- Commands and output.
- Pass/fail/skip counts per suite.
- Wall-clock duration.
- Existing warnings.
- Example run-log sizes.
- Canvas frame timing if measurable.
If a suite cannot run, record exact blocker; do not mark passed.

## Step 2 — Full architecture inspection
Inspect repository tree, entry points, engine runner, planners, predictors, controllers, logging, API routers, frontend routes/components, experiment configs, reports and tests.

Create `docs/AUDIT.md` with:
- Architecture map: module -> responsibility -> inputs/outputs -> callers.
- Implemented versus documented-only features.
- Engine -> log -> API -> UI data flow.
- Existing run lifecycle and transport.
- Existing schema compatibility.
- Existing metric derivation locations.
- Test coverage and known gaps.
- Technical debt and risks.

## Step 3 — Verify findings F1–F7
For each, mark CONFIRMED / NOT REPRODUCED / PARTIAL and provide file/line evidence:
- F1: ReplayView mean jerk derived as `max_jerk * 0.6`.
- F2: comparison view fallback metrics that look measured.
- F3: old exposed results show P3 0% collision and 0% goal completion; investigate logs but do not tune or treat as confirmatory.
- F4: physics predictor hardcoded uncertainty expansion/coverage label while fitted conformal quantile may not be used.
- F5: scalar risk summary and agent-centred gradient approximation. Audit only; implementation is Phase 3.
- F6: PILOT_REPORT executive summary/table inconsistency.
- F7: scattered metric derivation.

Do not modify these findings in Phase 0.

## Step 4 — Dynamics audit
Create `docs/DYNAMICS.md` documenting actual enforced and unenforced:
- Steering angle/rate.
- Acceleration/braking.
- Velocity.
- Curvature.
- Vehicle dimensions.
- Clearance/collision constraints.
- Controller constraints.

Check whether current P3 planned trajectories can violate constraints. Report available evidence; do not fix.

## Step 5 — Deadline schedule
Create a realistic schedule through 15 November 2026. Identify:
- Critical path.
- Dependencies.
- Demo milestone.
- Research milestone.
- Time-boxes.
- Risks.
- Explicit scope cuts if needed.
- Whether Demo-Fallback should run after G1 in parallel with Phase 1.

## Deliverables
- `docs/AUDIT.md`
- `docs/DYNAMICS.md`
- `docs/PROGRESS.md`
- Baseline test report (document or linked artifact).
- Phase schedule.
- Verified F1–F7 table.

## Acceptance criteria
- Untouched baseline safely committed/tagged.
- Dedicated branch exists.
- No existing result artifact modified.
- Baseline commands and real output recorded.
- Audit contains file/line evidence.
- Findings have explicit statuses.
- Dynamics document reflects actual code.
- Deadline schedule is realistic.

## STOP — G1
Present the audit and evidence. Update `docs/PROGRESS.md`. Stop and wait for explicit user approval. Do not begin Phase 1 or demo implementation automatically.
