# Statistical Analysis Plan (SAP) — ADAPTIVE-PATH

> **Protocol ID**: SAP-SIH26037-v1.0  
> **Status**: DRAFT (Submitted for Gate G2 Approval)  
> **Prepared Date**: 2026-11-03  
> **Approval Date**: Pending Gate G2 Review  
> **Git Commit / Branch**: `research/phase-0-audit` (Targeting `baseline-v0` parent)  
> **Platform**: ADAPTIVE-PATH Research Simulation Platform  
> **Authoritative Pre-Registration**: Strictly defines statistical contrasts, hypotheses, endpoints, sample sizes, and calibration procedures prior to final evaluation runs.

---

## 1. Research Question

Can uncertainty-aware, event-triggered path replanning (Planner **P3: Risk-Adaptive + MRM**) achieve a superior or non-inferior **safe-progress rate** while significantly improving ride comfort (lower RMS jerk) and maintaining real-time computational feasibility compared to the strongest classical baseline planner on unstructured, non-lane-based simulated Indian roadways?

---

## 2. Experimental Population and Run Classes

### 2.1 Experiment Configuration IDs
Evaluation runs across the 5 canonical Indian traffic scenario families:
1. `SCENARIO_1_VILLAGE_ROAD` (Narrow asphalt, oncoming truck, unpaved shoulder bypass)
2. `SCENARIO_2_URBAN_INTERSECTION` (Uncontrolled crossroads, auto-rickshaws, swarming two-wheelers)
3. `SCENARIO_3_HIGHWAY_MERGE` (High-speed corridor, slow agricultural tractors merging)
4. `SCENARIO_4_DENSE_MARKET` (Vendor stalls, occluded pedestrian cut-ins)
5. `SCENARIO_5_CATTLE_CROSSING` (Livestock entering active lane and halting)

### 2.2 Run Class Separation
Every simulation execution produces an `apath-log/v1` document bearing an explicit `run_class`:
- `run_class = "experiment"`: Pre-registered simulation execution launched under this SAP protocol. **All launched experiment runs strictly enter the primary Intention-To-Treat (ITT) denominator.**
- `run_class = "interactive"`: Ad-hoc manual executions, exploratory Studio replays, UI fast-track demos, or user-aborted trial runs. **Strictly excluded from research denominators and statistical claims.**

### 2.3 Intention-To-Treat (ITT) Principle
Any SAP experiment run that encounters a simulation timeout ($T > 20.0\text{ s}$), vehicle livelock, out-of-bounds trajectory, controller numerical exception, or runner crash is treated as an **unsuccessful outcome** ($\text{SafeProgress} = 0$). No post-hoc data removal or cherry-picking is permitted.

---

## 3. Primary Endpoint

### Safe-Progress Rate ($Y_{\text{SP}}$)
A binary composite endpoint defined per simulation episode $i$:
$$Y_{\text{SP}, i} = \begin{cases} 
1 & \text{if } \text{CollisionFree}_i = \text{True} \land \text{GoalCompleted}_i = \text{True} \\
0 & \text{otherwise}
\end{cases}$$

- **CollisionFree**: Zero SAT polygon intersections between ego vehicle and any obstacle throughout $t \in [0, T_{\text{end}}]$.
- **GoalCompleted**: Longitudinal progress $x(t_{\text{end}}) \ge 65.00\text{ m}$ within road lateral limits $|y| \le 4.70\text{ m}$ before timeout $T_{\max} = 20.0\text{ s}$ with terminal speed $v \ge 0.50\text{ m/s}$.
- **Denominator**: Total number of launched experiment episodes $N_{\text{launched}}$.

---

## 4. Primary Contrast & Baseline Selection Rule

### Baseline Selection Rule
- The comparator baseline planner is selected from the classical baseline candidates (**B0**: Shortest Path, **B1**: DWA + Velocity Obstacles, **B2**: Kinematic Hybrid $A^*$).
- **Selection Criterion**: The baseline achieving the highest Safe-Progress Rate across the **Validation Split** (Seeds 2000–2009) is designated as the Primary Comparator ($B^*$).
- **Primary Comparison**: P3 vs. $B^*$ evaluated on the independent frozen confirmatory split.

---

## 5. Statistical Hypotheses

### Primary Hypothesis (Safe-Progress Rate)
We test the superiority of P3 over $B^*$ on the paired safe-progress outcome:
- **Null Hypothesis ($H_0$)**: $P(Y_{\text{P3}} = 1 \land Y_{B^*} = 0) \le P(Y_{\text{P3}} = 0 \land Y_{B^*} = 1)$  
  *(P3 has equal or lower safe-progress probability than baseline $B^*$)*
- **Alternative Hypothesis ($H_1$)**: $P(Y_{\text{P3}} = 1 \land Y_{B^*} = 0) > P(Y_{\text{P3}} = 0 \land Y_{B^*} = 1)$  
  *(P3 achieves a strictly higher safe-progress probability than baseline $B^*$)*
- **Significance Level ($\alpha$)**: Two-sided $\alpha = 0.05$ (or one-sided upper $\alpha = 0.025$).
- **Statistical Power ($1 - \beta$)**: Targeted $\ge 80\%$.

---

## 6. Sample Size & Power Calculation

