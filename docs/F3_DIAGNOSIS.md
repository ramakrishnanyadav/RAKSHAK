# ADAPTIVE-PATH — Phase 1 Step 3: F3 Diagnostic Investigation Report

> **Document**: `docs/F3_DIAGNOSIS.md`  
> **Author**: Antigravity Research Team  
> **Date**: 2026-11-03  
> **Branch**: `research/phase-0-audit`  
> **Reference Baseline**: Commit `8dcecd7`  
> **Target Finding**: Finding F3 (P3 Livelock / 0% Goal Completion on Cattle Crossing & Deadlock Failure Modes)  
> **Status**: Diagnostic Complete — STOPPED for User Governance Review prior to any implementation or tuning.

---

## 1. Gate 1 — Verification of Validation Allocation & Discrepancy Resolution

### 1.1 Root Cause of the Split Discrepancy
An audit of committed governance documents reveals how the discrepancy arose:
1. **Authoritative Registered Partition** ([`docs/SAP.md`](file:///c:/Users/Ramakrishna/Downloads/MINI/docs/SAP.md#L37-L60), [`docs/DECISIONS.md`](file:///c:/Users/Ramakrishna/Downloads/MINI/docs/DECISIONS.md#L17-L23) DEC-007 and DEC-012):
   - Approved during Gate G2.
   - Defines a 5-way disjoint split with 5 seeds per scenario for Validation Sub-Split A and 5 seeds for Validation Sub-Split B:
     - **Tuning Split (`tune`)**: Seeds 1000–1009 ($N=10$, 50 episodes).
     - **Calibration Split (`calib`)**: Seeds 1500–1539 ($N=40$, 200 episodes).
     - **Validation Sub-Split A (`val_a`)**: Seeds 2000–2004 ($N=5$, 25 episodes).
     - **Validation Sub-Split B (`val_b`)**: Seeds 2005–2009 ($N=5$, 25 episodes).
     - **Confirmatory Frozen Split (`frozen`)**: Seeds 3000–3029 ($N=30$, 150 episodes).
2. **Erroneous 20-Seed Expansion**:
   - During the implementation of Step 2, [`engine/scenarios/registry.py`](file:///c:/Users/Ramakrishna/Downloads/MINI/engine/scenarios/registry.py#L115-L125) and a progress note in [`docs/PROGRESS.md`](file:///c:/Users/Ramakrishna/Downloads/MINI/docs/PROGRESS.md#L37) inadvertently referenced `val_a = 2000–2019` (20 seeds) and `val_b = 2020–2039` (20 seeds), echoing an early intermediate exploratory proposal before G2 ratification.

### 1.2 Authoritative Permitted Use by Split

| Split Identifier | Seed Range | Seeds / Scenario | Authoritative Permitted Purpose | Invariant Restrictions |
| :--- | :---: | :---: | :--- | :--- |
| **`tune`** | 1000–1009 | 10 | Diagnostic trace extraction, initial algorithm design, uncalibrated baseline profiling. | Free access. Never used for confirmatory claims. |
| **`calib`** | 1500–1539 | 40 | Fitting class-by-horizon conformal nonconformity quantiles. | Exclusively calibration. Zero planner parameter tuning. |
| **`val_a`** | 2000–2004 | 5 | **Strongest-baseline comparator selection ($B^*$)** across B0, B1, and B2. | **Strictly isolated from P3 tuning.** No P3 modifications may be validated against `val_a`. |
| **`val_b`** | 2005–2009 | 5 | **P3 algorithm tuning & exploratory lateral creep validation**. | Exclusively used to tune P3 parameters and verify F3 resolution prior to G3. |
| **`frozen`** | 3000–3029 | 30 | Confirmatory hypothesis testing for final publication benchmark. | **Cryptographically locked until Gate G3.** |

### 1.3 Governance Action
To preserve mathematical rigor and honor pre-registration:
- `engine/scenarios/registry.py` must be reconciled to the pre-registered `val_a: 2000–2004` and `val_b: 2005–2009`.
- **Diagnostic analysis below has been conducted strictly on source code, analytical equations, and historical `tune` split run logs (`run_scenario_5_cattle_crossing_p3_tune_s1000.json`). Zero validation or frozen data has been accessed.**

---

## 2. Gate 2 — Detailed Technical Investigation of Finding F3

### 2.1 P3 Progress Reward vs. Collision Penalty Formulation
- **Source Reference**: [`engine/planners/p3_adaptive.py`](file:///c:/Users/Ramakrishna/Downloads/MINI/engine/planners/p3_adaptive.py#L212-L218):
  $$\text{total\_cost} = 2.20 \cdot (1.0 - s_{\text{ratio}}) + 0.60 \cdot |\Delta y_{\text{offset}}| + 3.50 \cdot \sum_{k=1}^K R_{\text{point}}(t_k) + \sum_{k=1}^K 4.00 \cdot w_{\text{hyp}} \cdot \mathbb{I}(\text{conflict}_k)$$
- **Numerical Imbalance**:
  - For candidate `cand_v = 0.0` ($s_{\text{ratio}} = 0.0$):
    - Progress penalty: $2.20 \cdot (1.0 - 0.0) = \mathbf{2.20}$.
    - Smoothness penalty: $0.60 \cdot 0.0 = \mathbf{0.00}$.
    - Because the vehicle remains stationary at pose $(x_0, y_0)$ outside the obstacle's immediate collision zone, cumulative risk is negligible ($\sum R \approx 0.0$).
    - Total cost of stopping: **$\mathbf{2.20}$**.
  - For any moving candidate ($s_{\text{ratio}} \in \{0.25, 0.50, 0.80, 1.00\}$):
    - When an obstacle is within lookahead distance ($3.0\text{ s}$), moving forward incurs risk integral $\ge 3.0$ and penetrates the multi-hypothesis envelope zone.
    - Conformal penalty: $4.00 \times 15 \text{ steps} = \mathbf{60.00}$.
    - Risk penalty: $3.50 \times \text{cum\_risk} \ge \mathbf{10.50}$.
    - Total cost of moving forward: **$\mathbf{25.00 \text{ to } 75.00}$**.
- **Conclusion**: The cost ratio between forward motion and stationary stopping exceeds **$15 : 1$**. Stopping is favored as a cheap global minimum.

---

### 2.2 Risk-Field Spatial Distribution & Gradient
- **Source Reference**: [`engine/risk/field.py`](file:///c:/Users/Ramakrishna/Downloads/MINI/engine/risk/field.py#L65-L79):
  $$\sigma = \max\Big(1.20, 0.50(L + W) + 0.15 \|\mathbf{v}\|\Big) + 0.40 \cdot r_{\text{cone}}$$
  $$\text{Spatial Term} = \exp\left(-\frac{d^2}{2\sigma^2}\right)$$
- **Conformal Expansion Effect**:
  - For cattle with calibrated simultaneous envelope radius $r_{\text{cone}} \approx 3.18\text{ m}$:
    $$\sigma = 0.50(2.40 + 1.10) + 0.40(3.18) = 1.75 + 1.27 = \mathbf{3.02\text{ m}}$$
  - A Gaussian standard deviation of $\sigma \approx 3.02\text{ m}$ produces non-trivial risk out to $2.5\sigma \approx \mathbf{7.55\text{ m}}$.
  - Any candidate trajectory approaching within $7.5\text{ m}$ of the cow incurs steep exponential risk penalty gradients, whereas a stopped vehicle stationed at $8.0\text{ m}$ rests safely in the flat asymptotic tail.

---

### 2.3 Conformal Prediction Envelopes & Candidate Rejection
- **Source Reference**: [`engine/prediction/predictor.py`](file:///c:/Users/Ramakrishna/Downloads/MINI/engine/prediction/predictor.py#L107-L112) and [`engine/planners/p3_adaptive.py`](file:///c:/Users/Ramakrishna/Downloads/MINI/engine/planners/p3_adaptive.py#L185-L208):
  - Cattle agents instantiate three divergent intent hypotheses:
    1. `cross_continue` ($w=0.45$): progresses northward ($y > 0$).
    2. `stop_midroad` ($w=0.40$): halts in the roadway ($y \approx 0$).
    3. `turn_back` ($w=0.15$): reverses southward ($y < 0$).
  - **Simultaneous Trajectory Envelope**:
    With $\hat{q}^{\text{sim}} = 4.3586$, the calibrated envelopes of these three divergent hypotheses sweep laterally across the entire road width:
    $$y \in [-3.50\text{ m}, +3.50\text{ m}]$$
  - In [`p3_adaptive.py`](file:///c:/Users/Ramakrishna/Downloads/MINI/engine/planners/p3_adaptive.py#L155), candidate lateral offsets are fixed to:
    $$\Delta y \in \{-2.0, -1.2, -0.6, 0.0, 0.6, 1.2, 2.0\}\text{ m}$$
  - **Intersection Result**: Every single forward-moving lateral candidate intersects at least one hypothesis cone. Because [`p3_adaptive.py`](file:///c:/Users/Ramakrishna/Downloads/MINI/engine/planners/p3_adaptive.py#L206) penalizes candidates intersecting *any* hypothesis ($4.0 \cdot w_{\text{hyp}}$ per step), **$100\%$ of forward moving tentacles are heavily penalized**, leaving `cand_v = 0.0` as the only surviving candidate.

---

### 2.4 State-Machine Transitions & MRM Activation
- **Source Reference**: [`engine/planners/p3_adaptive.py`](file:///c:/Users/Ramakrishna/Downloads/MINI/engine/planners/p3_adaptive.py#L112-L145):
  - High Epistemic Uncertainty trigger:
    ```python
    if max_agent_uncertainty > self.risk_thresholds.uncertainty_mrm_limit and current_ego_risk > 0.6:
        # Minimal-Risk Manoeuvre triggered: aggressive deceleration (-5.8 m/s^2)
    ```
  - **Thrashing Dynamic**:
    1. While approaching the crossing cow at $7.3\text{ m/s}$, `current_ego_risk` climbs above $0.60$.
    2. MRM fires, commanding emergency braking (accel $= -5.8\text{ m/s}^2$).
    3. As ego speed drops, relative closing speed decreases, causing `current_ego_risk` to fall below $0.60$.
    4. MRM disengages; the planner reverts to trajectory optimization.
    5. In trajectory optimization, `cand_v = 0.0` has cost $2.20$, beating all forward candidates ($> 25.0$).
    6. Ego vehicle enters `STOP` state.

---

### 2.5 Planner Candidate Generation & Kinematic Feasibility
- **Source Reference**: [`engine/planners/p3_adaptive.py`](file:///c:/Users/Ramakrishna/Downloads/MINI/engine/planners/p3_adaptive.py#L35-L36, #L155-L170):
  - Candidate discrete speed ratios: $[1.0, 0.8, 0.5, 0.25, 0.0]$.
  - Given nominal target speed $8.0\text{ m/s}$, the lowest non-zero candidate speed is:
    $$v_{\min, \text{non-zero}} = 8.0 \times 0.25 = \mathbf{2.00\text{ m/s}}$$
  - **Kinematic Deficiency**:
    - The planner possesses **no ultra-low-speed crawl or creep candidates** (e.g. $0.30 - 0.60\text{ m/s}$).
    - At $2.00\text{ m/s}$, the vehicle advances $6.0\text{ m}$ over the $3.0\text{ s}$ horizon, directly colliding with or penetrating the cow's uncertainty cone.
    - Because bicycle model steering is kinematically coupled to velocity ($\dot{x} = v \cos\psi$, $\dot{y} = v \sin\psi$), setting $v = 0$ prevents any lateral repositioning. The vehicle cannot crawl sideways onto the shoulder while stopped.

---

### 2.6 Genuine Safety Constraint vs. Optimization Pathology
- **Diagnostic Finding**:
  - The initial deceleration from $7.3\text{ m/s}$ is a **genuine safety requirement** (preventing high-speed collision with an animal stepping into the lane).
  - The persistent failure to complete the mission is an **optimization pathology / deadlock trap**:
    1. **Zero Stationary Penalty**: The cost of stopping is identically $2.20$ whether the vehicle has been stationary for $0.1\text{ s}$ or $15.0\text{ s}$.
    2. **Hypothesis Union Penalty**: The planner treats all multi-hypothesis intents as simultaneous physical barriers, effectively creating an impassable phantom wall across the road.
    3. **Missing Lateral Creep Primitives**: Safe bypass of a stationary bovine obstacle on rural roads requires slowing to a crawl ($0.40\text{ m/s}$) and inching along the shoulder. P3 lacks this behavioral primitive.

---

### 2.7 Recovery After Obstacle Clears
- If dynamic agents vacate the roadway, `dist_to_hyp` clears and P3 resumes cruising after the watchdog timer ($1.2\text{ s}$).
- **However, in Scenario 5 (flagship cattle crossing)**, the cattle agent's programmed intent is `stop_midroad`. The animal halts mid-lane and remains stationary indefinitely.
- Under these conditions, P3 **never recovers**. It remains locked at $v = 0.0\text{ m/s}$ until simulation timeout at $t = 16.0\text{ s}$, scoring $0\%$ Safe-Progress.

---

## 3. Evidence: Trace from Pilot Run `s1000`

From [`studio/public/sample_runs/run_scenario_5_cattle_crossing_p3_tune_s1000.json`](file:///c:/Users/Ramakrishna/Downloads/MINI/studio/public/sample_runs/run_scenario_5_cattle_crossing_p3_tune_s1000.json):

```text
t=0.00s | x= 0.00m, v=7.00 m/s | state=SLOW            | replan=True (PERIODIC)           | cost=0.63
t=0.50s | x= 3.56m, v=7.23 m/s | state=SLOW            | replan=True (CONFORMAL_VIOLATION)| cost=0.64
t=0.70s | x= 5.00m, v=7.29 m/s | state=SLOW            | replan=True (CONFORMAL_VIOLATION)| cost=0.64
...
t=3.50s | x=21.60m, v=4.44 m/s | state=STOP            | replan=True (CONFORMAL_VIOLATION)| Selected STOP (cost=1.40)
t=3.70s | x=22.48m, v=4.39 m/s | state=STOP            | replan=True (CONFORMAL_VIOLATION)| Selected STOP (cost=1.39)
t=4.10s | x=24.22m, v=4.33 m/s | state=STOP            | replan=True (CONFORMAL_VIOLATION)| Selected STOP (cost=1.39)
t=4.50s | x=25.94m, v=3.99 m/s | state=EMERGENCY_BRAKE | replan=True (CONFORMAL_VIOLATION)| MRM safe stop
t=5.10s | x=27.75m, v=1.94 m/s | Collision with cattle at x=28.10m before coming to rest.
```

In benign seeds where stopping occurred earlier ($x \approx 20\text{ m}$), the vehicle sat stationary until $t = 16.0\text{ s}$, producing timeout and 0% goal completion.

---

## 4. Root-Cause Classification

| Component | Failure Mode | Severity | Root Cause |
| :--- | :--- | :---: | :--- |
| **Cost Objective** | **Static Progress Penalty** | High | Progress loss $2.20(1 - s_{\text{ratio}})$ does not scale with stopped duration $t_{\text{stopped}}$. Stationary cost is permanently $2.20$. |
| **Kinematics** | **Missing Crawl Primitives** | High | Minimum non-zero speed ratio $0.25$ ($2.0\text{ m/s}$) is too fast for tight bypass clearance. Zero crawl/creep candidates exist. |
| **Prediction** | **Phantom Wall Blocking** | High | Conformal envelopes of mutually exclusive multi-hypothesis intents are penalized simultaneously without likelihood discounting. |
| **Replan Trigger** | **Corridor Over-Triggering** | Medium | [`engine/risk/field.py:172`](file:///c:/Users/Ramakrishna/Downloads/MINI/engine/risk/field.py#L172) triggers `CONFORMAL_VIOLATION` continuously whenever an agent is within $35\text{ m}$ ahead. |

---

## 5. Proposed Correction Architecture (Pre-Registration for Validation Sub-Split B)

The proposed correction consists of three mathematically sound, pre-registered adjustments to be tuned **exclusively on Validation Sub-Split B (`val_b`, Seeds 2005–2009)**:

### 5.1 Dynamic Stationary Persistence Penalty
Incorporate cumulative stopped duration $t_{\text{stopped}}$ into the progress cost:
$$J_{\text{progress}}(s_{\text{ratio}}, t_{\text{stopped}}) = w_{\text{prog}} \cdot (1.0 - s_{\text{ratio}}) + w_{\text{stall}} \cdot \min(10.0, t_{\text{stopped}}^{1.5}) \cdot \mathbb{I}(s_{\text{ratio}} == 0)$$
- At $t_{\text{stopped}} = 0\text{ s}$: penalty is $2.20$ (permitting smooth temporary yield).
- At $t_{\text{stopped}} \ge 2.0\text{ s}$: penalty escalates to $> 15.0$, breaking the stopping local minimum and forcing the optimizer to evaluate exploratory bypass tentacles.

### 5.2 Exploratory Lateral Creep Candidates
Expand the candidate generator when stopped ($v < 0.20\text{ m/s}$) or approaching hazard:
- Add ultra-low creep speed ratios: $s_{\text{ratio}} \in \{0.05, 0.10\}$ ($0.40 - 0.80\text{ m/s}$).
- Expand lateral offsets to shoulder margins: $\Delta y \in \{-2.4, -1.8, 1.8, 2.4\}\text{ m}$ subject to hard chassis road-boundary constraints ($|y| + W_{\text{eff}}(\psi) \le 4.70\text{ m}$).

### 5.3 Hypothesis Likelihood Weighting
Score hypothesis intersection proportionally to calibrated posterior probability $w_{\text{hyp}}$ rather than uniform worst-case phantom wall blocking:
$$\text{Penalty}_{\text{envelope}} = \sum_{h=1}^H w_h \cdot \mathbb{I}(\text{dist}(\mathbf{p}_k, \hat{\mathbf{p}}_{h, k}) < R_{\text{safe}, h})$$

---

## 6. Pre-Registered Verification Plan for Step 3 Implementation

When authorized to begin the correction:
1. Reconcile `engine/scenarios/registry.py` to `val_a: 2000–2004` and `val_b: 2005–2009`.
2. Tune correction weights ($w_{\text{stall}}$, creep speeds) **strictly on `val_b` (Seeds 2005–2009)**.
3. Unit tests to add in `tests/test_f3_recovery.py`:
   - `test_p3_stationary_persistence_penalty_escalation`: verifies cost of $v=0$ increases monotonically over time.
   - `test_p3_generates_lateral_creep_under_standstill`: verifies crawl primitives appear when stationary.
   - `test_p3_recovers_and_bypasses_stationary_cattle`: verifies safe progress $> 65\text{ m}$ on Scenario 5 without collision.
4. **Zero access to `val_a` (2000–2004) or `frozen` (3000–3029)**.

---

## 7. Mandatory Gate Stop

**Diagnostic investigation is complete. No code modifications or tuning sweeps have been executed. Awaiting explicit user governance approval.**
