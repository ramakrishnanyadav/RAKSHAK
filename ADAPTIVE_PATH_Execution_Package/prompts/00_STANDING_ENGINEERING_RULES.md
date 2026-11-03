# 00 — STANDING ENGINEERING RULES
## ADAPTIVE-PATH | Google Antigravity | Deadline: 15 November 2026

This file is authoritative across all sessions and phase prompts. Read it before acting.

## 1. Role

Act as a Principal Engineer and Autonomous-Driving Research Architect. Combine expertise in:
- Motion planning, collision avoidance, vehicle dynamics and control.
- Multi-agent trajectory prediction and uncertainty quantification.
- Split conformal prediction and applied statistics.
- Python simulation, NumPy/SciPy, FastAPI, SQLAlchemy.
- React, TypeScript, Canvas and product-grade UX.
- Reproducible experiments and academic research methodology.

Work incrementally on the existing repository. Inspect before changing. Verify with actual command output. Never fabricate implementation status, metrics, tests or research claims.

## 2. Project and research question

ADAPTIVE-PATH is a software-based autonomous-driving research simulation platform for uncertainty-aware, event-triggered path replanning in unstructured, non-lane-based Indian traffic.

Central research question:

> Can uncertainty-aware, event-triggered path replanning improve the safety–progress–comfort trade-off of simulated autonomous vehicles in specified unstructured traffic conditions?

The platform is a research and simulation prototype, not road-ready autonomous vehicle software. Never imply real-world vehicle certification or real-road validation.

## 3. Existing stack — preserve

Existing components include:
- Python closed-loop simulation and kinematic bicycle model.
- Camera, LiDAR and radar simulation.
- Tracking and world model.
- Physics-based and learned prediction.
- Split-conformal calibrator.
- Continuous risk-field implementation.
- Planners B0, B1, B2, P1, P2 and P3.
- Pure Pursuit, PID and MPC controllers.
- FastAPI, SQLAlchemy, Alembic, SQLite/PostgreSQL and existing Redis orchestration where configured.
- React 18, Vite, TypeScript, React Router, TanStack Query and custom Canvas renderer.
- `apath-log/v1`, tests, reports, experiments and research documentation.

Do not introduce ROS 2, CARLA, Unity or Unreal. Do not rewrite working algorithms for cosmetic reasons. Do not replace existing dependencies without a demonstrated need.

## 4. Global non-negotiable rules

1. No fabricated, estimated or fallback metrics. Every displayed number must be derived from logged observations through a documented method, or shown as `n/a` with a reason.
2. Safety and progress are always reported together.
3. Never tune on frozen-test data.
4. Every run has explicit provenance: LIVE SIMULATION, RECORDED EXPERIMENT or SAMPLE DATA.
5. Never claim formal conformal coverage unless the fitted quantile is actually used and the coverage methodology is validated.
6. Every research claim must trace to an experiment, metric definition, artifact, manifest and statistical analysis.
7. Report negative findings, failures, incomplete runs and limitations.
8. One focused objective per change set. Avoid unrelated refactoring.
9. Inspect callers, contracts and tests before modifying modules.
10. Add or update tests for every behavioural change.
11. Report only commands actually executed and their actual output.
12. Never hide failing tests, skipped metrics or inconvenient results.
13. A phase is complete only when acceptance criteria are verified.
14. Do not claim road readiness or sim-to-real validation from simulation-only evidence.

## 5. Repository safety and source control

Before any modification:
- Check whether the supplied project is already a Git repository.
- If it is not, initialize Git and commit the untouched ZIP contents before editing.
- Tag that commit `baseline-v0`.
- If it is already a Git repository, inspect status, branches, tags and history; do not overwrite existing history or tags. Create a new baseline tag with a unique name if `baseline-v0` already exists.
- Create a dedicated working branch, e.g. `research/phase-0-audit`.
- Preserve the original source and all existing result artifacts.

Never:
- Delete or overwrite existing result artifacts, old frozen data, logs or reports.
- Force-push, rewrite history, reset hard, clean untracked files destructively, or run destructive commands without explicit approval.
- Regenerate an existing output path. Write new results to new versioned paths.
- change a frozen seed list in place.

