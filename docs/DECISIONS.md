# ADAPTIVE-PATH — Architecture & Research Decisions Record (ADR/Decisions)

> This document tracks all authoritative engineering, research governance, and methodology decisions across the ADAPTIVE-PATH platform.

---

## Decision Index

| ID | Date | Decision | Scope | Approved By / Gate |
| :--- | :--- | :--- | :--- | :--- |
| **DEC-001** | 2026-11-03 | Repository safety baseline committed as `baseline-v0` on branch `research/phase-0-audit`. | Source Control | Gate G1 Pre-condition |
| **DEC-002** | 2026-11-03 | Confirmation of Findings F1–F7 without in-place modification in Phase 0. | Research Governance | Phase 0 Directive |
| **DEC-003** | 2026-11-03 | Formal G1 Approval received; authorization of Workstream A (Phase 1) and Workstream B (Demo Fallback). | Governance / Release | User G1 Approval |
| **DEC-004** | 2026-11-03 | Critical Ordering Rule: F4 Conformal Calibration Integration MUST precede final F3 tuning and validation. | Research Methodology | Standing Rules / Phase 1 |
| **DEC-005** | 2026-11-03 | Separation of Run Classes: `run_class=experiment` (strictly entering ITT denominator) and `run_class=interactive` (demos/manual, excluded from research claims). | Experimental Design | Phase 1 / SAP |
| **DEC-006** | 2026-11-03 | Parallel Demo Fallback Track Governance: UI demo runs in parallel with Phase 1 under strict branch coordination; cannot use unapproved metric definitions or fabricated numbers. | Demo Architecture | Workstream B Directive |
| **DEC-007** | 2026-11-03 | Five-Way Disjoint Seed Allocation: Tuning (1000–1009), Calibration (1500–1539), Validation-A (2000–2004), Validation-B (2005–2009), Confirmatory Frozen (3000–3029). | Dataset Integrity | Final G2 Review |
| **DEC-008** | 2026-11-03 | Exploratory Lateral Creep Designated as Unvalidated Candidate Correction: Candidate solution to F3 deadlock; cannot override hard collision or shoulder boundary constraints. | Planning & Control | Final G2 Review |
| **DEC-009** | 2026-11-03 | Non-Closing & Missing TTC: Diverging ($\mathbf{r} \cdot \mathbf{v}_{\text{rel}} \le 0$) or non-intersecting trajectories yield $\text{TTC} \equiv \texttt{null}$; zero arbitrary numerical default constants. | Metric Methodology | Final G2 Review |
| **DEC-010** | 2026-11-03 | Discrete SAT Collision Limitation & Projected Geometry: $10\text{ Hz}$ sampling bounds documented ($\Delta s \le 2.40\text{ m}$ displacement at $24.0\text{ m/s}$); continuous swept-volume identified as future enhancement. | Dynamics & Testing | Final G2 Review |
| **DEC-011** | 2026-11-03 | Variable-Timestep Jerk Formulation: Standardized second-order finite difference with causal 3-step moving average filter; exclude initial 2 boundary samples from denominators. | Kinematics & Comfort | Final G2 Review |
| **DEC-012** | 2026-11-03 | Strongest-Baseline Selection Isolated to `val_a`: Evaluated on Seeds 2000–2004, completely decoupled from P3 algorithm tuning in `val_b` (Seeds 2005–2009). | Statistical Rigor | Final G2 Review |
| **DEC-013** | 2026-11-03 | 2D Anisotropic Conformal Uncertainty Covariance Inflation: Spatial dispersion inflated along both body axes ($\beta_{\text{long}} = 0.50, \beta_{\text{lat}} = 0.35$) using calibrated empirical error quantiles. | Risk & Prediction | Final G2 Review |
| **DEC-014** | 2026-11-03 | Multi-Agent Independent Union Aggregation: Multi-agent dynamic potentials aggregated via $1 - \prod (1 - R_j)$ after individual saturation clipping $\min(1.0, \dots)$. | Risk Mathematics | Final G2 Review |
| **DEC-015** | 2026-11-03 | Full Vehicle Footprint Lateral Shoulder Limits: $W_{\text{veh}} = 1.80\text{ m}$ footprint constrains vehicle center to $|y_{\text{ego}}| \le 3.80\text{ m}$ ($4.70 - 0.90\text{ m}$); values $> 3.80\text{ m}$ represent hard barrier violations. | Road Geometry | Final G2 Review |
| **DEC-016** | 2026-11-03 | Bootstrap Sample Expansion: Increase final confirmatory bootstrap resamples from 1,000 to 10,000 with BCa and percentile intervals to ensure stable 95% tails. | Statistical Rigor | Final G2 Review |

---

### Detailed Scientific Decision Records

#### DEC-007 & DEC-012: Separation of Validation Sub-Splits
- **Decision**: The validation seed space $[2000, 2009]$ is partitioned into two independent sub-splits:
  - `val_a` (Seeds 2000–2004, $25$ episodes): Dedicated strictly to benchmarking baselines B0, B1, B2 and identifying the single strongest comparator $B^*$.
  - `val_b` (Seeds 2005–2009, $25$ episodes): Dedicated strictly to tuning P3 parameters (progress rewards, stationary penalties, lateral crawl speeds).
- **Rationale**: Completely prevents tuning P3 on the same episodes used to select the comparator baseline, guaranteeing strict methodological separation prior to frozen evaluation.

#### DEC-013: Two-Dimensional Anisotropic Conformal Covariance Inflation
- **Decision**: The 2D Gaussian spatial covariance matrix $\mathbf{\Sigma}_j(t)$ in the obstacle body frame is inflated additively along both axes by the calibrated split-conformal quantile $r_{\text{conf}}(c, t)$:
  $$\sigma_{\text{long}}^2(t) = (\sigma_{\text{long}} + 0.50 \cdot r_{\text{conf}})^2, \quad \sigma_{\text{lat}}^2(t) = (\sigma_{\text{lat}} + 0.35 \cdot r_{\text{conf}})^2$$
- **Rationale**: Respects the physical anisotropy of non-holonomic vehicle tracking errors on unstructured roads while providing a mathematically sound 2D uncertainty envelope.

#### DEC-014: Multi-Agent Risk Aggregation via Independent Union
- **Decision**: Individual agent potentials $R_j(x, y, t)$ are individually saturated to $[0.0, 1.0]$ and aggregated using the probabilistic independent union:
  $$R_{\text{dynamic, total}} = 1.0 - \prod_{j=1}^M \Big(1.0 - R_j(x, y, t)\Big)$$
- **Rationale**: Monotonic, mathematically bounded in $[0.0, 1.0]$, and prevents artificial risk explosion when multiple vehicles or pedestrians cluster in dense traffic.

#### DEC-015: Full Vehicle Footprint Lateral Clearance
- **Decision**: Vehicle lateral feasibility must account for the full rectangular width ($W_{\text{veh}} = 1.80\text{ m}$). Center coordinates $|y_{\text{ego}}| > 3.80\text{ m}$ result in the outer tire encroaching into the roadside ditch ($Y_{\text{ditch}} = 4.70\text{ m}$) and are enforced as hard infinite cost barriers.
