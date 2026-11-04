# Pre-Registered Held-Out Evaluation Protocol: ADAPTIVE-PATH (SIH26037)

**Document Status:** Pre-Registered Protocol (LOCKED & FROZEN)  
**Base Code Commit:** `96c56380a4d685de9b74ec591bcd7b82970c951b`  
**Execution Status:** NOT YET EXECUTED — PENDING FORMAL APPROVAL  
**Protocol Version:** 1.0.0  

---

## 1. Executive Summary & Objective

This document defines the formal, pre-registered experimental protocol for evaluating the ADAPTIVE-PATH autonomous motion planning system on a clean, strictly held-out evaluation split. 

Prior splits (`val_a` seeds 1000–1004, `val_b` seeds 2005–2009) were utilized during engineering diagnostic phases and parameter selection (specifically the Workstream 1 stationary persistence parameters $w_{\text{stall}}$ and $w_{\text{prog}}$). Consequently, `val_b` is formally designated as **post-tuning evidence**, and cannot serve as an unbiased benchmark.

This protocol establishes:
1. A pristine, unexposed seed block ($N=50$ seeds per scenario, total $N=250$ episodes per planner).
2. Co-primary statistical comparators with rigorous family-wise error rate control.
3. A formal power calculation establishing statistical validity.
4. Mandatory per-scenario reporting rules prohibiting pooled-only claims.
5. Complete parameter freezing of all planners prior to evaluation.

---

## 2. Experimental Design

### 2.1 Seed Allocation & Scenarios
- **Split Name:** `test_heldout`
- **Seed Range:** `[4000, 4049]` (inclusive, 50 pseudo-random seeds generated via Mersenne Twister `random.seed(s)`).
- **Canonical Scenarios ($K=5$):**
  1. `SCENARIO_1_VILLAGE_ROAD` (Unstructured unpaved shoulder, oncoming vehicle, pedestrian obstruction)
  2. `SCENARIO_2_URBAN_INTERSECTION` (Chaotic 4-way unsignalized junction, cut-in two-wheelers)
  3. `SCENARIO_3_HIGHWAY_MERGE` (High-speed lateral merge, speed differential, blind-spot intrusion)
  4. `SCENARIO_4_DENSE_MARKET` (Narrow bi-directional alley, dense crowd, stationary hand-carts)
  5. `SCENARIO_5_CATTLE_CROSSING` (Flagship SIH scenario: wandering bovine with unpredictable hesitation)

- **Total Sample Size:**
  $$\text{Sample Size per Planner} = 50 \text{ seeds} \times 5 \text{ scenarios} = 250 \text{ episodes} \quad (N = 250)$$
  Across all 4 evaluated configurations, a total of $1,000$ simulation runs will be generated.

---

## 3. Evaluated Planner Configurations & Exact Parameters

All planner implementations and parameters are strictly frozen as of commit `96c56380a4d685de9b74ec591bcd7b82970c951b`.

### 3.1 Primary Candidate: P3 Corrected (`P3_Corrected`)
- **Algorithm:** Dynamic Risk-Triggered Replanning with Conformal Envelopes, SAT Polygon-Circle Occupancy, and F3 Stationary Persistence Penalty.
- **Parameters:**
  ```json
  {
    "w_stall": 4.00,
    "w_prog": 2.20,
    "t_grace": 1.00,
    "gamma": 1.50,
    "J_stall_max": 5.00,
    "critical_trigger": 0.62,
    "delta_risk_trigger": 0.20,
    "uncertainty_mrm_limit": 2.60
  }
  ```

### 3.2 Co-Primary Comparator 1: B2 Kinematic Hybrid A* (`B2_Hybrid_AStar`)
- **Algorithm:** Kinematic Hybrid A* with continuous curvature and Reeds-Shepp analytic expansions.
- **Role:** Primary non-adaptive search baseline representing classical high-performance trajectory planning.

### 3.3 Co-Primary Comparator 2: P3 Baseline (`P3_Baseline`)
- **Algorithm:** P3 Adaptive Planner without persistence penalty ($w_{\text{stall}} = 0.00, w_{\text{prog}} = 0.00$).
- **Role:** Direct ablation baseline measuring the exact isolated contribution of the stall-prevention formulation.

### 3.4 Secondary Comparator: B1 DWA + Velocity Obstacles (`B1_DWAVO`)
- **Algorithm:** Dynamic Window Approach coupled with Velocity Obstacles for non-communicative agents.
- **Role:** Standard reactive baseline deployed in the live side-by-side demo UI.

---

## 4. Hypothesis Testing & Statistical Power

### 4.1 Primary Endpoints
1. **Safe Progress Rate ($R_{\text{safe}}$):** Binary episode indicator defined as:
   $$\text{Safe Progress} = \mathbf{1}(\text{completed\_goal} = \text{True} \land \text{collision} = \text{False})$$
2. **Collision Rate ($R_{\text{col}}$):** Binary episode indicator defined as:
   $$\text{Collision} = \mathbf{1}(\text{collision} = \text{True})$$