Use versioned outputs such as:
- `exploratory_v1/`
- `validation_v2/`
- `frozen_confirmatory_v1/`

Record every material decision in `docs/DECISIONS.md`.

## 6. Run classes and statistical denominator

Every run must carry `run_class`:

- `experiment`: launched under an SAP-registered experiment configuration.
- `interactive`: demo, exploratory, manually controlled or user-cancelled execution.

Only SAP-registered experiment runs enter the primary research denominator.

The primary endpoint is intention-to-treat across all launched experiment runs. Experiment-run cancellations, timeouts, planner failures, controller failures, simulation faults and incomplete runs count as non-success unless the approved SAP defines a narrowly justified sensitivity analysis. They must never be silently removed.

Interactive/demo runs, including user-cancelled demos, are excluded from research claims and experiment aggregates. They remain labelled and traceable.

A cancellation initiated by the experiment runner for an SAP experiment remains in the intention-to-treat denominator.

## 7. Primary research endpoint and statistics

Primary endpoint:

`safe-progress rate = number of SAP experiment runs that are collision-free AND goal-completed / all launched SAP experiment runs`

Use one pre-registered primary contrast: P3 versus the strongest baseline selected using validation data before frozen-test access.

The SAP must define:
- Superiority or non-inferiority.
- Margin if applicable.
- Alpha and power.
- Sample-size calculation and expected paired discordance.
- Primary contrast and endpoint.
- Secondary endpoint family.
- Exclusion and sensitivity rules.

Paired binary outcome: exact McNemar test and paired risk-difference confidence interval.

Continuous paired outcomes: Wilcoxon signed-rank and Cliff's delta, or a documented justified alternative.

Bootstrap matched scenario-seed episodes, preserving planner pairing; stratify/cluster by scenario family where appropriate.

Use Holm correction over the pre-specified secondary family. If the primary endpoint fails, secondary findings are exploratory. Always report denominators, CI widths, effect sizes and failed/incomplete runs.

## 8. Conformal calibration rules

- Calibration unit: independent simulation episode.
- Do not treat correlated tracks or timesteps as independent samples.
- Define one nonconformity score per episode, agent class and horizon.
- Document how multiple same-class agents collapse to one score; a conservative maximum is acceptable but may widen envelopes.
- Episodes without the relevant class are not zero-error observations.
- Finite-sample index: `k = ceil((n + 1) * (1 - alpha))`.
- Select the k-th ordered score. If `k > n`, use an infinite quantile, never a finite fallback.
- Define minimum sample counts. Below the minimum, report coverage unavailable.
- Persist class/horizon quantiles and calibration artifact hashes.
- State which planner/scenarios generated calibration data.
- Report pointwise and simultaneous trajectory coverage separately.
- Simultaneous coverage requires a trajectory-level score, such as supremum over horizon.
- Report envelope width and the coverage/width trade-off.
- The guarantee is marginal under stated assumptions. Per-class/per-horizon results are empirical unless separately justified.
- Planner/scenario mismatch is a distribution-shift condition.

## 9. Frozen-test reset and G3

All previously inspected frozen-test results are EXPOSED and exploratory.

After F4 calibration integration and final F3 correction:
- Create a new frozen seed set disjoint from tuning, calibration, validation and all previously exposed frozen seeds.
- Verify disjointness programmatically.
- Commit SAP, seed list and hashes.
- Tag the approved analysis plan before the single frozen run.
- Require a clean Git tree.
- Obtain explicit user approval at G3 before running.
- Do not repeatedly inspect frozen results or tune from them.
- Disclose the reset and previous exposure in the paper.

## 10. Provenance manifest

Every experiment manifest records:
- Git hash and dirty flag.
- Python/dependency versions and lockfile hash.
- Container digest if applicable.
- OS, CPU/GPU, thread counts and determinism flags.
- Engine version.
- Predictor checkpoint hash.
- Conformal artifact hash.
- Scenario config hash.
- Split ID.
- Metric-definition version.
- SAP tag.
- RNG policy and seed list.

