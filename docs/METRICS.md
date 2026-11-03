# ADAPTIVE-PATH — Authoritative Research Metric Definitions

> **Version**: 2.0.0-draft (Revised for Second Gate G2 Review)  
> **Status**: Proposed / Under G2 Review  
> **Date**: 2026-11-03  
> **Scope**: Authoritative mathematical definitions, units, denominators, discrete temporal sampling bounds, edge-case treatments, and hand-calculated validation test cases for all simulation metrics.  
> **Single Source of Truth**: Evaluated strictly engine-side. Replaces all frontend, API pipeline, and external script metric re-derivations.

---

## 1. Primary Endpoint: Safe-Progress Rate

### 1.1 Mathematical Formulation
$$\text{Safe-Progress Rate} = \frac{\sum_{i=1}^{N_{\text{launched}}} \mathbb{I}(\text{CollisionFree}_i \land \text{GoalCompleted}_i)}{N_{\text{launched}}}$$

- **Composite Predicate**: An episode $i$ is scored as a success ($Y_{\text{SP}, i} = 1$) if and only if:
  1. No collision occurred between the ego vehicle and any obstacle or road hazard at any cycle throughout the episode ($\text{CollisionFree}_i = \text{True}$).
  2. The vehicle satisfied the **Goal Completion Predicate** before episode termination or timeout ($\text{GoalCompleted}_i = \text{True}$).
- **Unit**: Dimensionless proportion $\in [0.0, 1.0]$ or percentage ($\%$).
- **Denominator ($N_{\text{launched}}$)**: Strictly **Intention-To-Treat (ITT)** across all experiment episodes initiated under the approved SAP protocol (`run_class=experiment`).
- **Incomplete Runs & Infrastructure Failures**:
  - Timeouts ($T > 20.0\text{ s}$), vehicle livelocks, out-of-bounds trajectory terminations, controller exceptions, and simulation infrastructure aborts are treated as **failures** ($Y_{\text{SP}, i} = 0$).
  - Zero post-hoc exclusions are permitted in the primary ITT denominator.
  - Interactive/demo runs (`run_class=interactive`) are tracked separately and excluded from research denominators.

---

## 2. Core Safety Endpoints

### 2.1 Collision Detection across the Complete Trajectory

#### Discrete-Time Collision Evaluation
At each simulation discrete cycle $t_k = k \cdot \Delta t$ (with nominal $\Delta t = 0.10\text{ s}$):
$$\text{Collision}(t_k) = \exists j \in \{1, \dots, M\} : \text{SAT}\Big(\mathcal{P}_{\text{ego}}(t_k), \mathcal{P}_{\text{obs}, j}(t_k)\Big) = \text{True}$$

- $\mathcal{P}_{\text{ego}}(t_k)$: Oriented 2D convex bounding polygon of the ego vehicle (length $4.20\text{ m}$, width $1.80\text{ m}$, centered at pose $(x_k, y_k, \psi_k)$).
- $\mathcal{P}_{\text{obs}, j}(t_k)$: Oriented bounding polygon of dynamic agent $j$ or static hazard circle/polygon.
- $\text{SAT}(\cdot, \cdot)$: Separating Axis Theorem on convex polygons. Returns `True` if polygons overlap along all projection axes; returns `False` if at least one separating axis exists.

#### Temporal Sampling Limitations & Swept-Volume Bound
- **Discrete Sampling Limitation (Tunneling)**: Discrete-time collision checking samples positions at interval $\Delta t = 0.10\text{ s}$. If an obstacle is narrow and relative velocity $v_{\text{rel}}$ is high, an obstacle could theoretically pass through the vehicle between time steps without triggering discrete SAT intersection.
- **Inter-Sample Displacement Bound**:
  $$\Delta s_{\text{inter}} = \|\mathbf{v}_{\text{rel}}\| \cdot \Delta t$$
  - At closing speed $v_{\text{rel}} = 10.0\text{ m/s}$ ($36\text{ km/h}$) and $\Delta t = 0.10\text{ s}$, $\Delta s_{\text{inter}} = 1.00\text{ m}$.
  - At high closing speed $v_{\text{rel}} = 20.0\text{ m/s}$ ($72\text{ km/h}$), $\Delta s_{\text{inter}} = 2.00\text{ m}$.
