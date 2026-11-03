# ADAPTIVE-PATH — Authoritative Research Metric Definitions

> **Version**: 2.2.0-draft (Final G2 Patch — Scientific & Kinematic Precision)  
> **Status**: Proposed / Under Final G2 Review  
> **Date**: 2026-11-03  
> **Scope**: Authoritative mathematical definitions, units, denominators, discrete temporal sampling bounds, variable-timestep derivatives, exact 2D collision kinematics, edge-case treatments, and step-by-step reproducible test cases for all simulation metrics.  
> **Single Source of Truth**: Evaluated strictly engine-side. Replaces all frontend, API pipeline, and external script metric re-derivations.

---

## 1. Primary Endpoint: Safe-Progress Rate

### 1.1 Mathematical Formulation
$$\text{Safe-Progress Rate} = \frac{\sum_{i=1}^{N_{\text{launched}}} \mathbb{I}(\text{CollisionFree}_i \land \text{GoalCompleted}_i)}{N_{\text{launched}}}$$

- **Composite Predicate**: An episode $i$ is scored as a success ($Y_{\text{SP}, i} = 1$) if and only if:
  1. No collision occurred between the ego vehicle and any obstacle or road boundary at any discrete cycle throughout the episode ($\text{CollisionFree}_i = \text{True}$).
  2. The vehicle satisfied the **Goal Completion Predicate** before episode termination or timeout ($\text{GoalCompleted}_i = \text{True}$).
- **Unit**: Dimensionless proportion $\in [0.0, 1.0]$ or percentage ($\%$).
- **Denominator ($N_{\text{launched}}$)**: Strictly **Intention-To-Treat (ITT)** across all experiment episodes initiated under the approved SAP protocol (`run_class = "experiment"`).
- **Incomplete Runs & Infrastructure Failures**:
  - Timeouts ($T > 20.0\text{ s}$), vehicle livelocks, out-of-bounds trajectory terminations, controller exceptions, and simulation infrastructure aborts are treated as **failures** ($Y_{\text{SP}, i} = 0$).
  - Zero post-hoc exclusions are permitted in the primary ITT denominator.
  - Interactive/demo runs (`run_class = "interactive"`) are tracked separately and excluded from research denominators.

---

## 2. Core Safety Endpoints

### 2.1 Collision Detection across the Complete Trajectory

#### Discrete-Time Collision Evaluation
At each discrete simulation cycle $t_k = k \cdot \Delta t$ (with nominal $\Delta t = 0.10\text{ s}$):
$$\text{Collision}(t_k) = \exists j \in \{1, \dots, M\} : \text{SAT}\Big(\mathcal{P}_{\text{ego}}(t_k), \mathcal{P}_{\text{obs}, j}(t_k)\Big) = \text{True}$$

- $\mathcal{P}_{\text{ego}}(t_k)$: Oriented 2D convex bounding polygon of the ego vehicle (length $L_{\text{ego}} = 4.20\text{ m}$, width $W_{\text{ego}} = 1.80\text{ m}$, centered at pose $(x_k, y_k, \psi_k)$).
- $\mathcal{P}_{\text{obs}, j}(t_k)$: Oriented bounding polygon of dynamic agent $j$ or static hazard circle/polygon.
- $\text{SAT}(\cdot, \cdot)$: Separating Axis Theorem on convex polygons. Returns `True` if polygons overlap along all projection axes; returns `False` if at least one separating axis exists.

#### Rigorous Analysis of Discrete SAT Tunnelling Limitations
- **Discrete Sampling Mechanics**: Discrete-time collision checking samples positions at finite intervals $\Delta t = 0.10\text{ s}$. Any displacement occurring between $t_{k-1}$ and $t_k$ is unsampled.
- **Maximum Relative Closing Speed ($v_{\text{rel, max}}$)**:
  - Ego vehicle maximum forward speed: $v_{\text{ego, max}} = 12.00\text{ m/s}$ ($43.2\text{ km/h}$).
  - Scenario 1 oncoming heavy truck maximum speed: $v_{\text{truck, max}} = 12.00\text{ m/s}$ ($43.2\text{ km/h}$).
  - Maximum closing speed along collision axis: $v_{\text{rel, max}} = 12.00 + 12.00 = 24.00\text{ m/s}$ ($86.4\text{ km/h}$).
