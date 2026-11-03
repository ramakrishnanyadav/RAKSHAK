# ADAPTIVE-PATH — Authoritative Research Metric Definitions

> **Version**: 1.0.0-draft  
> **Status**: Proposed for Gate G2 Review  
> **Date**: 2026-11-03  
> **Scope**: Authoritative definitions, mathematical formulations, units, denominators, and edge-case handling for all simulation metrics.  
> **Single Source of Truth**: Evaluated engine-side in `engine/evaluation/metrics.py`. Replaces all frontend, pipeline, and script-level metric re-derivations.

---

## 1. Primary Endpoint: Safe-Progress Rate

### Mathematical Formulation
$$\text{Safe-Progress Rate} = \frac{\sum_{i=1}^{N_{\text{launched}}} \mathbb{I}(\text{CollisionFree}_i \land \text{GoalCompleted}_i)}{N_{\text{launched}}}$$

- **Predicate**: A run is successful if and only if **no collision occurred** throughout the entire episode *and* the vehicle satisfied the **Goal Completion Predicate** before episode termination or timeout.
- **Unit**: Percentage ($\%$) or ratio $\in [0.0, 1.0]$.
- **Denominator ($N_{\text{launched}}$)**: Strictly **Intention-To-Treat (ITT)** across all experiment runs launched under the approved SAP protocol (`run_class=experiment`).
- **Edge Cases & Failure Handling**:
  - Timeouts, deadlocks, vehicle spinning out of bounds, controller exceptions, and simulation infrastructure errors count as $\text{Success} = 0$.
  - Interactive or demo runs (`run_class=interactive`) are **excluded** from the denominator.
  - Zero post-hoc exclusions permitted without pre-specified SAP sensitivity definitions.

---

## 2. Core Safety Endpoints

### 2.1 Collision Rate
$$\text{Collision Rate} = \frac{\sum_{i=1}^{N_{\text{launched}}} \mathbb{I}(\exists t \in [0, T] : \text{SAT}(\mathcal{P}_{\text{ego}}(t), \mathcal{P}_{\text{obs}}(t)) = \text{True})}{N_{\text{launched}}}$$

