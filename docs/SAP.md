# Statistical Analysis Plan (SAP) — ADAPTIVE-PATH

> **Protocol ID**: SAP-SIH26037-v2.0 (Revised for Second Gate G2 Review)  
> **Status**: Proposed / Under G2 Review  
> **Prepared Date**: 2026-11-03  
> **Approval Date**: Pending Second Gate G2 Review  
> **Git Commit / Branch**: `research/phase-0-audit`  
> **Authoritative Pre-Registration**: Strictly defines statistical contrasts, hypotheses, endpoints, sample sizes, power calculations, and calibration protocols prior to final confirmatory execution.

---

## 1. Research Question

Can uncertainty-aware, event-triggered path replanning (Planner **P3: Risk-Adaptive + MRM**) achieve a statistically superior **safe-progress rate** while maintaining kinematic comfort (RMS jerk) and real-time computation ($\tau_{P95} \le 50\text{ ms}$) compared to the strongest classical baseline planner ($B^*$) across unstructured, non-lane-based simulated Indian roadways?

---

## 2. Experimental Population, Run Classes & ITT Principle

### 2.1 The 5 Canonical Scenario Families
1. `SCENARIO_1_VILLAGE_ROAD`: Narrow single-lane unmarked road, unpaved shoulders, oncoming heavy truck forcing shoulder bypass.
2. `SCENARIO_2_URBAN_INTERSECTION`: Uncontrolled four-way intersection, cross-cutting three-wheelers, swarming two-wheelers.
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

## 3. Four-Way Disjoint Data Splits & Seed Governance

To enforce absolute protection against data snooping, tuning leakage, and overfitting, the random seed space is partitioned into **four mutually disjoint sets**:

| Dataset Split | Purpose | Seed Range | Seeds per Scenario | Total Episodes (5 Scenarios) | Access Gate |
| :--- | :--- | :---: | :---: | :---: | :---: |
| **Tuning Split** | Initial parameter exploration & algorithm design | $1000\text{--}1009$ | $10$ | $50$ | Phase 0 / Free |
| **Calibration Split** | Fitting non-parametric split-conformal quantiles | $1500\text{--}1539$ | $40$ | $200$ | After Gate G2 |
| **Validation Split** | $B^*$ selection & P3 livelock progress tuning | $2000\text{--}2009$ | $10$ | $50$ | After Gate G2 |
| **Confirmatory Frozen Split** | Final locked hypothesis testing & paper results | $3000\text{--}3029$ | $30$ | **$150$** (Proposed) | **Strictly Locked until G3** |

### Proof of Disjointness
$$\mathcal{S}_{\text{tune}} \cap \mathcal{S}_{\text{calib}} = [1000, 1009] \cap [1500, 1539] = \emptyset$$
$$\mathcal{S}_{\text{calib}} \cap \mathcal{S}_{\text{val}} = [1500, 1539] \cap [2000, 2009] = \emptyset$$
$$\mathcal{S}_{\text{val}} \cap \mathcal{S}_{\text{frozen}} = [2000, 2009] \cap [3000, 3029] = \emptyset$$
$$\mathcal{S}_{\text{tune}} \cap \mathcal{S}_{\text{frozen}} = [1000, 1009] \cap [3000, 3029] = \emptyset$$

- **Historical Exposed Results**: Results previously generated in `frozen_test_results.json` are permanently marked as **Exploratory Pilot Data** and will never be reported as confirmatory.

---

## 4. Primary Contrast & Baseline Selection Rule

### 4.1 Comparator Candidates
The candidate classical baseline planners are:
- **`B0`**: Shortest Path (Centerline follower, non-reactive).
- **`B1`**: DWA + Velocity Obstacles (Reactive short-horizon avoidance).
- **`B2`**: Kinematic Hybrid $A^*$ (SE(2) graph search with obstacle clearance heuristics).