- **Maximum Inter-Sample Displacement**:
  $$\Delta s_{\text{step}} = v_{\text{rel, max}} \cdot \Delta t = 24.00\text{ m/s} \times 0.10\text{ s} = 2.40\text{ m}$$
- **Projected Geometry Overlap Bound**:
  - Longitudinal overlap zone for head-on vehicle encounters:
    $$L_{\text{overlap}} = L_{\text{ego}} + L_{\text{truck}} = 4.20\text{ m} + 7.50\text{ m} = 11.70\text{ m} \gg 2.40\text{ m}$$
    Because $L_{\text{overlap}} > \Delta s_{\text{step}}$, a longitudinal head-on collision cannot tunnel through unobserved.
- **Lateral & Thin-Obstacle Vulnerabilities**:
  - For narrow lateral cross-cutting obstacles (e.g. crossing pedestrian of thickness $W_{\text{ped}} \approx 0.40\text{ m}$ moving at $v_{\text{ped}} = 2.0\text{ m/s}$ across a highway at acute angles):
    If the relative approach angle $\theta$ is steep, the projected intersection chord $L_{\text{chord}} = \frac{W_{\text{ped}}}{\sin \theta}$ can fall below $\Delta s_{\text{step}} = 2.40\text{ m}$.
  - Under such corner-case relative trajectories, an obstacle could enter and exit the swept path between $t_{k-1}$ and $t_k$ without triggering discrete SAT intersection.
- **Continuous / Swept Collision Detection (Documented Limitation & Improvement)**:
  - *Current Implementation*: Discrete SAT collision checking at $10\text{ Hz}$ ($\Delta t = 0.10\text{ s}$).
  - *Documented Limitation*: High-speed lateral cut-ins with projected chord $< 2.40\text{ m}$ are subject to discrete sampling tunneling error.
  - *Future Enhancement*: Implementation of continuous swept-volume polygon collision checking using the convex hull $\text{ConvHull}\Big(\mathcal{P}(t_{k-1}), \mathcal{P}(t_k)\Big)$ for all dynamic actors.

---

### 2.2 Minimum Clearance Distance ($d_{\min}$)

$$d_{\min} = \min_{k=1,\dots,K} \min_{j=1,\dots,M} \text{dist}_{\text{poly}}\Big(\mathcal{P}_{\text{ego}}(t_k), \mathcal{P}_{\text{obs}, j}(t_k)\Big)$$

- **Clearance Measurement**: Minimum Euclidean distance between the outer boundaries of the convex polygons:
  $$\text{dist}_{\text{poly}}(\mathcal{P}_A, \mathcal{P}_B) = \min_{\mathbf{p}_A \in \partial \mathcal{P}_A, \mathbf{p}_B \in \partial \mathcal{P}_B} \|\mathbf{p}_A - \mathbf{p}_B\|_2$$
- **Unit**: Meters ($\text{m}$), recorded to 3 decimal places ($1\text{ mm}$ precision).
- **Edge Cases**:
  - If $\text{Collision}(t_k) = \text{True}$ at any cycle, $d_{\min} \equiv 0.000\text{ m}$.
  - In benign runs with zero dynamic obstacles, $d_{\min}$ is measured to the driveable road edge boundary ($|y| = 4.70\text{ m}$).

---

### 2.3 Time-to-Collision (TTC) & Near-Miss Formulation

#### 1. Kinematic Vector Relationships & Coordinate Conventions
Let ego vehicle center be $\mathbf{p}_{\text{ego}} = (x_e, y_e)$ with velocity $\mathbf{v}_{\text{ego}} = (v_{x, e}, v_{y, e})$ in the global East-North inertial frame.  
Let obstacle center be $\mathbf{p}_{\text{obs}} = (x_o, y_o)$ with velocity $\mathbf{v}_{\text{obs}} = (v_{x, o}, v_{y, o})$.  

