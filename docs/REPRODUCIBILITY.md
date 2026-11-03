# ADAPTIVE-PATH — Scientific Reproducibility Guide

> **Standard**: ACM / IEEE Level 1 Artifact Reproducibility & Open Science Benchmark  
> **Target System**: ADAPTIVE-PATH (Problem SIH26037 • MathWorks / Smart India Hackathon 2026)  
> **Framing**: Simulation and research platform only — strictly not road-ready software; never claim real-world safety.

---

## ⚡ 1. One-Command Full Scientific Regeneration

To regenerate every statistical benchmark table, figure, pilot experiment, and simulation replay artifact from scratch in a single deterministic pass:

```bash
python scripts/reproduce_all.py
```

### Execution Manifest & Runtime
- **Total Wall-Clock Time**: $\approx 11.5\text{ seconds}$ on standard consumer hardware (x86_64, 4-core CPU).
- **Network Dependency**: **Zero (100% offline & air-gapped)**.
- **Licence Dependency**: **Zero** (executes via deterministic reference engine with fixed mathematical models).

---

## 🔬 2. What Gets Regenerated Step-by-Step

When you execute `python scripts/reproduce_all.py`, the pipeline completes 5 sequential verification stages:

### Stage 1: Parameter Freeze Cryptographic Check
- Confirms that cost function weights, kinematic acceleration/steering bounds, and prediction horizons have not drifted from the pre-registered state:
  $$\text{SHA256}(\text{cost\_weights.json}) = \text{b516b378dda8ba077b632c4e450349a11b524ccfb249025c6569bbac74df2b85}$$
- Documented in [`docs/PARAMETER_FREEZE_CHECKLIST.md`](file:///c:/Users/Ramakrishna/Downloads/MINI/docs/PARAMETER_FREEZE_CHECKLIST.md).

### Stage 2: Pilot Experiment & 95% Bootstrap Confidence Intervals
- Simulates `SCENARIO_5_CATTLE_CROSSING` across all 10 `tune` seeds (seeds 1000 through 1009) for planners `B1`, `P1`, `P2`, and `P3`.
- Computes $B=1,000$ bootstrap resamples to construct non-parametric 95% confidence intervals for:
  - Collision Rate (%)
  - Minimum Separation Clearance ($m$)
  - Mean Acceleration Jerk ($m/s^3$)
  - P95 Computation Latency ($ms$)
  - Replan Event Counts
- Performs timestamp timing analysis for Seed 1000 confirming the exact replan moment ($t = 0.50\text{ s}$ for P3 vs $t = 2.40\text{ s}$ for B1 reactive intervention).
- Rewrites [`docs/PILOT_REPORT.md`](file:///c:/Users/Ramakrishna/Downloads/MINI/docs/PILOT_REPORT.md).

### Stage 3: Curated Benchmark Run Artifacts
- Regenerates all 14 multi-scenario benchmark logs in strict `apath-log/v1` JSON format.
- Populates both active object storage (`storage/runs/`) and the Studio offline client bundle (`studio/public/sample_runs/`).
- Registers runs in SQLite/PostgreSQL database records.

### Stage 4: Formal Research Validation Tables & Figures Verification
- Validates the complete empirical results in [`docs/RESEARCH_VALIDATION_REPORT.md`](file:///c:/Users/Ramakrishna/Downloads/MINI/docs/RESEARCH_VALIDATION_REPORT.md):
  - **Table 1**: Comprehensive Frozen-Test Benchmark Table ($N=150$ runs/planner, 900 total simulations).
  - **Table 2**: Pre-Registered Hypotheses H1–H4 statistical outcomes (McNemar paired exact tests, Wilcoxon signed-rank tests, Benjamini-Hochberg False Discovery Rate corrections).
  - **Table 3**: Root-Cause Failure Attribution Taxonomy (Perception, Prediction, Risk Field, Planning/Control).
  - **Table 4**: Sensitivity Stress Testing & Operational Breakdown Boundaries.
  - **Figure 1**: Ablation Performance & Clearance Progression ASCII chart.
  - **Figure 2**: Four-Tier AV Failure Taxonomy Breakdown Matrix ASCII diagram.

### Stage 5: Golden Backup Archive Checksum Verification
- Computes the SHA-256 digest of [`backups/apath_backup_latest.tar.gz`](file:///c:/Users/Ramakrishna/Downloads/MINI/backups/apath_backup_latest.tar.gz) and verifies full uncorrupted disaster recovery readiness.

---

## 📊 3. Granular Component Commands

If you wish to run individual benchmarks or verification suites separately:

| Component | Command | Output Artifact |
| :--- | :--- | :--- |
| **Unit & Contract Tests** | `python -m pytest tests/ backend/tests/ -v` | Test report (100% pass) |
| **Pilot Experiment Only** | `python scripts/run_pilot.py` | [`docs/PILOT_REPORT.md`](file:///c:/Users/Ramakrishna/Downloads/MINI/docs/PILOT_REPORT.md) |
| **Curated Sample Runs** | `python scripts/generate_sample_runs.py` | `studio/public/sample_runs/*.json` |
| **Backup & Restore Test** | `python -m pytest backend/tests/test_backup_restore.py -v` | Verification of DB & telemetry restore |
| **Engine Adapter Smoke** | `python scripts/smoke_engine_adapters.py` | Validation of Python, MATLAB, Replay adapters |
| **OpenAPI Schema Export**| `python export_openapi.py` | `schemas/openapi.json` & `schemas/openapi.yaml` |

---

## 🔒 4. Determinism & Floating-Point Guarantees

1. **Fixed PRNG Seeding**: All scenario stochasticity (pedestrian emergence time, initial agent positions, road pothole locations) is seeded via standard pseudo-random number generators with explicit integer seeds.
2. **Deterministic Integration**: Numerical kinematic propagation uses a fixed step $dt = 0.1\text{ s}$ Forward-Euler / Runge-Kutta integrator with no variable time-step interpolation.
3. **No Network Latency Noise**: All benchmark evaluations execute purely in-memory / local disk without external network calls.