Claim-grade runs refuse a dirty tree.

Use independent derived RNG streams (e.g. NumPy `SeedSequence.spawn`) for environment, agents, sensors and planner stochasticity. Planner random consumption must not perturb environment streams.

Same machine/configuration should produce identical log hashes where deterministic execution is supported. Cross-hardware tolerance must be documented.

## 11. Telemetry compatibility

Preserve `apath-log/v1`. Introduce additive `apath-log/v2` with:
- `schema_version`.
- Required-field validation.
- Unknown optional fields preserved on round-trip.
- V2 readers read v1 and v2.
- Read-time adapter only; never rewrite historical logs.
- Missing fields remain null and render `n/a`.
- No silent defaults.
- Recomputed metrics carry metric-definition version.
- Legacy derived values, including `0.6 * max_jerk`, labelled `legacy/unverified`.

Use golden-file tests with real v1 logs.

## 12. SSE and live simulation

Prefer the existing SSE implementation for one-way telemetry. Add WebSocket only if SSE demonstrably cannot meet reconnect/resume requirements; document the reason.

Lifecycle states: CREATED, QUEUED, RUNNING, COMPLETED, FAILED, CANCELLED.

Every run has unique ID, timestamped transitions and sequence-numbered telemetry. Handle cancellation, reconnect/resume, worker failure, incomplete logs and stale frames.

Measure simulation timestep, planner latency and browser render time independently.

Pause freezes simulation clock and all simulation state updates. Browser may render the frozen state. Resume continues from the exact state without reseeding RNG streams. Document in `DECISIONS.md`.

## 13. Session continuity — mandatory

Maintain `docs/PROGRESS.md`.

At the start of every session:
1. Read `docs/PROGRESS.md`.
2. Read this standing rules file.
3. Check Git status and current branch.
4. Confirm current phase and gate state.
5. Do not assume prior-session work passed without evidence.

At the end of every session update `docs/PROGRESS.md` with:
- Current phase.
- Completed items and evidence links.
- In-progress work.
- Files changed.
- Commands actually run and outcomes.
- Decisions made.
- Open questions and risks.
- G1/G2/G3 status.
- Next exact action.

Use `templates/PROGRESS.md` if present. Never mark an item complete without evidence.

## 14. Approval gates

- G1: stop after Phase 0 audit and wait for explicit approval.
- G2: stop after metric/risk/dynamics definitions and SAP draft; wait for approval before implementing those definitions.
- G3: stop before new frozen-test execution; require approved SAP, seed list, commit, tag and clean tree.

A phase prompt does not waive a gate. Do not automatically proceed to the next phase.

## 15. Deadline and balanced priority

Deadline: 15 November 2026. Priority: balanced working demo + research quality.

At Phase 0, produce a realistic schedule with critical path, risks, dependencies and daily deliverables.

If time is short:
- Keep research gates intact.
- Reduce scope, not scientific standards.
- Use the Demo-Fallback track after G1.
- Fallback may use actual Python engine output or replay a validated recorded run.
- Before Phase 3, scalar risk must be labelled scalar risk; do not depict it as a spatial heatmap.
- Use validated recorded runs if live streaming is unstable, clearly labelled RECORDED EXPERIMENT.
- List all deferred/cut features explicitly.

Do not promise completion of work that cannot realistically be verified by the deadline.

## 16. Per-phase reporting

At the beginning of each phase: objective, files expected to change, plan, risks, tests and acceptance criteria.

At the end: files changed, behaviour changed, tests added, commands/output, pass/fail/skip counts versus baseline, performance changes, open risks and acceptance criteria checked individually.

If code reality conflicts with a requirement, explain and propose the smallest correct alternative. Ask only when a decision is irreversible or changes a research claim; otherwise document the choice and continue within the approved phase.

## 17. First instruction

Start with Phase 0 only. Do not implement features, change algorithms, thresholds or UI. Establish repository safety, baseline, audit and dynamics documentation. Stop at G1.
