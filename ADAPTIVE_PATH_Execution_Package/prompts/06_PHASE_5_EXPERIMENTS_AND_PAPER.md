# 06 — PHASE 5: EXPERIMENTS, STATISTICS AND PAPER SUPPORT
Read standing rules, PROGRESS, approved SAP and prior phase evidence.

## Important
Previously exposed frozen-test data is exploratory only. Do not use it as confirmatory evidence.

## Experiments
All experiments must be config-driven, seeded, reproducible and manifest-backed. Generate JSON, figures, LaTeX/Markdown tables and failure reports in new versioned output directories. Never overwrite existing artifacts.

### E1 — Planner comparison
P3 vs B0, B1, B2, P1 and P2 using matched scenario-seed episodes and equivalent initial conditions/disturbances. Primary contrast is P3 versus the validation-selected strongest baseline, as frozen in SAP.

### E2 — Prediction calibration
Report:
- Nominal and achieved pointwise coverage.
- Simultaneous trajectory coverage separately.
- Envelope width for both.
- Class, horizon and scenario breakdown.
- Calibration episode counts.
- Planner/scenario distribution mismatch.
- Distribution-shift conditions.
- Width-versus-coverage trade-off, including possible conservatism from max-over-agents episode aggregation.

### E3 — Event trigger
Intervention timing, trigger frequency, risk-jump triggers, conformal violations, missed/false triggers and replanning delay.

### E4 — MRM
Activation, safe stopping, recovery, recovery time, deadlock, false activation, oscillation and post-recovery risk.

### E5 — Sensitivity
Noise, latency, density, sensor dropout, occlusion, delayed observations, road clearance and agent behaviour.

### E6 — Generalization
Unseen scenario configurations. No tuning on these outcomes.

## Statistical analysis
Follow approved SAP exactly:
- Primary safe-progress rate.
- One preselected baseline contrast.
- Exact McNemar for paired binary outcome.
- Paired risk difference and paired-bootstrap CI.
- Wilcoxon signed-rank and Cliff's delta for continuous secondaries, or SAP-approved alternatives.
- Resample matched episodes, preserve pairing, stratify/cluster by scenario family where specified.
- Holm correction over pre-registered secondary family.
- If primary fails, secondaries exploratory.
- Report CI widths, denominators, failures and incomplete runs.

No post-hoc exclusions or endpoint switching.

## Frozen reset and G3
Before the single new frozen run:
1. F4 integrated.
2. Final F3 correction and validation completed.
3. SAP approved.
4. Strongest baseline selected on validation data.
5. New frozen seed list disjoint from tuning/calibration/validation/old exposed frozen seeds.
6. Disjointness verified.
7. SAP and seed hashes committed.
8. Git tag created.
9. Clean tree verified.
10. User explicitly approves G3.

STOP and wait at G3. Do not run frozen evaluation before explicit approval.

After approval, run the single approved evaluation and preserve all output. Do not tune from results.

## Claims gate
Every paper claim must map to:
- Hypothesis/endpoint.
- SAP section.
- Experiment ID.
- Result artifact and manifest.
- Git/config/seed/split hashes.
- Metric-definition version.
- Statistical analysis.
- Relevant tests.

CI must reject paper tables referencing missing manifests. Tag illustrative values `illustrative: true` and exclude from claims.

## Paper support
Generate:
- Methods and experimental protocol summary.
- Planner comparison tables.
- Calibration figures.
- Coverage/width plots.
- Intervention timing plots.
- MRM analysis.
- Sensitivity and generalization results.
- Failure-case examples.
- Confidence intervals and effect sizes.
- Threats to Validity.

Threats include assumed agent/cattle behaviour, simulated sensors, exchangeability, distribution shift, scenario coverage, controller assumptions and sim-to-real gap.

Do not claim road-ready autonomy or real-world validation.

Update PROGRESS and provide complete evidence report.