- **Analytical Protection**: Because the ego vehicle length is $L_{\text{ego}} = 4.20\text{ m}$ and dynamic obstacle lengths in the scenarios exceed $1.20\text{ m}$ (pedestrian depth $\approx 0.50\text{ m}$, two-wheeler $\approx 1.80\text{ m}$, cattle $\approx 2.20\text{ m}$), the sum of bounding radii along the relative motion axis ($R_{\text{ego}} + R_{\text{obs}} \approx 2.5\text{--}3.5\text{ m}$) strictly exceeds the maximum step displacement $\Delta s_{\text{inter}} \le 2.00\text{ m}$ across all scenario operational speed limits ($v_{\max} \le 12.0\text{ m/s}$).
- **Continuous Swept-Volume Approximation**: For validation, consecutive polygons $\mathcal{P}(t_{k-1})$ and $\mathcal{P}(t_k)$ can be enveloped by their convex hull $\text{ConvHull}(\mathcal{P}_k, \mathcal{P}_{k-1})$. In the current reference engine, discrete SAT at $10\text{ Hz}$ is the authoritative implementation, with the inter-sample tunneling boundary explicitly documented as a limitation for closing speeds $v_{\text{rel}} > 25\text{ m/s}$.

---

### 2.2 Minimum Clearance Distance ($d_{\min}$)

$$d_{\min} = \min_{k=1,\dots,K} \min_{j=1,\dots,M} \text{dist}_{\text{poly}}\Big(\mathcal{P}_{\text{ego}}(t_k), \mathcal{P}_{\text{obs}, j}(t_k)\Big)$$

- **Clearance Measurement**: The minimum Euclidean distance between the outer polygon boundaries (point-to-segment distance across all vertices and edges of both polygons):
  $$\text{dist}_{\text{poly}}(\mathcal{P}_A, \mathcal{P}_B) = \min_{\mathbf{p}_A \in \partial \mathcal{P}_A, \mathbf{p}_B \in \partial \mathcal{P}_B} \|\mathbf{p}_A - \mathbf{p}_B\|_2$$
- **Unit**: Meters ($\text{m}$), rounded to 3 decimal places ($1\text{ mm}$ precision).
- **Edge Cases**:
  - If $\text{Collision}(t_k) = \text{True}$ at any step, $d_{\min} \equiv 0.000\text{ m}$.
  - If a scenario contains zero dynamic obstacles, $d_{\min}$ is measured to the driveable road boundary edge ($y = \pm 4.70\text{ m}$).

---

### 2.3 Time-to-Collision (TTC) & Near-Miss Formulation

#### Relative Kinematics & Closing Rate
Let $\mathbf{p}_{\text{ego}}, \mathbf{p}_{\text{obs}} \in \mathbb{R}^2$ be the centers of the ego vehicle and obstacle, with velocity vectors $\mathbf{v}_{\text{ego}}, \mathbf{v}_{\text{obs}}$.
- **Relative displacement vector**: $\mathbf{r} = \mathbf{p}_{\text{obs}} - \mathbf{p}_{\text{ego}}$
- **Euclidean range**: $r = \|\mathbf{r}\|_2$
- **Relative velocity vector**: $\mathbf{v}_{\text{rel}} = \mathbf{v}_{\text{ego}} - \mathbf{v}_{\text{obs}}$
- **Range rate (closing speed)**:
  $$\dot{r} = -\frac{\mathbf{r} \cdot \mathbf{v}_{\text{rel}}}{r} = -\frac{(x_{\text{obs}} - x_{\text{ego}})(v_{x, \text{ego}} - v_{x, \text{obs}}) + (y_{\text{obs}} - y_{\text{ego}})(v_{y, \text{ego}} - v_{y, \text{obs}})}{r}$$

