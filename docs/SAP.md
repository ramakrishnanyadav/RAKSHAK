# Statistical Analysis Plan (SAP) — ADAPTIVE-PATH

> **Protocol ID**: SAP-SIH26037-v2.3 (Final G2 Closure — Conformal Score/Set Consistency)  
> **Status**: Proposed / Awaiting Final G2 Sign-Off  
> **Date**: 2026-11-03  
> **Git Commit / Branch**: `research/phase-0-audit`  
> **Authoritative Pre-Registration**: Strictly defines statistical contrasts, hypotheses, endpoints, sample sizes, exact vs. asymptotic power calculations, and calibration protocols prior to final confirmatory execution.

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
- **Power & Sample Size Modeling**: Sample size planning is modeled using both the **exact binomial power enumeration** and the **asymptotic normal approximation to McNemar's test** (Miettinen 1968 / Lu & Bean 1995 method).

### 6.2 Exact McNemar Power Enumeration
Let total matched pairs be $N = 150$. The number of discordant pairs is binomially distributed:
$$n_{\text{disc}} \sim \text{Binomial}(N, \; p_{\text{disc}}) \quad \text{where } p_{\text{disc}} = p_{10} + p_{01}$$
Under $H_1$, conditional on $n_{\text{disc}} = k$, the number of P3-favorable discordant pairs follows:
$$n_{10} \mid (n_{\text{disc}} = k) \sim \text{Binomial}(k, \; \pi) \quad \text{where } \pi = \frac{p_{10}}{p_{10} + p_{01}}$$
For each $k \in \{1, \dots, N\}$, the exact two-sided critical value $c(k)$ is the largest integer such that:
$$P\Big(\text{Binomial}(k, 0.5) \le c(k)\Big) \le \frac{\alpha}{2} = 0.025$$
The unconditional exact power is obtained by summing over all possible discordant pair counts:
$$\text{Power}_{\text{exact}} = \sum_{k=1}^N \binom{N}{k} p_{\text{disc}}^k (1 - p_{\text{disc}})^{N-k} \cdot \left[ \sum_{m \le c(k)} \binom{k}{m} \pi^m (1 - \pi)^{k-m} + \sum_{m \ge k - c(k)} \binom{k}{m} \pi^m (1 - \pi)^{k-m} \right]$$

### 6.3 Asymptotic Power Formulation
Under large-sample theory, the test statistic has asymptotic variance:
$$\text{Var}_{H_0} = \frac{p_{\text{disc}}}{N}, \quad \text{Var}_{H_1} = \frac{p_{\text{disc}} - (p_{10} - p_{01})^2}{N}$$
- **Asymptotic Z-Score (without continuity correction)**:
  $$Z_{\text{asymp}} = \frac{\sqrt{N}(p_{10} - p_{01}) - z_{1-\alpha/2} \sqrt{p_{\text{disc}}}}{\sqrt{p_{\text{disc}} - (p_{10} - p_{01})^2}}$$
- **Asymptotic Power**: $\text{Power}_{\text{asymp}} = \Phi(Z_{\text{asymp}})$.
- **With Continuity Correction**:
  $$Z_{\text{asymp, cc}} = \frac{\sqrt{N}\left((p_{10} - p_{01}) - \frac{2}{N}\right) - z_{1-\alpha/2} \sqrt{p_{\text{disc}}}}{\sqrt{p_{\text{disc}} - (p_{10} - p_{01})^2}}$$

### 6.4 Independent Verification for Target Effect ($N = 150$, $p_{10} = 0.25$, $p_{01} = 0.08$)
- $\Delta = p_{10} - p_{01} = 0.170$.
- $p_{\text{disc}} = 0.250 + 0.080 = 0.330$.
- Odds Ratio $\psi = \frac{0.25}{0.08} = 3.125$.
- Numerator: $\sqrt{150} \times 0.170 - 1.960 \sqrt{0.330} = 2.0821 - 1.1259 = 0.9562$.
- Denominator: $\sqrt{0.330 - (0.170)^2} = \sqrt{0.330 - 0.0289} = \sqrt{0.3011} = 0.5487$.
- **Asymptotic Z-Score**: $Z_{\text{asymp}} = \frac{0.9562}{0.5487} = \mathbf{1.7425}$.
- **Asymptotic Power (no cc)**: $\Phi(1.7425) = \mathbf{95.93\%}$.
- **Asymptotic Power (with cc)**: $\Phi(1.4452) = \mathbf{92.58\%}$.
- **Exact McNemar Power (Enumeration)**: $\mathbf{95.40\%}$.