### 4.2 Selection Rule
Prior to unblinding the Confirmatory Frozen Split, the single strongest baseline $B^*$ is selected based on performance across the **Validation Split** (Seeds 2000–2009):
1. **Primary Metric**: Highest Safe-Progress Rate ($Y_{\text{SP}}$).
2. **Tie-Breaker 1**: Highest minimum obstacle clearance ($d_{\min}$).
3. **Tie-Breaker 2**: Lowest mean RMS jerk ($j_{\text{RMS}}$).
4. **Tie-Breaker 3**: Lowest P95 planning latency ($\tau_{P95}$).

The selected baseline $B^*$ is committed to `docs/DECISIONS.md` before Gate G3 authorization.

---

## 5. Statistical Hypotheses & Primary Endpoint

### 5.1 Primary Endpoint: Safe-Progress Rate ($Y_{\text{SP}}$)
$$Y_{\text{SP}, i} = \mathbb{I}(\text{CollisionFree}_i = \text{True} \land \text{GoalCompleted}_i = \text{True})$$

### 5.2 Hypothesis Formulation
We test the paired binary outcomes across matched scenario-seed episodes $(s_k, \omega_m)$:
- **Null Hypothesis ($H_0$)**: $p_{10} \le p_{01}$  
  *(The probability of P3 succeeding while $B^*$ fails is less than or equal to the probability of $B^*$ succeeding while P3 fails)*
- **Alternative Hypothesis ($H_1$)**: $p_{10} > p_{01}$  
  *(P3 achieves a strictly higher safe-progress probability than baseline $B^*$)*
- **Significance Level**: One-sided $\alpha = 0.025$ (equivalent to two-sided $\alpha = 0.05$).

---

## 6. Sample Size & Statistical Power Calculations

> **Caveat on Sample Size**: $N = 150$ matched episodes (30 seeds $\times$ 5 scenarios) are **proposed** based on conservative power projections. The final statistical power depends on the empirical discordance observed during validation. If validation reveals low total discordance ($p_{10} + p_{01} < 0.15$), the required sample size will be formally re-evaluated and expanded prior to Gate G3.

### 6.1 Paired-Binary Power Model (Exact McNemar Test)
For paired binary data, statistical power depends on the proportion of discordant pairs:
$$p_{10} = P(\text{P3} = 1, B^* = 0), \quad p_{01} = P(\text{P3} = 0, B^* = 1)$$
$$n_{\text{disc}} = N \cdot (p_{10} + p_{01}), \quad \text{Odds Ratio } \psi = \frac{p_{10}}{p_{01}}$$

Under the asymptotic normal approximation with continuity correction:
$$\text{Power} = \Phi\left( \frac{\sqrt{N}(p_{10} - p_{01}) - z_{1-\alpha/2} \sqrt{p_{10} + p_{01}}}{\sqrt{p_{10} + p_{01} - (p_{10} - p_{01})^2}} \right)$$

### 6.2 Power Table across Sample Sizes & Effect Sizes ($\alpha = 0.05$, two-sided)

| Total Matched Pairs ($N$) | Assumed $p_{10}$ | Assumed $p_{01}$ | Total Discordance | Odds Ratio ($\psi$) | Estimated Statistical Power ($1 - \beta$) |
| :---: | :---: | :---: | :---: | :---: | :---: |
| **50** | $0.30$ | $0.10$ | $40\%$ | $3.0$ | $61.4\%$ |
| **75** | $0.30$ | $0.10$ | $40\%$ | $3.0$ | $78.8\%$ |
| **100** | $0.30$ | $0.10$ | $40\%$ | $3.0$ | $89.2\%$ |
| **150 (Proposed)** | **$0.30$** | **$0.10$** | **$40\%$** | **$3.0$** | **$97.6\%$** |
| **150 (Proposed)** | **$0.25$** | **$0.10$** | **$35\%$** | **$2.5$** | **$88.4\%$** |
| **150 (Proposed)** | **$0.20$** | **$0.10$** | **$30\%$** | **$2.0$** | **$68.2\%$** |

