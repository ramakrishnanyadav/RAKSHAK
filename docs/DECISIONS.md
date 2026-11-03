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
| **DEC-015** | 2026-11-03 | Full Vehicle Footprint Lateral Shoulder Limits: Rectangular footprint ($4.2\text{ m} \times 1.8\text{ m}$) under yaw $\psi$ constrains vehicle center to $|y| + W_{\text{eff}}(\psi) \le 4.70\text{ m}$. | Road Geometry | Final G2 Review |
| **DEC-016** | 2026-11-03 | Bootstrap Sample Expansion: Increase final confirmatory bootstrap resamples from 1,000 to 10,000 with BCa and percentile intervals to ensure stable 95% tails. | Statistical Rigor | Final G2 Review |
| **DEC-017** | 2026-11-03 | Exact 2D Constant-Relative-Velocity Quadratic TTC with CPA and Comprehensive Boundary Case Handling ($C \le 0 \implies 0$, $A=0 \implies \texttt{null}$, $\mathcal{D} < 0 \implies \texttt{null}$). | Metric Precision | Final G2 Patch |
| **DEC-018** | 2026-11-03 | Oriented Rectangular Vehicle-Footprint Invariant throughout Turning and Lateral Creep ($W_{\text{eff}}(\psi) = \frac{L}{2}|\sin\psi| + \frac{W}{2}|\cos\psi|$ enforced at every step). | Dynamics & Safety | Final G2 Patch |
| **DEC-019** | 2026-11-03 | Statistical Independence Qualification for Multi-Agent Union Aggregation: Formally qualified as a monotonic, bounded upper-bound approximation under positive cluster correlation. | Probability Theory | Final G2 Patch |
| **DEC-020** | 2026-11-03 | Exact McNemar Power Verification ($95.40\%$) and Preservation of $N=150$: Re-evaluated asymptotic ($95.93\%$, $92.58\%$ cc) vs exact power; established discordance sensitivity table. | Statistical Power | Final G2 Patch |

---

### Detailed Scientific Decision Records

#### DEC-017: Exact 2D Quadratic TTC Formulation
- **Decision**: Time-to-Collision is computed via the exact quadratic intersection of relative position evolution $\mathbf{r}(\tau) = \mathbf{r}(0) - \mathbf{v}_{\text{rel}} \tau$ with effective bounding circle $R_{\text{eff}} = R_{\text{ego}} + R_{\text{obs}}$.
- **Edge Cases**:
  - Initial overlap $C \le 0 \implies \text{TTC} = 0.000\text{ s}$.
  - Zero relative velocity $A = 0 \implies \text{TTC} = \texttt{null}$.
  - Diverging $\mathbf{r} \cdot \mathbf{v}_{\text{rel}} \le 0 \implies \text{TTC} = \texttt{null}$.
  - Miss $\mathcal{D} < 0 \implies \text{TTC} = \texttt{null}$.
  - Valid intersection $\implies \tau = \frac{(\mathbf{r}\cdot\mathbf{v}_{\text{rel}}) - \sqrt{\mathcal{D}}}{\|\mathbf{v}_{\text{rel}}\|^2}$.

#### DEC-018: Oriented Rectangular Vehicle Footprint Feasibility
- **Decision**: Road shoulder feasibility is evaluated using the full oriented rectangle:
  $$|y| + \left(\frac{L_{\text{veh}}}{2}|\sin\psi| + \frac{W_{\text{veh}}}{2}|\cos\psi|\right) \le 4.70\text{ m}$$
- **Rationale**: When turning at yaw angle $\psi = 20^\circ$, the effective half-width expands from $0.90\text{ m}$ to $1.564\text{ m}$. Centerline coordinate limits tighten from $3.80\text{ m}$ to $3.136\text{ m}$. Applying this invariant prevents corner clipping into roadside ditches during evasive swerves.

#### DEC-020: Exact McNemar Power Verification for $N = 150$
- **Verification**: Exact power calculation by binomial enumeration confirmed that $N = 150$ achieves **$95.40\%$ exact power** for target effect ($p_{10} = 0.25, p_{01} = 0.08, \Delta = 0.17$). Asymptotic power is $95.93\%$ without continuity correction and $92.58\%$ with continuity correction.
- **Sensitivity Invariant**: If empirical validation reveals $\psi < 2.2$ or $\Delta < 0.12$, power drops below $75\%$, requiring sample expansion before unblinding the frozen split at Gate G3.