- **Relative displacement vector ($\mathbf{r}$, from Ego to Obstacle)**:
  $$\mathbf{r}(t) = \mathbf{p}_{\text{obs}}(t) - \mathbf{p}_{\text{ego}}(t) = \begin{bmatrix} x_o(t) - x_e(t) \\ y_o(t) - y_e(t) \end{bmatrix}, \quad r(t) = \|\mathbf{r}(t)\|_2 = \sqrt{(x_o - x_e)^2 + (y_o - y_e)^2}$$
- **Relative velocity vector ($\mathbf{v}_{\text{rel}}$, Ego closing onto Obstacle)**:
  $$\mathbf{v}_{\text{rel}} = \mathbf{v}_{\text{ego}} - \mathbf{v}_{\text{obs}} = \begin{bmatrix} v_{x, e} - v_{x, o} \\ v_{y, e} - v_{y, o} \end{bmatrix} = -\dot{\mathbf{r}}(t)$$
- **Relative-Position Evolution Equation**:
  Under the **constant-relative-velocity assumption** ($\ddot{\mathbf{r}} = 0$, both vehicles maintaining straight-line paths at constant speed), the relative position vector at future lookahead time $\tau \ge 0$ evolves as:
  $$\mathbf{r}(\tau) = \mathbf{r}(0) - \mathbf{v}_{\text{rel}} \tau$$
- **Range Rate ($\dot{r}$) and Closing Speed ($v_{\text{closing}}$)**:
  $$\dot{r}(t) = \frac{d}{dt} \|\mathbf{r}(t)\|_2 = \frac{\mathbf{r}(t) \cdot \dot{\mathbf{r}}(t)}{r(t)} = -\frac{\mathbf{r}(t) \cdot \mathbf{v}_{\text{rel}}}{r(t)}$$
  $$v_{\text{closing}} = -\dot{r}(t) = \frac{\mathbf{r}(t) \cdot \mathbf{v}_{\text{rel}}}{r(t)}$$
  Approaching objects satisfy $\mathbf{r} \cdot \mathbf{v}_{\text{rel}} > 0 \iff \dot{r} < 0 \iff v_{\text{closing}} > 0$.

#### 2. Exact 2D Constant-Relative-Velocity Contact Equation
Let $R_{\text{ego}}$ and $R_{\text{obs}}$ be the equivalent bounding circle radii, and $R_{\text{eff}} = R_{\text{ego}} + R_{\text{obs}}$.  
Contact between the bounding envelopes occurs when $\|\mathbf{r}(\tau)\|_2^2 = R_{\text{eff}}^2$:
$$\|\mathbf{r}(0) - \mathbf{v}_{\text{rel}} \tau\|_2^2 = R_{\text{eff}}^2$$
$$\iff \|\mathbf{v}_{\text{rel}}\|^2 \tau^2 - 2 (\mathbf{r}(0) \cdot \mathbf{v}_{\text{rel}}) \tau + (\|\mathbf{r}(0)\|^2 - R_{\text{eff}}^2) = 0$$

This is a standard quadratic equation in $\tau$: $A \tau^2 + B \tau + C = 0$, where:
$$A = \|\mathbf{v}_{\text{rel}}\|^2$$
$$B = -2 (\mathbf{r}(0) \cdot \mathbf{v}_{\text{rel}})$$
$$C = \|\mathbf{r}(0)\|^2 - R_{\text{eff}}^2$$
The discriminant is:
$$\mathcal{D} = B^2 - 4AC = 4 (\mathbf{r} \cdot \mathbf{v}_{\text{rel}})^2 - 4 \|\mathbf{v}_{\text{rel}}\|^2 (r^2 - R_{\text{eff}}^2)$$

#### 3. Complete Case-Handling Table