#### Formal TTC Definition
$$\text{TTC}(t_k) = \begin{cases}
\frac{\max\Big(0.0, r(t_k) - R_{\text{bounding, ego}} - R_{\text{bounding, obs}}\Big)}{\dot{r}(t_k)} & \text{if } \dot{r}(t_k) > 0 \\
+\infty \quad (\text{represented as } \texttt{null} \text{ with } \texttt{is\_closing=False}) & \text{if } \dot{r}(t_k) \le 0
\end{cases}$$

- **Non-Closing Objects**: When objects are stationary relative to each other ($\dot{r} = 0$), diverging ($\dot{r} < 0$), or moving on parallel non-converging paths, $\text{TTC}$ is formally undefined (infinite). It is serialized as `null` with flag `is_closing = False`. It is **never** assigned an arbitrary numerical default (e.g., $99.0\text{ s}$).

#### Near-Miss Predicate
$$\text{NearMiss}_i = \mathbb{I}\left(\text{CollisionFree}_i \land \left(d_{\min} < d_{\text{near}} \lor \min_{k: \dot{r}_k > 0} \text{TTC}(t_k) < \text{TTC}_{\text{near}}\right)\right)$$

- **Authoritative Primary Thresholds**:
  - Distance: $d_{\text{near}} = 1.00\text{ m}$.
  - TTC: $\text{TTC}_{\text{near}} = 1.20\text{ s}$.
- **Pre-Specified Sensitivity Analysis Thresholds**:
  - Tight safety envelope: $d_{\text{near}} = 0.50\text{ m}$, $\text{TTC}_{\text{near}} = 0.80\text{ s}$.
  - Wide safety envelope: $d_{\text{near}} = 1.50\text{ m}$, $\text{TTC}_{\text{near}} = 1.80\text{ s}$.
- **Justification**: In non-lane Indian traffic, lateral passing clearances between $1.0\text{ m}$ and $2.0\text{ m}$ represent standard assertive maneuvers. A clearance $< 1.0\text{ m}$ or closing TTC $< 1.2\text{ s}$ encroaches into safety reaction margins.

---

## 3. Progress & Efficiency Endpoints

### 3.1 Goal Completion Predicate & Terminal State Evaluation

#### Coordinate Frame Conventions
- **Global Inertial Frame ($X, Y$)**:
  - $X$: Longitudinal road centerline axis directed eastward ($X \ge 0$, meters).
  - $Y$: Lateral displacement orthogonal to centerline (northward positive, meters). Centerline corresponds to $Y = 0.00\text{ m}$.
  - Ego vehicle start pose: $(X_0, Y_0, \psi_0) = (0.00, 0.00, 0.00)$.

#### Goal Predicate Formulation
$$\text{GoalCompleted}_i = \mathbb{I}\left(x_{\text{ego}}(t_{\text{term}}) \ge X_{\text{goal}} \land |y_{\text{ego}}(t_{\text{term}})| \le Y_{\text{bound}} \land \text{CollisionFree}_i \land t_{\text{term}} \le T_{\max} \land v_{\text{term}} \ge v_{\min\_term}\right)$$

- **Parameters**:
  - Longitudinal goal line: $X_{\text{goal}} = 65.00\text{ m}$.
  - Lateral road bound: $Y_{\text{bound}} = 4.70\text{ m}$ (outer shoulder limit).
  - Terminal speed floor: $v_{\min\_term} = 0.50\text{ m/s}$ (ensures vehicle crosses the finish line in motion; prevents scoring a vehicle that stalled right at the threshold).
  - Episode timeout: $T_{\max} = 20.00\text{ s}$ ($200$ cycles at $\Delta t = 0.1\text{ s}$).
- **Failure Classification for Incomplete Runs**:
  - **Collision Failure**:SAT overlap occurs at any step. Episode halts immediately.
  - **Livelock / Deadlock**: $t_{\text{term}} \ge T_{\max}$ and $x_{\text{ego}} < X_{\text{goal}}$ while vehicle speed remains $v < 0.20\text{ m/s}$ for $\ge 3.0\text{ s}$.
  - **Off-Road Failure**: $|y_{\text{ego}}(t)| > 4.70\text{ m}$ (lateral departure beyond unpaved shoulder into ditch).
  - **Timeout Failure**: $t_{\text{term}} \ge T_{\max}$ without crossing $X_{\text{goal}}$.