- **Design**: Paired-sample test across matched scenario-seed episodes $(s_k, \omega_i)$.
- **Discordance Assumptions**:
  - Estimated baseline success $P(Y_{B^*}=1) \approx 0.50$.
  - Estimated P3 success $P(Y_{\text{P3}}=1) \approx 0.75$.
  - Expected discordant pairs: $n_{10} = P(\text{P3}=1, B^*=0) \approx 0.30$, $n_{01} = P(\text{P3}=0, B^*=1) \approx 0.05$.
- **Sample Size Requirement**:
  - Exact McNemar power analysis indicates a minimum of $N = 75$ matched pairs to detect an odds ratio $\psi \ge 4.0$ with $80\%$ power at $\alpha = 0.05$.
  - **Selected Allocation**: $N = 150$ total matched confirmatory episodes:
    - 5 scenario families $\times$ **30 independent frozen seeds** per scenario (Seeds 3000–3029).
    - Exceeds minimum power threshold ($> 95\%$ power).

---

## 7. Primary Statistical Analysis

1. **Exact McNemar's Test**: Evaluates the contingency table of paired discordant outcomes $(n_{10}, n_{01})$:
   $$p = 2 \sum_{k=n_{10}}^n \binom{n}{k} 0.5^n \quad \text{where } n = n_{10} + n_{01}$$
2. **Paired Risk Difference**:
   $$\widehat{\Delta}_{\text{SP}} = \hat{p}_{\text{P3}} - \hat{p}_{B^*}$$
3. **95% Confidence Interval**:
   - Estimated via **1,000 paired percentile bootstrap resamples**, resampling matched episodes with replacement at the episode level.

---

## 8. Secondary Endpoints & Multiplicity Control

### Secondary Endpoints Family

| Secondary Endpoint | Metric Definition | Statistical Test | Effect Size Metric |
| :--- | :--- | :--- | :--- |
| **Minimum Clearance ($d_{\min}$)** | Continuous distance (m) | Paired Wilcoxon Signed-Rank | Cliff's Delta ($\delta$) / Median Diff |
| **Ride Comfort (RMS Jerk)** | Continuous energy ($\text{m/s}^3$) | Paired Wilcoxon Signed-Rank | Median Difference with 95% CI |
| **Progress Efficiency ($\eta_{\text{prog}}$)** | Continuous ratio $[0, 1]$ | Paired Wilcoxon Signed-Rank | Cliff's Delta ($\delta$) |
| **P95 Computational Latency** | Continuous time (ms) | Paired Wilcoxon Signed-Rank | Mean difference (ms) |

### 8.1 Multiple Comparisons (Family-Wise Error Rate Control)
- The four secondary hypotheses are tested using the **Holm-Bonferroni step-down procedure** to maintain family-wise error rate at $\alpha = 0.05$.
- **Gatekeeping Rule**: Secondary endpoints are interpreted as confirmatory *only if* the primary safe-progress hypothesis achieves statistical significance at $\alpha = 0.05$. If primary fails, secondary tests are reported as exploratory.

---

## 9. Split-Conformal Calibration Protocol

1. **Calibration Episode Unit**: Entire independent simulation episode $(s, \omega) \in \mathcal{D}_{\text{calib}}$.
2. **Non-Conformity Score**: Maximum Euclidean spatial prediction error over the prediction horizon $H = 2.80\text{ s}$:
   $$s_i = \max_{t_k \in [0, H]} \|\mathbf{p}_{\text{pred}, i}(t_k) - \mathbf{p}_{\text{true}, i}(t_k)\|_2$$
3. **Multi-Agent Aggregation**: Per class $c$, the non-conformity score is evaluated across all observed tracks belonging to class $c$.
4. **Quantile Computation**: For target coverage $1 - \alpha = 0.95$ with $n$ calibration samples:
   $$k = \left\lceil (n + 1)(1 - \alpha) \right\rceil = \lceil 0.95(n + 1) \rceil$$
   $$\hat{q}_{0.95} = s_{(k)}$$
5. **Coverage Guarantee**:
   - Minimum sample size requirement: $n_{\min} = 40$ episodes per class.
   - If $k > n$, coverage cannot be guaranteed; conformal radius defaults to conservative infinite / outer road envelope with an explicit error code.
6. **Artifact Storage**: Calibration tables are serialized with an SHA-256 hash in `storage/calibration/conformal_quantiles_v1.json`.

---

## 10. Data Splits & Seed Governance

To enforce strict anti-overfitting protection, seed allocations are pre-registered and permanently segregated:

```
Total Seed Space (Unstructured Scenarios)
┌───────────────────────┬───────────────────────┬───────────────────────────────────────┐
│     Tuning Split      │   Validation Split    │      Confirmatory Frozen Split        │
│    Seeds 1000–1009    │    Seeds 2000–2009    │            Seeds 3000–3029            │
│  (10 seeds / scenario)│  (10 seeds / scenario)│        (30 seeds / scenario)          │
│   Hypothesis & Tuning │ Model Selection & SAP │   Zero Tuning / Final Evaluation      │
└───────────────────────┴───────────────────────┴───────────────────────────────────────┘
```

- **Old Exposed Frozen Results**: Results previously generated in `frozen_test_results.json` are permanently marked as **Exploratory Pilot Data** due to the F3 livelock finding.
- **Disjointness Proof**: $\text{Seeds}_{\text{tune}} \cap \text{Seeds}_{\text{val}} \cap \text{Seeds}_{\text{conf}} = \emptyset$.
- **G3 Gate Rule**: Under no circumstances will any code execution access or evaluate seeds 3000–3029 prior to formal Gate G3 approval.