| Condition | Physical Interpretation | Mathematical Result for $\text{TTC}$ |
| :--- | :--- | :---: |
| **$C \le 0$** | **Initial Overlap**: Vehicles already in physical contact at $\tau = 0$ ($\|\mathbf{r}(0)\| \le R_{\text{eff}}$). | $\text{TTC} \equiv \mathbf{0.000\text{ s}}$ |
| **$A = 0$** | **Zero Relative Velocity**: $\|\mathbf{v}_{\text{rel}}\| = 0$ (parallel cruise at identical speeds or both stationary). Distance never changes. | $\text{TTC} \equiv \mathbf{null}$ (`is_closing = False`) |
| **$\mathbf{r} \cdot \mathbf{v}_{\text{rel}} \le 0$** | **Diverging or Static Range**: Range rate $\dot{r} \ge 0$. Distance is increasing or constant. | $\text{TTC} \equiv \mathbf{null}$ (`is_closing = False`) |
| **$\mathcal{D} < 0$** | **Lateral Pass (Miss)**: Closest Point of Approach distance $d_{\text{CPA}} > R_{\text{eff}}$. Vehicles close in range but paths do not intersect. | $\text{TTC} \equiv \mathbf{null}$ (`will_intersect = False`) |
| **$\mathcal{D} \ge 0 \land \mathbf{r} \cdot \mathbf{v}_{\text{rel}} > 0 \land C > 0$** | **Future Contact**: Collision occurs under constant velocity at the smaller positive root. | $\text{TTC}_{\text{2D}} = \frac{-B - \sqrt{\mathcal{D}}}{2A}$ |

Evaluating the positive contact root explicitly:
$$\text{TTC}_{\text{2D}} = \frac{(\mathbf{r} \cdot \mathbf{v}_{\text{rel}}) - \sqrt{(\mathbf{r} \cdot \mathbf{v}_{\text{rel}})^2 - \|\mathbf{v}_{\text{rel}}\|^2 (r^2 - R_{\text{eff}}^2)}}{\|\mathbf{v}_{\text{rel}}\|^2}$$

#### 4. Near-Miss Predicate
$$\text{NearMiss}_i = \mathbb{I}\left(\text{CollisionFree}_i \land \left(d_{\min} < d_{\text{near}} \lor \min_{k: \text{TTC}_k \neq \texttt{null}} \text{TTC}(t_k) < \text{TTC}_{\text{near}}\right)\right)$$

- **Authoritative Primary Thresholds**:
  - Distance threshold: $d_{\text{near}} = 1.00\text{ m}$.
  - Time-to-Collision threshold: $\text{TTC}_{\text{near}} = 1.20\text{ s}$.
- **Pre-Specified Sensitivity Thresholds**:
  - Tight envelope: $d_{\text{near}} = 0.50\text{ m}$, $\text{TTC}_{\text{near}} = 0.80\text{ s}$.
  - Wide envelope: $d_{\text{near}} = 1.50\text{ m}$, $\text{TTC}_{\text{near}} = 1.80\text{ s}$.

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

- **Authoritative Parameters**:
  - Longitudinal goal line: $X_{\text{goal}} = 65.00\text{ m}$.
  - Lateral road boundary: $Y_{\text{bound}} = 4.70\text{ m}$ (outer edge of stabilized shoulder).
  - Terminal speed floor: $v_{\min\_term} = 0.50\text{ m/s}$ ($1.8\text{ km/h}$).
  - Simulation timeout: $T_{\max} = 20.00\text{ s}$ ($200$ frames at $\Delta t = 0.10\text{ s}$).
- **Failure Classification for Incomplete Runs**:
  - **Collision Failure**: SAT intersection occurred before goal.
  - **Livelock / Deadlock**: $t_{\text{term}} \ge T_{\max}$ with $x_{\text{ego}} < 65.00\text{ m}$ while vehicle speed remained $v < 0.20\text{ m/s}$ for $\ge 3.0\text{ s}$.
  - **Off-Road Departure**: $|y_{\text{ego}}(t)| > 4.70\text{ m}$ (wheel entered roadside ditch).
  - **Timeout Failure**: $t_{\text{term}} \ge T_{\max}$ with vehicle still cruising forward but failing to reach $65.00\text{ m}$.

### 3.2 Progress Efficiency Ratio ($\eta_{\text{prog}}$)

$$\eta_{\text{prog}} = \frac{x_{\text{ego}}(t_{\text{term}}) - x_{\text{ego}}(0)}{\sum_{k=1}^{K-1} \sqrt{(x_{k+1} - x_k)^2 + (y_{k+1} - y_k)^2}}$$

