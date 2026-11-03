# Statistical Analysis Plan (SAP) — ADAPTIVE-PATH

> **Protocol ID**: SAP-SIH26037-v2.1 (Final G2 Scientific Revisions)  
> **Status**: Proposed / Under Final G2 Review  
> **Prepared Date**: 2026-11-03  
> **Approval Date**: Pending Final Gate G2 Review  
> **Git Commit / Branch**: `research/phase-0-audit`  
> **Authoritative Pre-Registration**: Strictly defines statistical contrasts, hypotheses, endpoints, sample sizes, power calculations, and calibration protocols prior to final confirmatory execution.

---

## 1. Research Question

Can uncertainty-aware, event-triggered path replanning (Planner **P3: Risk-Adaptive + MRM**) achieve a statistically superior **safe-progress rate** while maintaining kinematic comfort (RMS jerk) and real-time computation ($\tau_{P95} \le 50\text{ ms}$) compared to the strongest classical baseline planner ($B^*$) across unstructured, non-lane-based simulated Indian roadways?

---

## 2. Experimental Population, Run Classes & ITT Principle

### 2.1 The 5 Canonical Scenario Families
1. `SCENARIO_1_VILLAGE_ROAD`: Narrow single-lane road, unpaved shoulders, oncoming truck forcing shoulder bypass.
2. `SCENARIO_2_URBAN_INTERSECTION`: Uncontrolled four-way crossroads, cross-cutting three-wheelers, swarming two-wheelers.
3. `SCENARIO_3_HIGHWAY_MERGE`: High-speed corridor, slow agricultural tractors merging from acute unpaved ramps.
4. `SCENARIO_4_DENSE_MARKET`: Roadside vendor fruit stalls, occluded pedestrian cut-ins.
5. `SCENARIO_5_CATTLE_CROSSING`: High-mass livestock entering active lane and halting mid-path.

### 2.2 Run Class Separation & Governance
- `run_class = "experiment"`: Executed strictly under the pre-registered protocol. **All launched experiment runs enter the primary Intention-To-Treat (ITT) denominator without exception.**
- `run_class = "interactive"`: Ad-hoc manual exploratory runs, demo views, and UI replays. **Strictly excluded from research claims.**

### 2.3 Handling of Incomplete Runs & Missing Data
Under ITT, every launched experiment run is classified:
- An episode that terminates due to timeout ($T > 20.0\text{ s}$), vehicle livelock/stalling, out-of-bounds trajectory, controller exception, or runner crash is treated as an **unsuccessful outcome** ($Y_{\text{SP}} = 0$).
- There is **no missing data imputation**. Missing continuous metrics on failed runs (e.g., clearance after a crash) are evaluated under pre-specified sensitivity protocols.

---

## 3. Five-Way Disjoint Data Splits & Seed Governance

To enforce complete protection against data snooping, tuning leakage, and overfitting, the random seed space is partitioned into **five mutually disjoint sets**, explicitly separating baseline selection from P3 algorithm tuning:

| Dataset Split | Identifier | Purpose | Seed Range | Seeds / Scenario | Total Episodes | Access Gate |
| :--- | :---: | :--- | :---: | :---: | :---: | :---: |
| **Tuning Split** | `tune` | Initial parameter exploration & algorithm design | $1000\text{--}1009$ | $10$ | $50$ | Free / Phase 0 |
| **Calibration Split** | `calib` | Fitting class-by-horizon split-conformal quantiles | $1500\text{--}1539$ | $40$ | $200$ | After Gate G2 |
| **Validation Sub-Split A** | `val_a` | Strongest-baseline comparator selection ($B^*$) | $2000\text{--}2004$ | $5$ | $25$ | After Gate G2 |
| **Validation Sub-Split B** | `val_b` | P3 lateral creep & livelock progress tuning | $2005\text{--}2009$ | $5$ | $25$ | After Gate G2 |
| **Confirmatory Frozen Split** | `frozen` | Final locked hypothesis testing & paper results | $3000\text{--}3029$ | $30$ | **$150$** (Locked) | **Locked until G3** |

### Mathematical Proof of Mutual Disjointness
$$\mathcal{S}_{\text{tune}} [1000, 1009] \cap \mathcal{S}_{\text{calib}} [1500, 1539] = \emptyset$$
$$\mathcal{S}_{\text{calib}} [1500, 1539] \cap \mathcal{S}_{\text{val\_a}} [2000, 2004] = \emptyset$$
$$\mathcal{S}_{\text{val\_a}} [2000, 2004] \cap \mathcal{S}_{\text{val\_b}} [2005, 2009] = \emptyset$$
$$\mathcal{S}_{\text{val\_b}} [2005, 2009] \cap \mathcal{S}_{\text{frozen}} [3000, 3029] = \emptyset$$

