# Pre-Registration Specification: ADAPTIVE-PATH Research Validation

**Document Version**: 1.0.0 (Pre-Registered Prior to Frozen-Test Execution)  
**Date of Parameter Freeze**: 2026-10-14T00:00:00Z  
**Cost Weights SHA-256**: `b516b378dda8ba077b632c4e450349a11b524ccfb249025c6569bbac74df2b85`  
**Protocol SHA-256**: `9339fb679163864421d5823606468051d89bacd6a995b78792b7314ca02765d5`  

---

## 1. Pre-Registered Hypotheses (H1 – H4)

### Hypothesis H1: Collision Avoidance Superiority
- **Hypothesis**: Risk-adaptive replanning (P3) achieves a statistically significantly lower collision rate than reactive baselines (B1) and nominal predictive planners (P1) on unobserved frozen-test scenario variants.
- **Statistical Test**: McNemar paired exact test (two-sided, $\alpha = 0.05$).
- **Success Criteria**: $p < 0.05$ after FDR multiple comparisons correction; Odds Ratio $> 2.0$.

### Hypothesis H2: Safe Distance & Clearance Margin
- **Hypothesis**: P3 maintains a statistically significantly larger minimum clearance margin ($d_{\min}$) to uncoordinated obstacles than B0, B1, and B2.
- **Statistical Test**: Wilcoxon signed-rank paired test (two-sided, $\alpha = 0.05$) with Rank-Biserial correlation ($r$) and paired Cohen's $d$.
- **Success Criteria**: $p < 0.05$ after FDR correction; Rank-Biserial $r > 0.30$.

### Hypothesis H3: Smoothness & Passenger Comfort
- **Hypothesis**: Adaptive anticipatory replanning in P3 avoids abrupt emergency braking transients, achieving significantly lower maximum jerk ($\text{max\_jerk}$) than reactive emergency braking (B1).
- **Statistical Test**: Wilcoxon signed-rank paired test (one-sided: P3 < B1, $\alpha = 0.05$).
- **Success Criteria**: $p < 0.05$ after FDR correction; mean $\Delta_{\text{jerk}} > 1.0\text{ m/s}^3$.

### Hypothesis H4: Computational Real-Time Feasibility
- **Hypothesis**: The 95th percentile planning latency ($P95_{\text{latency}}$) of P3 remains strictly under the $20.0\text{ ms}$ real-time automotive control budget with up to 60 concurrent agents.
- **Success Criteria**: $P95 \le 20.0\text{ ms}$ logged across all test planning cycles.

---

## 2. Experimental Design & Seed Protocol

- **Dataset Splits**:
  - `tune`: Seeds 1000 – 1009 ($N=10$ per variant; hyper-parameter selection).
  - `validate`: Seeds 2000 – 2009 ($N=10$ per variant; model selection & decision rule gate).
  - `frozen_test`: Seeds 3000 – 3029 ($N=30$ matched seeds per variant across 5 scenario families; $150$ total evaluations per planner).
- **Ablation Sequence (Strict Single-Component Removal)**:
  1. `B0`: Static shortest path (zero obstacle avoidance reaction).
  2. `B1`: Shortest path + Reactive avoidance (DWA + Velocity Obstacles).
  3. `B2`: Hybrid A* kinematic global search without uncertainty forecasting.
  4. `P1`: Nominal trajectory forecasting (deterministic CV/CTRA, fixed 1.0s clock).
  5. `P2`: Predictive + Split Conformal Uncertainty Risk Field (fixed clock).
  6. `P3`: Full Adaptive Replanning Trigger + Minimal Risk Maneuver (MRM) fallback.

---

## 3. Strict Accounting Protocol
- **No Silently Dropped Runs**: The denominator of every metric includes all planned test seeds. Crashes or timeouts are tagged as collisions/failures.
- **Multiple Comparisons**: Corrected via Benjamini-Hochberg False Discovery Rate (FDR) and Holm-Bonferroni FWER.