- **Definition**: Ratio of net displacement along the road centerline axis ($X$) to the total Euclidean arc-length traversed by the vehicle CG.
- **Unit**: Dimensionless ratio $\in [0.0, 1.0]$.
- **Edge Cases**:
  - Reverse motion ($\Delta x < 0$) increases trajectory length without advancing the numerator, strictly penalizing $\eta_{\text{prog}}$.
  - If a vehicle stalls at start ($x = 0$), $\eta_{\text{prog}} \equiv 0.000$.

---

## 4. Ride Comfort: Variable-Timestep Jerk Formulations

> **Scientific Boundary**: Jerk metrics quantify kinematic smoothness and dynamic abruptness. They serve as engineering proxies for passenger ride comfort in automated vehicle literature. They **do not** claim full compliance with or certification under ISO 2631-1 (whole-body vibration), which requires tri-axial frequency-weighted accelerations measured at the seat-occupant interface.

### 4.1 Variable-Timestep Numerical Differentiation
Let $t_k$ be discrete time stamps with variable interval $\Delta t_k = t_k - t_{k-1} > 0$. Let $v_k$ be forward longitudinal speed.

#### Step 1: Raw Acceleration Calculation
$$a_k = \frac{v_k - v_{k-1}}{\Delta t_k} \quad \text{for } k \ge 1$$

#### Step 2: Causal Low-Pass Smoothing
To prevent amplification of high-frequency numerical quantization noise, a causal moving average filter of window $M = 3$ is applied to acceleration:
$$a_{k, \text{filt}} = \frac{1}{\min(k, M)} \sum_{m=0}^{\min(k-1, M-1)} a_{k-m}$$

#### Step 3: Variable-Timestep Jerk Calculation
The filtered longitudinal jerk $j_k$ at step $k \ge 2$ across non-uniform intervals is computed as:
$$j_k = \frac{a_{k, \text{filt}} - a_{k-1, \text{filt}}}{\frac{1}{2}(\Delta t_k + \Delta t_{k-1})} = 2 \cdot \frac{a_{k, \text{filt}} - a_{k-1, \text{filt}}}{\Delta t_k + \Delta t_{k-1}}$$

For constant $\Delta t_k = \Delta t = 0.10\text{ s}$, this reduces to:
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

### Test Case 1: Variable-Timestep Jerk Calculation
- **Discrete Inputs**:
  - $t_0 = 0.00\text{ s}, v_0 = 10.00\text{ m/s}$
  - $t_1 = 0.10\text{ s}, v_1 = 9.80\text{ m/s}$ ($\Delta t_1 = 0.10\text{ s}$)
  - $t_2 = 0.25\text{ s}, v_2 = 9.20\text{ m/s}$ ($\Delta t_2 = 0.15\text{ s}$)
- **Raw Accelerations**:
  - $a_1 = \frac{9.80 - 10.00}{0.10} = -2.000\text{ m/s}^2$
  - $a_2 = \frac{9.20 - 9.80}{0.15} = -4.000\text{ m/s}^2$
- **Jerk $j_2$ (Unfiltered)**:
  - Interval denominator: $\frac{1}{2}(\Delta t_1 + \Delta t_2) = \frac{0.10 + 0.15}{2} = 0.125\text{ s}$
  - $j_2 = \frac{-4.000 - (-2.000)}{0.125} = \frac{-2.000}{0.125} = \mathbf{-16.000\text{ m/s}^3}$
  - $|j_2| = \mathbf{16.000\text{ m/s}^3}$