- **Separation of Baseline Selection from Tuning**:
  - Baseline comparator $B^*$ is selected strictly using `val_a` (Seeds 2000–2004).
  - P3 algorithm adjustments (such as exploratory lateral creep) are tuned strictly using `val_b` (Seeds 2005–2009).
  - This nested separation guarantees that P3 tuning cannot overfit against the baseline selection benchmark.
- **Historical Exposed Results**: Results previously generated in `frozen_test_results.json` are permanently marked as **Exploratory Pilot Data** and will never be reported as confirmatory.

---

## 4. Strongest-Baseline Selection Rule

Prior to unblinding the Confirmatory Frozen Split, the single strongest classical baseline planner $B^*$ is selected from candidates (**B0**: Shortest Path, **B1**: DWA + Velocity Obstacles, **B2**: Kinematic Hybrid $A^*$) using performance across **Validation Sub-Split A** (`val_a`, Seeds 2000–2004):

1. **Primary Criterion**: Highest Safe-Progress Rate ($Y_{\text{SP}}$).
2. **Tie-Breaker 1**: Highest minimum obstacle clearance ($d_{\min}$).
3. **Tie-Breaker 2**: Lowest mean RMS jerk ($j_{\text{RMS}}$).
4. **Tie-Breaker 3**: Lowest P95 planning latency ($\tau_{P95}$).

The identity of $B^*$ will be formally committed to `docs/DECISIONS.md` before Gate G3 authorization.

---

## 5. Statistical Hypotheses & Primary Endpoint

### 5.1 Primary Endpoint: Safe-Progress Rate ($Y_{\text{SP}}$)
$$Y_{\text{SP}, i} = \mathbb{I}(\text{CollisionFree}_i = \text{True} \land \text{GoalCompleted}_i = \text{True})$$

### 5.2 Definition of Discordant Proportions ($p_{10}$ and $p_{01}$)
In paired testing across matched scenario-seed episodes $(s_k, \omega_m)$:
- **$p_{10}$**: The population proportion of matched episodes where Planner P3 achieves safe progress ($Y_{\text{P3}} = 1$) AND the baseline comparator $B^*$ fails safe progress ($Y_{B^*} = 0$):
  $$p_{10} = P(Y_{\text{P3}} = 1 \land Y_{B^*} = 0)$$
- **$p_{01}$**: The population proportion of matched episodes where Planner P3 fails safe progress ($Y_{\text{P3}} = 0$) AND the baseline comparator $B^*$ achieves safe progress ($Y_{B^*} = 1$):
  $$p_{01} = P(Y_{\text{P3}} = 0 \land Y_{B^*} = 1)$$

### 5.3 Hypothesis Formulation
- **Null Hypothesis ($H_0$)**: $p_{10} \le p_{01}$  
  *(The probability of P3 succeeding while $B^*$ fails is less than or equal to the probability of $B^*$ succeeding while P3 fails)*
- **Alternative Hypothesis ($H_1$)**: $p_{10} > p_{01}$  
  *(P3 achieves a strictly higher safe-progress probability than baseline $B^*$)*
- **Significance Level**: One-sided $\alpha = 0.025$ (equivalent to two-sided $\alpha = 0.05$).

---

## 6. Sample Size, Power Calculations & Sensitivity Analysis

### 6.1 Exact Test vs. Asymptotic Power Terminology
- **Hypothesis Testing Execution**: The primary hypothesis will be evaluated using the **Exact McNemar Test** (conditional exact binomial test under $B(n_{\text{disc}}, 0.5)$), which does not rely on large-sample approximations.
- **Power & Sample Size Modeling**: Sample size planning is modeled using the **asymptotic normal approximation to McNemar's test** with continuity correction (Miettinen / Lu & Bean method).

### 6.2 Asymptotic Power Formula
Let $N$ be total matched episodes. Expected discordant pairs $n_{\text{disc}} = N(p_{10} + p_{01})$, and risk difference $\Delta_{\text{SP}} = p_{10} - p_{01}$.
$$\text{Power} = \Phi\left( \frac{\sqrt{N}(p_{10} - p_{01}) - z_{1-\alpha/2} \sqrt{p_{10} + p_{01}} - \frac{1}{\sqrt{N}}}{\sqrt{p_{10} + p_{01} - (p_{10} - p_{01})^2}} \right)$$