### 4.2 Co-Primary Hypotheses & Family-Wise Error Control
To control the family-wise error rate (FWER) across the two co-primary comparisons, the **Bonferroni-Holm step-down procedure** is applied at overall significance level $\alpha = 0.05$:

- **Hypothesis $H_{1}$ (Ablation Proof):**
  $$H_{0,1}: R_{\text{safe}}(P3_{\text{corr}}) \le R_{\text{safe}}(P3_{\text{base}}) \quad \text{vs.} \quad H_{1,1}: R_{\text{safe}}(P3_{\text{corr}}) > R_{\text{safe}}(P3_{\text{base}})$$
- **Hypothesis $H_{2}$ (State-of-the-Art Benchmark Proof):**
  $$H_{0,2}: R_{\text{safe}}(P3_{\text{corr}}) \le R_{\text{safe}}(B2) \quad \text{vs.} \quad H_{1,2}: R_{\text{safe}}(P3_{\text{corr}}) > R_{\text{safe}}(B2)$$

**Decision Rule:**
- Order p-values: $p_{(1)} \le p_{(2)}$.
- If $p_{(1)} < \frac{0.05}{2} = 0.025$, reject the corresponding null hypothesis and test the second hypothesis at $\alpha = 0.05$.
- If $p_{(1)} \ge 0.025$, fail to reject both null hypotheses.

### 4.3 Statistical Power Calculation ($N=250$)
- **Test Method:** Two-sided paired McNemar test (matching identical seeds across planners) and two-sample proportion z-test.
- **Assumptions:**
  - Evaluated sample size per configuration: $N = 250$.
  - Nominal type I error rate: $\alpha_{\text{adjusted}} = 0.025$.
  - Anticipated comparator success rate: $p_0 \in [0.15, 0.40]$.
  - Minimum Detectable Effect (MDE): $\Delta \ge 0.15$ (15 percentage point improvement).
- **Power Derivation ($1 - \beta$):**
  $$\text{Under } p_0 = 0.25, \, p_1 = 0.42 \, (\Delta = 0.17): \quad Z_{\beta} = \frac{\Delta}{\sqrt{\frac{p_0(1-p_0) + p_1(1-p_1)}{N}}} - Z_{1 - \alpha/2} \approx 2.38 - 2.24 = 1.14 \implies \text{Power } \approx 87.3\%$$
  $$\text{Under } p_0 = 0.20, \, p_1 = 0.40 \, (\Delta = 0.20): \quad Z_{\beta} \approx 3.01 - 2.24 = 1.77 \implies \text{Power } \approx 96.2\%$$
- **Conclusion:** At $N=250$, the trial is adequately powered ($>85\%$) to detect meaningful performance differences of $\ge 15$ percentage points at family-wise corrected $\alpha = 0.025$.

---

## 5. Mandatory Per-Scenario Reporting Structure

**RULE:** No aggregate or pooled-only claims may be published without the accompanying per-scenario breakdown.

Every evaluation report generated from this protocol must tabulate all 5 scenarios individually:

| Scenario ID | Name | P3 Corrected ($R_{\text{safe}}$) | B2 Hybrid A* ($R_{\text{safe}}$) | P3 Baseline ($R_{\text{safe}}$) | B1 DWA+VO ($R_{\text{safe}}$) | Fisher Exact / McNemar p-value |
|---|---|---|---|---|---|---|
| SCENARIO_1 | Village Road | — / 50 | — / 50 | — / 50 | — / 50 | — |
| SCENARIO_2 | Urban Intersection | — / 50 | — / 50 | — / 50 | — / 50 | — |
| SCENARIO_3 | Highway Merge | — / 50 | — / 50 | — / 50 | — / 50 | — |
| SCENARIO_4 | Dense Market | — / 50 | — / 50 | — / 50 | — / 50 | — |
| SCENARIO_5 | Cattle Crossing | — / 50 | — / 50 | — / 50 | — / 50 | — |
| **POOLED** | **Overall Aggregate** | **— / 250** | **— / 250** | **— / 250** | **— / 250** | **FWER-Corrected** |

Secondary metrics recorded per scenario:
- Minimum clearance distribution (overall min, mean min, 10th percentile).
- Lateral and longitudinal jerk ($L_2$ norm mean $\text{m/s}^3$, max $\text{m/s}^3$).
- Replanning latency (mean ms, p95 ms, max ms).
- MRM activations and recovery counts.

---

## 6. Execution Preconditions & Covenant

1. **No Code Modifications:** No changes to `engine/`, `engine/planners/`, `engine/risk/`, or scenario definitions are permitted prior to or during evaluation.
2. **Deterministic Reproducibility:** Execution script `scripts/evaluate_held_out.py` must run fully headless, recording all raw output traces bit-for-bit into `runs/held_out_manifest.json`.
3. **Execution Gate:** This protocol is strictly **pre-registered**. Execution will occur only upon formal written authorization.