### Test Case 2: 2D Time-to-Collision (Head-On Contact vs. Diverging vs. Passing Miss)
- **Scenario A (Direct Head-On Closing)**:
  - Ego: $\mathbf{p}_e = (10.00, 0.00)\text{ m}, \mathbf{v}_e = (8.00, 0.00)\text{ m/s}, R_e = 2.10\text{ m}$
  - Cow: $\mathbf{p}_o = (25.00, 0.00)\text{ m}, \mathbf{v}_o = (0.00, 0.00)\text{ m/s}, R_o = 1.10\text{ m}$
  - Relative displacement: $\mathbf{r} = (15.00, 0.00)\text{ m}$, $r = 15.00\text{ m}$
  - Relative velocity: $\mathbf{v}_{\text{rel}} = (8.00, 0.00)\text{ m/s}$, $\|\mathbf{v}_{\text{rel}}\|^2 = 64.00\text{ m}^2/\text{s}^2$
  - Scalar product: $\mathbf{r} \cdot \mathbf{v}_{\text{rel}} = (15.00)(8.00) + 0 = 120.00\text{ m}^2/\text{s} > 0$
  - Effective radius: $R_{\text{eff}} = 2.10 + 1.10 = 3.20\text{ m}$, $R_{\text{eff}}^2 = 10.24\text{ m}^2$
  - Closest approach distance:
    $$d_{\text{CPA}} = \sqrt{15.00^2 - \frac{120.00^2}{64.00}} = \sqrt{225.00 - 225.00} = 0.00\text{ m} \le 3.20\text{ m} \quad (\text{Direct Impact})$$
  - Quadratic Coefficients: $A = 64.00$, $B = -240.00$, $C = 225.00 - 10.24 = 214.76$
  - Discriminant: $\mathcal{D} = (-240.00)^2 - 4(64.00)(214.76) = 57600.00 - 54978.56 = 2621.44 \ge 0$
  - $\sqrt{\mathcal{D}} = \sqrt{2621.44} = 51.20$
  - Exact 2D Contact Time:
    $$\text{TTC}_{\text{2D}} = \frac{240.00 - 51.20}{2 \times 64.00} = \frac{188.80}{128.00} = \mathbf{1.475\text{ s}}$$
- **Scenario B (Parallel Diverging Vehicles)**:
  - Ego: $\mathbf{p}_e = (10.00, 0.00)\text{ m}, \mathbf{v}_e = (4.00, 0.00)\text{ m/s}$
  - Lead Vehicle: $\mathbf{p}_o = (25.00, 0.00)\text{ m}, \mathbf{v}_o = (7.00, 0.00)\text{ m/s}$
  - Relative velocity: $\mathbf{v}_{\text{rel}} = (4.00 - 7.00, 0) = (-3.00, 0.00)\text{ m/s}$
  - Scalar product: $\mathbf{r} \cdot \mathbf{v}_{\text{rel}} = (15.00)(-3.00) = -45.00\text{ m}^2/\text{s} < 0$ (Diverging)
  - Result: $\text{TTC} \equiv \mathbf{null}$ (`is_closing = False`).
- **Scenario C (Lateral Pass with Wide Clearance)**:
  - Ego: $\mathbf{p}_e = (0.00, 0.00)\text{ m}, \mathbf{v}_e = (10.00, 0.00)\text{ m/s}$
  - Stationary obstacle on shoulder: $\mathbf{p}_o = (20.00, 4.00)\text{ m}, \mathbf{v}_o = (0.00, 0.00)\text{ m/s}, R_{\text{eff}} = 2.00\text{ m}$
  - $\mathbf{r} = (20.00, 4.00)\text{ m}$, $r^2 = 416.00\text{ m}^2$
  - $\mathbf{v}_{\text{rel}} = (10.00, 0.00)\text{ m/s}$, $\|\mathbf{v}_{\text{rel}}\|^2 = 100.00$
  - $\mathbf{r} \cdot \mathbf{v}_{\text{rel}} = 200.00\text{ m}^2/\text{s} > 0$
  - Closest approach distance:
    $$d_{\text{CPA}} = \sqrt{416.00 - \frac{200.00^2}{100.00}} = \sqrt{416.00 - 400.00} = \sqrt{16.00} = 4.00\text{ m}$$
  - Since $d_{\text{CPA}} = 4.00\text{ m} > R_{\text{eff}} = 2.00\text{ m}$, no collision occurs under constant velocity!
  - Result: $\text{TTC} \equiv \mathbf{null}$ (`is_closing = True`, but `will_intersect = False`).