### 6.3 Reproducible Step-by-Step Power Calculation ($N = 150$)
- **Parameters**: $N = 150$, $\alpha = 0.05$ (two-sided, $z_{0.975} = 1.960$).
- **Assumed Proportions**: $p_{10} = 0.250$ (P3 wins $25\%$ of pairs), $p_{01} = 0.080$ ($B^*$ wins $8\%$ of pairs).
  - Risk difference $\Delta = 0.250 - 0.080 = 0.170$.
  - Total discordance $p_{\text{disc}} = 0.250 + 0.080 = 0.330$. Expected discordant pairs $n_{\text{disc}} = 150 \times 0.330 = 49.5$.
  - Numerator term 1: $\sqrt{150} \times 0.170 = 12.2474 \times 0.170 = 2.0821$.
  - Numerator term 2: $1.960 \times \sqrt{0.330} = 1.960 \times 0.57446 = 1.1259$.
  - Continuity term: $\frac{1}{\sqrt{150}} = 0.0816$.
  - Numerator: $2.0821 - 1.1259 - 0.0816 = 0.8746$.
  - Denominator variance: $\sqrt{0.330 - (0.170)^2} = \sqrt{0.330 - 0.0289} = \sqrt{0.3011} = 0.5487$.
  - Z-score: $Z = \frac{0.8746}{0.5487} = 1.5939$.
  - Normal CDF: $\Phi(1.5939) \approx 0.9445$ (**$94.5\%$ Statistical Power**).

### 6.4 Sensitivity Analysis Table across Effect Sizes ($N = 150$)

| Scenario | $p_{10}$ | $p_{01}$ | Total Discordance ($p_{\text{disc}}$) | Odds Ratio ($\psi$) | Estimated Statistical Power |
| :---: | :---: | :---: | :---: | :---: | :---: |
| **High Effect** | $0.300$ | $0.080$ | $38.0\%$ | $3.75$ | **$> 99.0\%$** |
| **Moderate Effect (Target)** | **$0.250$** | **$0.080$** | **$33.0\%$** | **$3.12$** | **$94.5\%$** |
| **Conservative Effect** | $0.200$ | $0.080$ | $28.0\%$ | $2.50$ | **$81.2\%$** |
| **Low Effect Boundary** | $0.180$ | $0.090$ | $27.0\%$ | $2.00$ | **$62.5\%$** |

- **Sample Size Lock**: The proposed sample size is locked at **$N = 150$ matched episodes** (30 seeds $\times$ 5 scenarios, Seeds 3000–3029).
- **Adequacy Review Invariant**: If empirical discordance on validation data indicates $\psi < 2.0$, Gate G3 review will require explicit sample expansion before frozen execution.

---

## 7. Primary Statistical Analysis Specification

1. **Exact McNemar Test**: Computed from the $2 \times 2$ contingency table of paired outcomes $(n_{10}, n_{01})$:
   $$p\text{-value} = 2 \cdot \sum_{k=n_{10}}^{n_{\text{disc}}} \binom{n_{\text{disc}}}{k} 0.5^{n_{\text{disc}}} \quad \left(\text{for } n_{10} > \frac{n_{\text{disc}}}{2}\right)$$
2. **Paired Risk Difference**:
   $$\widehat{\Delta}_{\text{SP}} = \frac{n_{10} - n_{01}}{N}$$
3. **Confidence Interval (10,000 Bootstrap Replicates)**:
   - Primary: **10,000 paired bootstrap resamples** (resampling matched scenario-seed pairs with replacement at the episode level).
   - Computes both **Percentile** and **Bias-Corrected and Accelerated (BCa)** 95% confidence intervals.
   - Secondary: Exact Wilson score interval for marginal differences.

---

## 8. Secondary Endpoints & Multiple Comparisons

### 8.1 Secondary Hypotheses Family
1. **Minimum Clearance ($d_{\min}$)**: Paired Wilcoxon signed-rank test on continuous distance (meters). Effect size: Cliff's Delta ($\delta$) and median difference.
2. **Kinematic Comfort (RMS Jerk $j_{\text{RMS}}$)**: Paired Wilcoxon signed-rank test on $(\text{m/s}^3)$.
3. **Progress Efficiency ($\eta_{\text{prog}}$)**: Paired Wilcoxon signed-rank test on ratio $[0, 1]$.
4. **Computational Latency ($\tau_{P95}$)**: Paired Wilcoxon signed-rank test on tail latency (ms).

