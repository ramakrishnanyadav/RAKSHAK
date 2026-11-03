# 07 — PHASE 6: QUALITY GATES AND RELEASE
Read standing rules and PROGRESS. Confirm all prior approved phase criteria.

## Backend
- Run pytest and coverage.
- Type-check touched modules.
- Validate API contracts.
- Validate v1/v2 telemetry compatibility.
- Test lifecycle, cancellation, reconnect and worker failure.
- Confirm no silent metric defaults.

## Frontend
- TypeScript strict checks.
- ESLint.
- Component tests for modes, provenance and decision panel.
- Playwright flagship flow at 1280x720.
- Engine/UI state correspondence test.
- No uncaught exceptions or console.error in scripted demo.

## Engine
- Unit and property-based tests.
- Determinism tests.
- Planner fairness.
- Dynamics/trajectory feasibility.
- Conformal calibration.
- Failure attribution.
- MRM recovery.
- Risk-grid consistency.
- Metric hand-fixture tests.

## Reproducibility and performance
- Same machine/config deterministic log hash where supported.
- Cross-hardware tolerances documented.
- Manifest complete.
- Canvas <16 ms target on documented mid-range laptop, or report measured deviation.
- Measure planner latency and simulation step separately.
- Record first telemetry frame, run duration and log size.
- Compare with Phase 0 baselines.

## Release checklist
- All known findings mapped to fixes/evidence.
- Old artifacts preserved.
- New artifacts versioned.
- No dirty-tree claim-grade results.
- Research claims traceable.
- Limitations disclosed.
- Demo provenance truthful.
- Deferred scope documented.
- `docs/PROGRESS.md` current.

## Final deliverables
Provide:
1. Final architecture summary.
2. F1–F7 closure matrix.
3. Tests and actual commands/output.
4. Demo acceptance results.
5. Research results and limitations.
6. Artifact and manifest locations.
7. Remaining known issues.
8. Reproduction instructions.
9. Paper-ready figures/tables.
10. Release recommendation: READY / READY WITH LIMITATIONS / NOT READY.

Do not conceal failed gates. A release may be READY WITH LIMITATIONS if limitations are explicit and do not invalidate the claims made.