- **Conclusion**: If the true odds ratio $\psi \ge 2.5$ with discordant proportion $\ge 35\%$, the proposed $N = 150$ episodes provides $> 88\%$ power. If validation data shows $\psi < 2.5$, sample size will be adjusted at G3.

---

## 7. Primary Statistical Analysis Specification

1. **Exact McNemar Test**: Computed from the $2 \times 2$ contingency table of paired outcomes:
   $$p\text{-value} = 2 \cdot \sum_{k=n_{10}}^{n_{\text{disc}}} \binom{n_{\text{disc}}}{k} 0.5^{n_{\text{disc}}} \quad \left(\text{if } n_{10} > \frac{n_{\text{disc}}}{2}\right)$$
2. **Paired Risk Difference**:
   $$\widehat{\Delta}_{\text{SP}} = \hat{p}_{\text{P3}} - \hat{p}_{B^*} = \frac{n_{10} - n_{01}}{N}$$
3. **95% Confidence Intervals**:
   - Primary: **1,000 paired percentile bootstrap resamples** resampling matched scenario-seed pairs with replacement at the episode level.
   - Secondary: Exact Wilson score interval for marginal differences.

---

## 8. Secondary Endpoints & Multiple Comparisons

### 8.1 Secondary Hypotheses Family
1. **Minimum Clearance ($d_{\min}$)**: Paired Wilcoxon signed-rank test on continuous distance (meters). Effect size: Cliff's Delta ($\delta$) and median difference.
2. **Kinematic Comfort (RMS Jerk $j_{\text{RMS}}$)**: Paired Wilcoxon signed-rank test on $(\text{m/s}^3)$.
3. **Progress Efficiency ($\eta_{\text{prog}}$)**: Paired Wilcoxon signed-rank test on ratio $[0, 1]$.
4. **Computational Latency ($\tau_{P95}$)**: Paired t-test / Wilcoxon on tail latency (ms).

### 8.2 Family-Wise Error Rate (FWER) Control
- Tested using the **Holm-Bonferroni step-down procedure** across the 4 secondary endpoints at family level $\alpha = 0.05$.
- P-values ordered $p_{(1)} \le p_{(2)} \le p_{(3)} \le p_{(4)}$ are compared to $\frac{\alpha}{5 - k}$.
- **Gatekeeping Rule**: Secondary endpoints are confirmatory *only if* the primary safe-progress hypothesis achieves statistical significance at $\alpha = 0.05$. If primary fails, secondary endpoints are reported as strictly exploratory.

---

## 9. Split-Conformal Calibration Standard

### 9.1 Calibration Episode Unit & Independence
- Calibration unit: Independent simulation episode $(s, \omega) \in \mathcal{S}_{\text{calib}}$ ($n = 40$ seeds across 5 scenarios $= 200$ episodes).

### 9.2 Non-Conformity Score Formulation
For dynamic obstacle $j$ of class $c$ over prediction horizon $H = 2.80\text{ s}$ ($14$ steps at $\Delta t = 0.2\text{ s}$):
$$s_{i, j} = \max_{k \in \{1,\dots,14\}} \|\mathbf{p}_{\text{true}, i, j}(t_k) - \mathbf{p}_{\text{forecast}, i, j}(t_k)\|_2$$

### 9.3 Sample Size Requirement per Class
- Minimum requirement: **$n \ge 40$ independent observed trajectories per class**.
- For target coverage $1 - \alpha = 0.95$:
  $$k = \lceil (n + 1)(1 - \alpha) \rceil = \lceil 0.95(n + 1) \rceil$$
  - For $n = 40$: $k = \lceil 0.95 \times 41 \rceil = \lceil 38.95 \rceil = 39$. The 39th ordered score is the calibrated quantile $\hat{q}_{0.95} = s_{(39)}$.
- **Insufficient Sample Rule**: If an agent class has $n < 40$ observed calibration trajectories, conformal coverage is marked as **unavailable**; the predictor cannot claim 95% mathematical coverage and must fall back to conservative geometric road bounds.

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