### 8.2 Family-Wise Error Rate (FWER) Control
- Tested using the **Holm-Bonferroni step-down procedure** across the 4 secondary endpoints at family level $\alpha = 0.05$.
- P-values ordered $p_{(1)} \le p_{(2)} \le p_{(3)} \le p_{(4)}$ are compared to $\frac{\alpha}{5 - k}$.
- **Gatekeeping Rule**: Secondary endpoints are confirmatory *only if* the primary safe-progress hypothesis achieves statistical significance at $\alpha = 0.05$. If primary fails, secondary endpoints are reported as strictly exploratory.

---

## 9. Split-Conformal Calibration Standard

### 9.1 Calibration Episode Unit & Independence
- Calibration unit: Independent simulation episode $(s, \omega) \in \mathcal{S}_{\text{calib}}$ (Seeds 1500–1539 across 5 scenarios $= 200$ episodes).

### 9.2 Non-Conformity Score Formulation
For dynamic obstacle $j$ of class $c$ at horizon step $k \in \{1, \dots, 14\}$ ($t_k = k \cdot 0.20\text{ s}$ over horizon $H = 2.80\text{ s}$):
$$s_{i, j}(c, t_k) = \|\mathbf{p}_{\text{true}, i, j}(t_k) - \mathbf{p}_{\text{forecast}, i, j}(t_k)\|_2$$

### 9.3 Class-by-Horizon Sample Size Requirement
- **Requirement**: **$n \ge 40$ independent observed trajectories per class $c$ across prediction horizon step $t_k$**.
- For target coverage $1 - \alpha = 0.95$:
  $$m = \lceil (n + 1)(1 - \alpha) \rceil = \lceil 0.95(n + 1) \rceil$$
  - For $n = 40$: $m = \lceil 0.95 \times 41 \rceil = \lceil 38.95 \rceil = 39$. Calibrated quantile is $\hat{q}_{0.95}(c, t_k) = s_{(39)}$.
- **Behavior when Sample Counts are Insufficient ($n < 40$)**:
  - If any class has $n < 40$ valid calibration trajectories at horizon $t_k$, **mathematical 95% coverage is formally marked as "Coverage Guarantee Unavailable (n < 40)"**.
  - The predictor is prohibited from claiming conformal coverage and must fall back to conservative geometric road bounds ($r_{\text{fallback}} = 3.50\text{ m}$), setting `coverage_guarantee_valid = False` in the output telemetry log.

---

## 10. Pre-Specified Sensitivity Analyses

To evaluate the robustness of research findings to endpoint thresholds, the following three sensitivity analyses are pre-specified:

1. **Per-Protocol Analysis (Harness Fault Exclusion)**:
   - Excludes simulation runs terminated by verified hardware/OS/runner infrastructure faults (process crash, memory error, database lock) that are demonstrably unrelated to vehicle dynamics or planner livelock.
2. **Tight vs. Wide Safety Margins**:
   - Evaluates near-miss rate under tight envelope ($d_{\text{near}} = 0.50\text{ m}, \text{TTC} = 0.80\text{ s}$) and wide envelope ($d_{\text{near}} = 1.50\text{ m}, \text{TTC} = 1.80\text{ s}$).
3. **Relaxed Goal Completion**:
   - Re-evaluates Safe-Progress Rate with goal line placed at $X_{\text{goal}} = 60.00\text{ m}$ ($5\text{ m}$ shorter) to verify that results are not artifacts of the specific boundary coordinate.

---

## 11. Hand-Calculated McNemar Test & Confidence Interval Case

- **Contingency Table**: $N = 100$ matched pairs.
  - Both Success: $n_{11} = 45$
  - Both Fail: $n_{00} = 25$
  - P3 Success, $B^*$ Fail: $n_{10} = 24$
  - P3 Fail, $B^*$ Success: $n_{01} = 6$
- **Total Discordant Pairs**: $n_{\text{disc}} = 24 + 6 = 30$.
- **Exact Binomial p-value**:
  $$p = 2 \cdot \sum_{k=24}^{30} \binom{30}{k} (0.5)^{30} = 2 \cdot [0.000721] = \mathbf{0.00144} \quad (\text{Significant at } \alpha = 0.05)$$
- **Risk Difference**:
  $$\widehat{\Delta}_{\text{SP}} = \frac{24 - 6}{100} = \mathbf{+18.0\%}$$
- **Wald Confidence Interval (Asymptotic)**:
  $$\text{SE} = \frac{\sqrt{n_{10} + n_{01} - (n_{10} - n_{01})^2 / N}}{N} = \frac{\sqrt{30 - 3.24}}{100} = \frac{\sqrt{26.76}}{100} \approx 0.0517$$
  $$95\%\text{ CI} = 0.180 \pm 1.96(0.0517) = [0.0786, 0.2814] = \mathbf{[+7.86\%, \; +28.14\%]}$$