- **Definition**: True if the oriented bounding box polygon of the ego vehicle $\mathcal{P}_{\text{ego}}(t)$ intersects any dynamic obstacle polygon $\mathcal{P}_{\text{agent}}(t)$ or static hazard bounding circle/polygon $\mathcal{P}_{\text{static}}$ at any discrete cycle $t_k$.
- **Collision Test**: Separating Axis Theorem (SAT) on 2D convex polygons ([`engine/simulation/vehicle.py:94-118`](file:///c:/Users/Ramakrishna/Downloads/MINI/engine/simulation/vehicle.py#L94-L118)).
- **Unit**: Percentage ($\%$).
- **Edge Cases**:
  - Obstacles clipping road boundary vs colliding with vehicle: only ego-to-obstacle intersections count as collision.
  - Grazing contact with distance $= 0.00\text{ m}$ is classified as a collision.

### 2.2 Minimum Clearance Distance ($d_{\min}$)
$$d_{\min} = \min_{k=1,\dots,K} \min_{j=1,\dots,M} \text{dist}_{\text{poly}}(\mathcal{P}_{\text{ego}}(t_k), \mathcal{P}_{\text{agent}, j}(t_k))$$

- **Definition**: The minimum Euclidean distance between the outer boundaries of the ego bounding polygon and all active obstacles throughout the run.
- **Unit**: Meters ($\text{m}$).
- **Precision**: 3 decimal places (millimeter precision).
- **Edge Cases**:
  - If a collision occurs at any cycle, $d_{\min} \equiv 0.000\text{ m}$.
  - If no obstacles are present throughout the scenario (benign run), $d_{\min} = \text{distance to road boundary}$.

### 2.3 Near-Miss Rate
$$\text{Near-Miss} = \mathbb{I}\left(\neg \text{Collision} \land \left(d_{\min} < d_{\text{near}} \lor \min_k \text{TTC}(t_k) < \text{TTC}_{\text{near}}\right)\right)$$

- **Primary Thresholds**:
  - Distance threshold: $d_{\text{near}} = 1.00\text{ m}$.
  - Time-to-Collision (TTC) threshold: $\text{TTC}_{\text{near}} = 1.20\text{ s}$ along closing trajectory vectors.
- **Pre-specified Sensitivity Analysis Thresholds**:
  - Tight: $d_{\text{near}} = 0.50\text{ m}$, $\text{TTC} = 0.80\text{ s}$.
  - Wide: $d_{\text{near}} = 1.50\text{ m}$, $\text{TTC} = 1.80\text{ s}$.
- **Justification**: In unstructured traffic, vehicles frequently execute lateral passes with clearance between $1.0\text{ m}$ and $2.0\text{ m}$. A distance $< 1.0\text{ m}$ represents critical encroachment into safety margins.

---

## 3. Progress & Efficiency Endpoints

### 3.1 Goal Completion Predicate
$$\text{GoalCompleted} = \mathbb{I}\left(x_{\text{ego}}(t_{\text{end}}) \ge x_{\text{goal}} \land |y_{\text{ego}}(t_{\text{end}})| \le y_{\text{road\_max}} \land \neg \text{Collision} \land t_{\text{end}} \le T_{\max}\right)$$

- **Goal Region**:
  - Longitudinal position: $x_{\text{goal}} = 65.00\text{ m}$.
  - Lateral road bound: $|y_{\text{ego}}| \le 4.70\text{ m}$ (within driveable asphalt + stabilized shoulder).
  - Terminal speed condition: $v(t_{\text{end}}) \ge 0.50\text{ m/s}$ (must cross goal line in motion, unless scenario explicitly terminates at a designated parking stop).
  - Timeout: $T_{\max} = 20.0\text{ s}$ ($200$ frames at $\Delta t = 0.1\text{ s}$).
- **Failure Classification**:
  - If $t_{\text{end}} \ge T_{\max}$ and $x < x_{\text{goal}}$: Marked as **Livelock / Timeout Failure** (`completion = 0`).

### 3.2 Mean Cruising Speed
$$\bar{v} = \frac{1}{K} \sum_{k=1}^K v_{\text{ego}}(t_k)$$

- **Unit**: Meters per second ($\text{m/s}$) and kilometers per hour ($\text{km/h}$, $1\text{ m/s} = 3.6\text{ km/h}$).
- **Edge Cases**:
  - Zero-speed cycles during waiting or deadlock are explicitly included in the mean, directly reflecting traffic efficiency penalties.

### 3.3 Progress Efficiency Ratio ($\eta_{\text{prog}}$)
$$\eta_{\text{prog}} = \frac{x_{\text{ego}}(t_{\text{end}}) - x_{\text{ego}}(0)}{\sum_{k=1}^{K-1} \sqrt{(x_{k+1} - x_k)^2 + (y_{k+1} - y_k)^2}}$$

- **Definition**: The ratio of net forward progress along the road centerline axis to the actual arc-length trajectory traversed by the vehicle.
- **Unit**: Dimensionless ratio $\in [0.0, 1.0]$.
- **Interpretation**: A value near $1.0$ indicates direct forward progress; values $< 0.85$ indicate significant lateral swerving or avoidance detours. Reverse motion ($\Delta x < 0$) penalizes the score.

---

## 4. Ride Comfort & Kinematic Jerk Formulations

### 4.1 Numerical Derivative & Coordinate Frame
Let $(x(t), y(t))$ be vehicle coordinates in the world inertial frame, $\psi(t)$ yaw heading, $v(t)$ forward speed, and $a(t)$ longitudinal acceleration.

- **Longitudinal Acceleration**:
  $$a_k = \frac{v_k - v_{k-1}}{\Delta t}$$
- **Longitudinal Jerk ($j_{\text{long}}$)**:
  $$j_k = \frac{a_k - a_{k-1}}{\Delta t} = \frac{v_k - 2v_{k-1} + v_{k-2}}{(\Delta t)^2}$$
- **Finite Difference Conventions**:
  - Sample interval: $\Delta t = 0.10\text{ s}$ ($10\text{ Hz}$ simulation clock).
  - Initialization: $j_1 = 0.0\text{ m/s}^3, j_2 = 0.0\text{ m/s}^3$ (initial boundary condition).
  - Filtering: Low-pass moving average filter of window $w = 3$ steps ($0.3\text{ s}$) applied to avoid numerical differentiation singularities.

### 4.2 Jerk Summary Statistics

| Metric | Formula | Unit | Scientific Significance |
| :--- | :--- | :---: | :--- |
| **Max Absolute Jerk** | $j_{\max} = \max_{k} |j_k|$ | $\text{m/s}^3$ | Peak transient jerk experienced by occupants during emergency avoidance or braking. |
| **Mean Absolute Jerk** | $\bar{j}_{\text{abs}} = \frac{1}{K} \sum_{k=1}^K |j_k|$ | $\text{m/s}^3$ | Overall ride roughness across the trajectory. |
| **Root-Mean-Square (RMS) Jerk** | $j_{\text{RMS}} = \sqrt{\frac{1}{K} \sum_{k=1}^K j_k^2}$ | $\text{m/s}^3$ | ISO 2631 ride comfort standard energy measure. Heavily penalizes high-jerk bursts. |

---

## 5. Decision & Replan Dynamics Endpoints

### 5.1 First Intervention Time ($t_{\text{int}}$)
$$t_{\text{int}} = \min \{t_k : \text{ReplanTriggered}(t_k) = \text{True} \land \text{Reason}(t_k) \neq \text{PERIODIC}\}$$

- **Definition**: The elapsed simulation time from episode start until the planner first triggers an event-driven avoidance manoeuvre or risk-mitigating replan.
- **Unit**: Seconds ($\text{s}$).
- **Comparison**: Evaluates anticipation capability (e.g., P3 triggering at $t=0.70\text{ s}$ on conformal violation vs B1 reacting at $t=2.30\text{ s}$ on velocity obstacle encroachment).

### 5.2 Minimal-Risk Manoeuvre (MRM) Activation & Recovery
- **Activation Predicate**:
  $$\text{MRM\_Active}(t_k) = \mathbb{I}(\text{State}(t_k) = \text{"EMERGENCY\_BRAKE"} \lor \text{State}(t_k) = \text{"MRM\_FALLBACK"})$$
- **MRM Activation Count**: Number of transitions from nominal state into MRM state.
- **MRM Duration**: Cumulative time spent in MRM: $T_{\text{MRM}} = \sum \mathbb{I}(\text{MRM\_Active}) \cdot \Delta t$.
- **Recovery Rate**: Percentage of runs that entered MRM and successfully transitioned back to nominal forward cruise after obstacle cleared.

### 5.3 Planner Computational Latency
- Measured per cycle around the core `planner.step()` call:
  - **Mean Latency ($\bar{\tau}_{\text{plan}}$)**: Average execution time across cycles (ms).
  - **95th Percentile Latency ($\tau_{P95}$)**: P95 tail latency across cycles (ms).
- Real-time Deadline: $\tau_{P95} \le 50.0\text{ ms}$ ($\le 50\%$ of the $100\text{ ms}$ simulation cycle).

---

## 6. Authoritative Metric Governance Rules

1. **Zero UI Metric Computation**: Studio client components must strictly format and render values returned in the `apath-log/v1` document or `/api/runs/{id}` response. No multiplication, fallback estimation, or synthetic defaults permitted.
2. **Missing Value Policy**: Any metric that cannot be computed (e.g. $t_{\text{int}}$ on a run with zero non-periodic replans) must be serialized as `null` / `None` and rendered in the UI as `n/a` with an explanatory tooltip (e.g., *"No non-periodic replan triggered"*).
3. **Legacy Output Tagging**: Any previously generated historical log file lacking verified metric fields must be served with badge `legacy/unverified`.