### 6.5 Power Sensitivity Table across Discordant Effect Sizes ($N = 150$, $\alpha = 0.05$)

| Effect Scenario | $p_{10}$ | $p_{01}$ | Risk Difference ($\Delta$) | Odds Ratio ($\psi$) | Asymptotic Power | **Exact McNemar Power** | Adequacy Assessment |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| **High Superiority** | $0.30$ | $0.08$ | $+22.0\%$ | $3.75$ | $99.5\%$ | **$99.5\%$** | Fully Powered ($>99\%$) |
| **Moderate Target** | **$0.25$** | **$0.08$** | **$+17.0\%$** | **$3.12$** | **$95.9\%$** | **$95.4\%$** | Fully Powered ($>95\%$) |
| **Conservative Delta**| $0.22$ | $0.08$ | $+14.0\%$ | $2.75$ | $88.7\%$ | **$87.0\%$** | Adequately Powered ($>85\%$) |
| **Boundary Minimum** | $0.20$ | $0.08$ | $+12.0\%$ | $2.50$ | $79.9\%$ | **$76.9\%$** | Marginal Threshold ($80\%$) |
| **Weaker Effect A** | $0.20$ | $0.10$ | $+10.0\%$ | $2.00$ | $61.1\%$ | **$56.5\%$** | Underpowered ($<60\%$) |
| **Weaker Effect B** | $0.18$ | $0.10$ | $+8.0\%$ | $1.80$ | $45.6\%$ | **$40.3\%$** | Underpowered ($<50\%$) |
| **Weakest Boundary** | $0.15$ | $0.10$ | $+5.0\%$ | $1.50$ | $23.0\%$ | **$18.4\%$** | Inadequate ($<25\%$) |

#### Preserving Proposed $N = 150$
- **Conclusion**: $N = 150$ matched pairs (30 seeds $\times$ 5 scenarios) is **preserved as the pre-registered sample size** because it provides robust statistical power ($\ge 87\%$) for realistic target effect sizes ($\Delta \ge 0.14, \psi \ge 2.75$).
- **Gate G3 Verification Invariant**: If empirical discordance on Validation Sub-Split A reveals an odds ratio $\psi < 2.2$ or $\Delta < 0.12$, the sample size must be formally expanded at Gate G3 prior to unblinding the frozen split.

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
- **Calibration Unit**: Independent simulation episode $e = (s, \omega) \in \mathcal{S}_{\text{calib}}$ (Seeds 1500–1539 across 5 scenario families $= 200$ episodes).
- Episodes are strictly independent under varied stochastic seeds, agent spawning locations, and physical timing.
- **Clear Distinction: Independent Episodes vs. Obstacle Observations**:
  Let $\mathcal{J}_e(c)$ denote the set of dynamic obstacles of class $c$ present in episode $e$.
  - An episode is included in the calibration pool for class $c$ if and only if at least one obstacle of class $c$ appears in that episode ($|\mathcal{J}_e(c)| \ge 1$).
  - Let $\mathcal{E}_{\text{calib}}(c) = \{ e \in \mathcal{S}_{\text{calib}} : |\mathcal{J}_e(c)| \ge 1 \}$ denote the subset of relevant calibration episodes for class $c$.
  - The effective calibration sample size is the number of **independent episodes**:
    $$n_e(c) = |\mathcal{E}_{\text{calib}}(c)|$$
  - This is strictly distinguished from the total count of obstacle observations:
    $$N_{\text{obs}}(c) = \sum_{e \in \mathcal{E}_{\text{calib}}(c)} |\mathcal{J}_e(c)| \ge n_e(c)$$
  - **Exclusion of Episodes Without Target Class**: Episodes without the target class ($\mathcal{J}_e(c) = \emptyset$) **must NOT contribute zero scores**. Assigning a nonconformity score of zero to absent obstacles would artificially compress the calibration empirical distribution and destroy coverage guarantees. Such episodes are completely excluded from the calibration set for class $c$.

### 9.2 Anisotropic Mahalanobis Non-Conformity Score Formulation
For dynamic obstacle $j \in \mathcal{J}_e(c)$ in episode $e$ at prediction horizon step $t_k \in \{0.20\text{ s}, \dots, 2.80\text{ s}\}$ ($K = 14$ steps), the obstacle-level nonconformity score is formulated in the obstacle's predicted body frame:

$$s_{e, j}(c, t_k) = \sqrt{\left(\frac{\Delta x_{\text{local}, e, j}(t_k)}{\sigma_{\text{long}}(c, t_k)}\right)^2 + \left(\frac{\Delta y_{\text{local}, e, j}(t_k)}{\sigma_{\text{lat}}(c, t_k)}\right)^2}$$

Where:
- $\Delta x_{\text{local}, e, j}(t_k)$ and $\Delta y_{\text{local}, e, j}(t_k)$ are the longitudinal and lateral tracking residuals relative to the model's nominal trajectory forecast.
- $\sigma_{\text{long}}(c, t_k) = \beta_{\text{long}} \cdot \sigma_0(c, v_j(t_0), t_k)$ and $\sigma_{\text{lat}}(c, t_k) = \beta_{\text{lat}} \cdot \sigma_0(c, v_j(t_0), t_k)$ are directional scale normalizers.

### 9.3 Inference-Time Normalizer Inputs & Calibration Parity
To guarantee exact mathematical parity between calibration and online inference without temporal lookahead or data leakage:
- **Observed Speed $v_j(t_0)$**:
  $$v_j(t_0) = \sqrt{v_{x, j}(t_0)^2 + v_{y, j}(t_0)^2}$$
  is the **instantaneous observed scalar speed at query timestamp $t_0$ (prediction time)**, obtained from the current perception tracking state (`AgentTrack.v_x`, `AgentTrack.v_y`). It is strictly an inference-time quantity available before rollout, NOT a realized future speed.
- **Bounding Dimensions ($L_j, W_j$)**:
  Obstacle length $L_j$ and width $W_j$ are static bounding dimensions available at prediction time from track classification (`AgentTrack.length`, `AgentTrack.width`).
- **Kinematic Expansion Base ($\sigma_0$)**:
  $$\sigma_0(c, v_j(t_0), t_k) = \max\left(1.00, \; 0.50 L_j + 0.20 v_j(t_0) + 0.15 t_k\right)$$
- **Strict Calibration-Inference Parity**: The identical feature tuple $(v_j(t_0), L_j)$ measured at the forecast trigger instant $t_0$ is used in both offline calibration and online inference. Future trajectory steps are used exclusively to compute the realized position residual vector $[\Delta x, \Delta y]^T$.

### 9.4 Episode-Level Calibration Score Aggregation
When multiple obstacles of class $c$ are present simultaneously within an episode $e$ ($|\mathcal{J}_e(c)| > 1$), each independent episode must contribute **exactly one scalar score** to preserve exchangeability at the episode level.
1. **Episode Pointwise Nonconformity Score**:
   Defined conservatively as the maximum nonconformity score across all obstacles of class $c$ in episode $e$:
   $$s_e(c, t_k) = \max_{j \in \mathcal{J}_e(c)} s_{e, j}(c, t_k)$$
2. **Episode Simultaneous Trajectory Nonconformity Score**:
   Defined as the maximum across both all obstacles of class $c$ and all horizon steps $t_k \in \{1, \dots, K\}$:
   $$s_e^{\text{sim}}(c) = \max_{j \in \mathcal{J}_e(c)} \max_{k \in \{1, \dots, K\}} s_{e, j}(c, t_k)$$
   This conservative maximum ensures that achieving $(1-\alpha)$ coverage on episode-level scores simultaneously guarantees that all obstacles of class $c$ in the episode are covered with probability at least $1-\alpha$.

### 9.5 Origin and Pre-Calibration of Directional Coefficients ($\beta_{\text{long}} = 0.50, \beta_{\text{lat}} = 0.35$)
- **Aspect Ratio Rationale**: Road corridor trajectory errors exhibit larger longitudinal timing dispersion than lateral corridor deviation ($\beta_{\text{long}} / \beta_{\text{lat}} \approx 1.429$).
- **Source Split**: Directional coefficients $\beta_{\text{long}} = 0.50$ and $\beta_{\text{lat}} = 0.35$ were fitted empirically on the independent training/tuning split (Split 1 `tune`, Seeds 1000–1009) by calculating root-mean-square residual ratios across observed trajectories.
- **Pre-Registration Lock**: These scale parameters are fixed *prior to calibration* and serve as normalizers inside the score function. Conformal calibration on $\mathcal{S}_{\text{calib}}$ calibrates the scalar expansion factor $\hat{q}$ without post-hoc set distortion.