### 3.2 Progress Efficiency Ratio ($\eta_{\text{prog}}$)

$$\eta_{\text{prog}} = \frac{x_{\text{ego}}(t_{\text{term}}) - x_{\text{ego}}(0)}{\sum_{k=1}^{K-1} \sqrt{(x_{k+1} - x_k)^2 + (y_{k+1} - y_k)^2}}$$

- **Definition**: Ratio of net displacement along the road axis to the total Euclidean arc-length traversed by the vehicle CG.
- **Unit**: Dimensionless ratio $\in [0.0, 1.0]$.
- **Edge Cases**:
  - Reverse motion ($\Delta x < 0$) increases arc-length in the denominator without increasing the numerator, strictly penalizing progress efficiency.
  - If a vehicle halts at $x = 0$, $\eta_{\text{prog}} \equiv 0.000$.

---

## 4. Ride Comfort: Variable-Timestep Jerk Formulations

> **Scientific Boundary**: Jerk metrics quantify kinematic smoothness and dynamic abruptness. They serve as engineering proxies for passenger ride comfort in automated vehicle literature. They **do not** claim full compliance with or certification under ISO 2631-1 (whole-body vibration), which requires tri-axial frequency-weighted accelerations measured at the seat-occupant interface.

### 4.1 Variable-Timestep Numerical Differentiation
Let $t_k$ be discrete time stamps with variable step $\Delta t_k = t_k - t_{k-1} > 0$. Let $v_k$ be forward longitudinal speed.

#### Step 1: Raw Acceleration Calculation
$$a_k = \frac{v_k - v_{k-1}}{\Delta t_k} \quad \text{for } k \ge 1$$

#### Step 2: Causal Low-Pass Smoothing
To prevent amplification of high-frequency numerical quantization noise, a causal moving average filter of window $M = 3$ is applied to acceleration:
$$a_{k, \text{filt}} = \frac{1}{\min(k, M)} \sum_{m=0}^{\min(k-1, M-1)} a_{k-m}$$

#### Step 3: Variable-Timestep Jerk Calculation
The filtered longitudinal jerk $j_k$ at step $k \ge 2$ across non-uniform intervals is computed as:
$$j_k = \frac{a_{k, \text{filt}} - a_{k-1, \text{filt}}}{\frac{1}{2}(\Delta t_k + \Delta t_{k-1})} = 2 \cdot \frac{a_{k, \text{filt}} - a_{k-1, \text{filt}}}{\Delta t_k + \Delta t_{k-1}}$$

For constant $\Delta t_k = \Delta t = 0.10\text{ s}$, this reduces to the classical second-order difference:
$$j_k = \frac{a_{k, \text{filt}} - a_{k-1, \text{filt}}}{\Delta t}$$

#### Step 4: Vector Jerk (Longitudinal & Lateral)
When lateral acceleration $a_{y, k} = v_k^2 \cdot \kappa_k$ is present (with path curvature $\kappa$):
$$j_{y, k} = \frac{a_{y, k, \text{filt}} - a_{y, k-1, \text{filt}}}{\frac{1}{2}(\Delta t_k + \Delta t_{k-1})}$$
$$\|j_k\| = \sqrt{j_{x, k}^2 + j_{y, k}^2}$$

### 4.2 Initial-Sample Treatment & Incomplete-Run Handling
- **Boundary Samples**:
  - Step $k = 0$: Pose and speed only; acceleration and jerk are undefined.
  - Step $k = 1$: First acceleration sample $a_1$ computed; jerk is undefined.
  - Step $k = 2$: First valid jerk sample $j_2$ evaluated.
- **Summation Denominator**:
  - Boundary steps $k \in \{0, 1\}$ are **strictly excluded** from mean and RMS summations.
  - Valid sample count is $N_{\text{jerk}} = K_{\text{frames}} - 2$.
- **Incomplete Runs**:
  - If a run terminates early at step $K_{\text{term}} \ge 3$, jerk is computed over the available $K_{\text{term}} - 2$ valid steps.
  - If $K_{\text{term}} < 3$, jerk is mathematically undefined and reported as `null` with reason code `INSUFFICIENT_SAMPLES`.

