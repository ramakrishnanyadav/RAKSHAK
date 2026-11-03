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
| **DEC-007** | 2026-11-03 | Four-Way Disjoint Seed Splits: Tuning (1000–1009), Calibration (1500–1539), Validation (2000–2009), and Confirmatory Frozen (3000–3029). | Dataset Integrity | Second G2 Review |
| **DEC-008** | 2026-11-03 | Deadlock & Livelock Prevention: Introduction of Exploratory Lateral Creep to prevent permanent vehicle halting behind obstacles (resolving Finding F3 root cause). | Planning & Control | Second G2 Review |
| **DEC-009** | 2026-11-03 | Non-Closing TTC Standardization: Diverging ($\dot{r} \le 0$) objects yield $\text{TTC} \equiv \texttt{null}$ with flag $\texttt{is\_closing=False}$; zero arbitrary default values. | Metric Methodology | Second G2 Review |
| **DEC-010** | 2026-11-03 | Discrete SAT Collision Limitation: Explicitly document $10\text{ Hz}$ temporal sampling limits ($\Delta s \le 2.0\text{ m}$ displacement at $20\text{ m/s}$); bounded by vehicle geometry ($4.2\text{ m}$). | Dynamics & Testing | Second G2 Review |
| **DEC-011** | 2026-11-03 | Variable-Timestep Jerk Formulation: Standardized second-order finite difference with causal 3-step moving average filter; exclude initial 2 boundary samples from denominators. | Kinematics & Comfort | Second G2 Review |
| **DEC-012** | 2026-11-03 | Pre-Specified Strongest-Baseline Selection Rule: Selected strictly on the Validation Split prior to unblinding the frozen test set using hierarchical tie-breakers. | Statistical Rigor | Second G2 Review |

---

### Detailed Scientific Decision Records

#### DEC-007: Four-Way Disjoint Seed Allocation
- **Decision**: The random seed space is partitioned into four strictly non-overlapping integer intervals:
  - `tune`: $[1000, 1009]$ ($10$ seeds/scenario)
  - `calib`: $[1500, 1539]$ ($40$ seeds/scenario, ensuring $\ge 40$ independent episodes for split conformal quantiles)
  - `val`: $[2000, 2009]$ ($10$ seeds/scenario, reserved for baseline selection and P3 creep tuning)
  - `frozen`: $[3000, 3029]$ ($30$ seeds/scenario, strictly locked until Gate G3)
- **Rationale**: Completely isolates conformal calibration fitting from hyperparameter tuning and model selection, preventing epistemic data contamination.

#### DEC-008: Deadlock Prevention via Exploratory Lateral Creep
- **Context**: In historical frozen results, P3 had a 0.0% goal completion rate because any high obstacle risk caused candidate speeds $v = 0$ to minimize cost, resulting in permanent livelock.
- **Decision**: Introduce a hysteresis recovery state and an "Exploratory Lateral Creep" behavior when stationary time $t_{\text{stationary}} \ge 2.0\text{ s}$ behind a blocked lane. P3 evaluates shoulder bypass trajectories at $1.5\text{ m/s}$ with boosted progress rewards, safely bypassing halted obstacles rather than stopping permanently.

#### DEC-011: Variable-Timestep Jerk and Boundary Handling
- **Decision**: Filtered acceleration $a_{k, \text{filt}}$ is differentiated over interval $\frac{1}{2}(\Delta t_k + \Delta t_{k-1})$. Steps $k \in \{0, 1\}$ are excluded from summation; the denominator for mean and RMS jerk is $K - 2$. Incomplete runs with $K < 3$ report `null` with `INSUFFICIENT_SAMPLES`.
- **ISO 2631 Clarification**: Jerk is reported purely as a kinematic motion comfort proxy, with unsupported claims of ISO 2631 whole-body vibration certification explicitly disclaimed.