### 9.6 Class-by-Horizon Sample Size Requirement & Finite-Sample Quantile
- **Requirement**: **$n_e(c) \ge 40$ independent episodes containing class $c$ across prediction horizon step $t_k$**.
- For target coverage level $1 - \alpha = 0.95$:
  $$m = \lceil (n_e(c) + 1)(1 - \alpha) \rceil = \lceil 0.95(n_e(c) + 1) \rceil$$
  - For $n_e(c) = 40$: $m = \lceil 0.95 \times 41 \rceil = \lceil 38.95 \rceil = 39$. Calibrated quantile is $\hat{q}_{0.95}(c, t_k) = s_{(39)}$.
- **Behavior when Sample Counts are Insufficient ($n_e(c) < 40$)**:
  - If any class has $n_e(c) < 40$ valid calibration episodes at horizon $t_k$, **mathematical 95% coverage is formally marked as "Coverage Guarantee Unavailable (n < 40)"**.
  - The predictor is prohibited from claiming conformal coverage and must fall back to conservative geometric road bounds ($r_{\text{fallback}} = 3.50\text{ m}$), setting `coverage_guarantee_valid = False` in the output telemetry log.

### 9.7 Exact Deployed Prediction Set & Coverage Invariant
The exact prediction set deployed by the predictor is the sub-level set:
$$\mathcal{C}_{1-\alpha}(c, t_k) = \left\{ (x, y) \in \mathbb{R}^2 : \left(\frac{\Delta x_{\text{local}}}{\sigma_{\text{long}}(c, t_k)}\right)^2 + \left(\frac{\Delta y_{\text{local}}}{\sigma_{\text{lat}}(c, t_k)}\right)^2 \le \hat{q}_{1-\alpha}^2(c, t_k) \right\}$$

This forms an oriented ellipse with semi-axes:
$$r_{\text{long}}(c, t_k) = \hat{q}_{1-\alpha}(c, t_k) \cdot \sigma_{\text{long}}(c, t_k)$$
$$r_{\text{lat}}(c, t_k) = \hat{q}_{1-\alpha}(c, t_k) \cdot \sigma_{\text{lat}}(c, t_k)$$

- **Coverage Claim Restriction**:
  Because $\mathcal{C}_{1-\alpha}(c, t_k) \equiv \{\mathbf{p} : s(\mathbf{p}) \le \hat{q}_{1-\alpha}\}$, the Split-Conformal Theorem guarantees exact finite-sample marginal coverage:
  $$P\left(\mathbf{p}_{\text{true}}(t_k) \in \mathcal{C}_{1-\alpha}(c, t_k)\right) \ge 1 - \alpha$$
  No coverage claim is permitted for any transformed or heuristically scaled set unless calibrated using a matching score function.

### 9.8 Pointwise vs. Simultaneous Trajectory Coverage
1. **Pointwise Conformal Coverage**:
   - Calibrated step-by-step for each $t_k \in \{0.20\text{ s}, \dots, 2.80\text{ s}\}$ using episode scores $s_e(c, t_k)$ and quantile $\hat{q}_{1-\alpha}^{\text{pt}}(c, t_k)$.
   - Guarantees marginal coverage at each discrete horizon step:
     $$\forall k \in \{1, \dots, K\}, \quad P\left(\mathbf{p}_{\text{true}}(t_k) \in \mathcal{C}_{1-\alpha}^{\text{pt}}(c, t_k)\right) \ge 1 - \alpha$$
   - Utilized for frame-by-frame telemetry and risk field potential calculations.
2. **Simultaneous Trajectory Coverage**:
   - Calibrated across the complete 14-step future trajectory using episode supremum scores $s_e^{\text{sim}}(c)$:
     $$\hat{q}_{1-\alpha}^{\text{sim}}(c) = s_{(\lceil (n_e(c)+1)(1-\alpha) \rceil)}^{\text{sim}}(c)$$
   - Semi-axes: $r_{\text{long}}^{\text{sim}}(c, t_k) = \hat{q}_{1-\alpha}^{\text{sim}}(c) \cdot \sigma_{\text{long}}(c, t_k)$ and $r_{\text{lat}}^{\text{sim}}(c, t_k) = \hat{q}_{1-\alpha}^{\text{sim}}(c) \cdot \sigma_{\text{lat}}(c, t_k)$.
   - Guarantees joint spatial containment across the entire future planning horizon:
     $$P\left(\forall k \in \{1, \dots, K\}, \quad \mathbf{p}_{\text{true}}(t_k) \in \mathcal{C}_{1-\alpha}^{\text{sim}}(c, t_k)\right) \ge 1 - \alpha$$
   - Utilized for event replanning triggers (`CONFORMAL_VIOLATION`), preventing excessive false-positive replans along the horizon.

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