### 4.3 Summary Jerk Metrics

| Metric | Mathematical Expression | Unit | Physical Interpretation |
| :--- | :--- | :---: | :--- |
| **Max Absolute Jerk** | $j_{\max} = \max_{k=2,\dots,K} |j_k|$ | $\text{m/s}^3$ | Peak transient jerk (emergency braking or sudden evasive swerve). |
| **Mean Absolute Jerk** | $\bar{j}_{\text{abs}} = \frac{1}{N_{\text{jerk}}} \sum_{k=2}^K |j_k|$ | $\text{m/s}^3$ | Trajectory-wide average kinematic roughness. |
| **Root-Mean-Square (RMS) Jerk** | $j_{\text{RMS}} = \sqrt{\frac{1}{N_{\text{jerk}}} \sum_{k=2}^K j_k^2}$ | $\text{m/s}^3$ | Quadratic energy penalty highlighting high-jerk bursts. |

---

## 5. Hand-Calculated Mathematical Test Cases

To verify algorithmic implementations, the following exact test cases must be satisfied by unit tests:

### Test Case 1: Variable-Timestep Jerk Calculation
- **Inputs**:
  - $t_0 = 0.00\text{ s}, v_0 = 10.00\text{ m/s}$
  - $t_1 = 0.10\text{ s}, v_1 = 9.80\text{ m/s}$ ($\Delta t_1 = 0.10\text{ s}$)
  - $t_2 = 0.25\text{ s}, v_2 = 9.20\text{ m/s}$ ($\Delta t_2 = 0.15\text{ s}$)
- **Raw Accelerations**:
  - $a_1 = \frac{9.80 - 10.00}{0.10} = -2.000\text{ m/s}^2$
  - $a_2 = \frac{9.20 - 9.80}{0.15} = -4.000\text{ m/s}^2$
- **Jerk $j_2$ (Unfiltered)**:
  - Interval denominator: $\frac{1}{2}(\Delta t_1 + \Delta t_2) = \frac{0.10 + 0.15}{2} = 0.125\text{ s}$
  - $j_2 = \frac{-4.000 - (-2.000)}{0.125} = \frac{-2.000}{0.125} = \mathbf{-16.000\text{ m/s}^3}$
  - $|j_2| = 16.000\text{ m/s}^3$

### Test Case 2: Time-to-Collision (Closing vs. Diverging)
- **Scenario A (Closing)**:
  - Ego: $\mathbf{p}_e = (10.0, 0.0)\text{ m}, \mathbf{v}_e = (8.0, 0.0)\text{ m/s}, R_e = 2.1\text{ m}$
  - Cow: $\mathbf{p}_o = (25.0, 0.0)\text{ m}, \mathbf{v}_o = (0.0, 0.0)\text{ m/s}, R_o = 1.1\text{ m}$
  - Displacement $\mathbf{r} = (15.0, 0.0)$, $r = 15.0\text{ m}$
  - Closing speed: $\dot{r} = -\frac{(15.0)(8.0 - 0.0)}{15.0} = 8.0\text{ m/s} > 0$ (Closing)
  - Net clearance: $r_{\text{clear}} = 15.0 - 2.1 - 1.1 = 11.8\text{ m}$
  - $\text{TTC} = \frac{11.8}{8.0} = \mathbf{1.475\text{ s}}$
- **Scenario B (Diverging)**:
  - Ego: $\mathbf{p}_e = (10.0, 0.0)\text{ m}, \mathbf{v}_e = (4.0, 0.0)\text{ m/s}$
  - Lead Car: $\mathbf{p}_o = (25.0, 0.0)\text{ m}, \mathbf{v}_o = (7.0, 0.0)\text{ m/s}$
  - Closing speed: $\dot{r} = -\frac{(15.0)(4.0 - 7.0)}{15.0} = -3.0\text{ m/s} < 0$ (Diverging)
  - $\text{TTC} \equiv \mathbf{null}$ (`is_closing = False`).
