# ADAPTIVE-PATH — Formal Potential Risk Field Definition

> **Version**: 2.3.0-final (Final G2 Closure — Conformal Score/Set Consistency)  
> **Status**: Proposed / Awaiting Final G2 Sign-Off  
> **Date**: 2026-11-03  
> **Scope**: Mathematical specification of the continuous potential risk field $R(x, y, t)$, distinguishing collision probability, vulnerability severity, road boundary constraints, oriented rectangular vehicle-footprint feasibility, anisotropic Mahalanobis conformal prediction sets, matching nonconformity score geometry, qualified multi-agent aggregation, MRM recovery hysteresis, and candidate deadlock prevention.

---

## 1. Physical Foundations: Probability, Severity & Dimensionless Potential

Classical automotive risk assessment separates risk into probability and consequence:
$$\text{Classical Risk} = \text{Probability of Collision} \times \text{Severity of Consequence}$$

In ADAPTIVE-PATH, this formulation is formalized into a continuous, normalized potential field $R(x, y, t) \in [0.0, 1.0]$:

1. **Spatial-Temporal Encroachment Likelihood ($P_{\text{encroach}}(x, y, t)$)**:
   - A dimensionless spatial likelihood $\in [0.0, 1.0]$ that an obstacle will occupy point $(x, y)$ at future time $t$, derived from vehicle kinematics and stochastic motion dispersion.
2. **Impact Severity Multiplier ($w_{\text{vuln}}(c) \ge 1.0$)**:
   - A dimensionless scaling factor capturing kinetic energy potential and road user physical vulnerability (e.g., pedestrian vs. heavy commercial vehicle).
3. **Continuous Potential Field ($R(x, y, t)$)**:
   - A smooth, repulsive potential landscape evaluated across the Cartesian road surface that guides candidate trajectory selection and dynamic replanning triggers.

---

## 2. Dynamic Obstacle Kernel & Calibrated Anisotropic Conformal Sets

Let dynamic obstacle $j \in \{1, \dots, M\}$ be located at $(x_j, y_j)$ with heading $\psi_j$, instantaneous speed $v_j(t_0) = \sqrt{v_{x, j}(t_0)^2 + v_{y, j}(t_0)^2}$, length $L_j$, width $W_j$, and agent category $c_j$.

### 2.1 Anisotropic Body-Frame Transformation
To reflect roadway physical reality—where vehicles and road users exhibit substantially higher motion variability along their longitudinal heading (acceleration/braking timing) than laterally (lane and corridor tracking)—any spatial evaluation point $(x, y)$ at prediction horizon step $t_k$ is transformed into the obstacle's predicted local body frame:

$$\begin{bmatrix} \Delta x_{\text{local}} \\ \Delta y_{\text{local}} \end{bmatrix} = \begin{bmatrix} \cos \psi_j(t_k) & \sin \psi_j(t_k) \\ -\sin \psi_j(t_k) & \cos \psi_j(t_k) \end{bmatrix} \begin{bmatrix} x - x_{j, \text{pred}}(t_k) \\ y - y_{j, \text{pred}}(t_k) \end{bmatrix}$$

### 2.2 Directional Tracking Normalizers, Inference-Time Inputs & Aspect Ratio ($\beta_{\text{long}} = 0.50, \beta_{\text{lat}} = 0.35$)
To parameterize the anisotropic geometry prior to calibration, the directional scaling normalizers are defined as:
$$\sigma_{\text{long}}(c_j, t_k) = \beta_{\text{long}} \cdot \sigma_0(c_j, v_j(t_0), t_k)$$
$$\sigma_{\text{lat}}(c_j, t_k) = \beta_{\text{lat}} \cdot \sigma_0(c_j, v_j(t_0), t_k)$$

Where base kinematic expansion is:
$$\sigma_0(c_j, v_j(t_0), t_k) = \max\left(1.00, \; 0.50 L_j + 0.20 v_j(t_0) + 0.15 t_k\right)$$

- **Precise Definition of Inference-Time Inputs ($v_j(t_0), L_j, W_j$)**:
  1. **Observed Speed $v_j(t_0)$**: $v_j(t_0) = \sqrt{v_{x, j}(t_0)^2 + v_{y, j}(t_0)^2}$ is the **instantaneous observed scalar speed at query timestamp $t_0$ (prediction time)**, measured by the perception state estimator (`AgentTrack.v_x`, `AgentTrack.v_y`). It is strictly available prior to trajectory forecasting, not a realized future speed.
  2. **Bounding Dimensions ($L_j, W_j$)**: Static bounding length and width are determined at prediction time from object classification and bounding-box tracking (`AgentTrack.length`, `AgentTrack.width`).
  3. **Calibration-Inference Parity**: During offline calibration on $\mathcal{S}_{\text{calib}}$, the exact same feature values $(v_j(t_0), L_j)$ observed at forecast initiation timestamp $t_0$ are used to evaluate $\sigma_0$. Future ground truth trajectory states are used solely to compute the displacement error vector $[\Delta x, \Delta y]^T$.
- **How Coefficients $\beta_{\text{long}} = 0.50$ and $\beta_{\text{lat}} = 0.35$ are Obtained**:
  1. The directional weights establish an anisotropic aspect ratio:
     $$\frac{\beta_{\text{long}}}{\beta_{\text{lat}}} = \frac{0.50}{0.35} \approx 1.429$$
  2. This $1.43 : 1.0$ aspect ratio was empirically estimated from residual tracking errors across the independent training/tuning split (Split 1 `tune`, Seeds 1000–1009):
     $$\frac{\beta_{\text{long}}}{\beta_{\text{lat}}} = \frac{\sqrt{\frac{1}{N_{\text{tune}}} \sum_{i=1}^{N_{\text{tune}}} (\Delta x_{\text{local}, i})^2}}{\sqrt{\frac{1}{N_{\text{tune}}} \sum_{i=1}^{N_{\text{tune}}} (\Delta y_{\text{local}, i})^2}}$$
  3. **Calibration Rule**: These directional scale parameters are fixed *prior to conformal calibration*. They act as fixed normalizers inside the score function, ensuring that the conformal calibration phase calibrates the uniform inflation factor without modifying the aspect ratio or distorting the set.

### 2.3 Normalized Anisotropic Mahalanobis Score & Conservative Episode Aggregation
For dynamic obstacle $j \in \mathcal{J}_e(c)$ in episode $e$ at horizon step $t_k$, the obstacle-level nonconformity score is formulated as the normalized anisotropic Mahalanobis distance:

$$s_{e, j}(c, t_k) = \sqrt{\left(\frac{\Delta x_{\text{local}, e, j}(t_k)}{\sigma_{\text{long}}(c, t_k)}\right)^2 + \left(\frac{\Delta y_{\text{local}, e, j}(t_k)}{\sigma_{\text{lat}}(c, t_k)}\right)^2}$$

Where $\Delta x_{\text{local}, e, j}(t_k)$ and $\Delta y_{\text{local}, e, j}(t_k)$ are the actual observed longitudinal and lateral position residuals relative to the model's nominal forecast.

#### Episode-Level Score Aggregation & Independent Episode Unit
When an episode contains multiple obstacles of the same class ($|\mathcal{J}_e(c)| > 1$), each independent episode must contribute **exactly one scalar score** to ensure exchangeability across episodes:
1. **Pointwise Episode Score**:
   $$s_e(c, t_k) = \max_{j \in \mathcal{J}_e(c)} s_{e, j}(c, t_k)$$
2. **Simultaneous Episode Score**:
   $$s_e^{\text{sim}}(c) = \max_{j \in \mathcal{J}_e(c)} \max_{k \in \{1, \dots, K\}} s_{e, j}(c, t_k)$$
3. **Exclusion of Non-Target Episodes (No Zero Scores)**:
   Episodes without obstacles of class $c$ ($\mathcal{J}_e(c) = \emptyset$) **must NOT contribute zero scores**. Assigning zero to non-occurring agents would artificially compress empirical nonconformity quantiles and invalidate coverage. Such episodes are excluded from class $c$ calibration.
4. **Independent Episodes vs. Obstacle Observations**:
   Sample size $n_e(c) = |\{ e \in \mathcal{S}_{\text{calib}} : |\mathcal{J}_e(c)| \ge 1 \}|$ denotes the count of independent episodes, which is strictly distinct from the total count of obstacle observations $N_{\text{obs}}(c) = \sum |\mathcal{J}_e(c)| \ge n_e(c)$. The finite-sample quantile is computed strictly across the $n_e(c)$ independent episode scores.

### 2.4 Exact Deployed Prediction Set & Mathematical Coverage Guarantee
Let calibration split $\mathcal{S}_{\text{calib}}$ have $n_e(c)$ independent episodes containing class $c$ ($n_e(c) \ge 40$).  
The finite-sample conformal quantile at coverage level $1 - \alpha = 0.95$ is:
$$\hat{q}_{1-\alpha}(c, t_k) = s_{(m)}(c, t_k), \quad m = \lceil (n_e(c) + 1)(1 - \alpha) \rceil$$
Where $s_{(1)} \le s_{(2)} \le \dots \le s_{(n_e(c))}$ are the sorted episode-level nonconformity scores.

The **exact prediction set deployed by the predictor** is defined as the sub-level set:
$$\mathcal{C}_{1-\alpha}(c, t_k) = \left\{ \mathbf{p} = (x, y) \in \mathbb{R}^2 : s(\mathbf{p}; c, t_k) \le \hat{q}_{1-\alpha}(c, t_k) \right\}$$
$$\iff \left\{ (x, y) \in \mathbb{R}^2 : \left(\frac{\Delta x_{\text{local}}}{\sigma_{\text{long}}(c, t_k)}\right)^2 + \left(\frac{\Delta y_{\text{local}}}{\sigma_{\text{lat}}(c, t_k)}\right)^2 \le \hat{q}_{1-\alpha}^2(c, t_k) \right\}$$

Dividing by $\hat{q}_{1-\alpha}^2(c, t_k)$, this defines an oriented ellipse:
$$\frac{\Delta x_{\text{local}}^2}{r_{\text{long}}^2(c, t_k)} + \frac{\Delta y_{\text{local}}^2}{r_{\text{lat}}^2(c, t_k)} \le 1.0$$

Where the **envelope semi-axes** are computed directly as:
$$r_{\text{long}}(c, t_k) = \hat{q}_{1-\alpha}(c, t_k) \cdot \sigma_{\text{long}}(c, t_k)$$
$$r_{\text{lat}}(c, t_k) = \hat{q}_{1-\alpha}(c, t_k) \cdot \sigma_{\text{lat}}(c, t_k)$$

#### Coverage Claim Restriction
> [!IMPORTANT]
> **Strict Conformal Validity Invariant**:
> Because $\mathbf{p}_{\text{true}} \in \mathcal{C}_{1-\alpha}(c, t_k) \iff s(\mathbf{p}_{\text{true}}) \le \hat{q}_{1-\alpha}(c, t_k)$, and episode scores take the maximum across all class instances in the episode, the Split-Conformal Theorem proves that under episode exchangeability:
> $$P\left(\forall j \in \mathcal{J}_e(c), \; \mathbf{p}_{\text{true}, j}(t_k) \in \mathcal{C}_{1-\alpha}(c, t_k)\right) \ge 1 - \alpha$$
> **No coverage claim may be made for any post-hoc transformed, scaled, or clipped set unless the score itself is calibrated on that exact transformed geometry.** The deployed prediction set $\mathcal{C}_{1-\alpha}$ is identically the sub-level set of the calibrated score.

### 2.5 Pointwise vs. Simultaneous Coverage Definitions
ADAPTIVE-PATH formally distinguishes and calibrates two distinct conformal coverage levels:

1. **Pointwise Conformal Coverage (Per Horizon Step $t_k$)**:
   - Calibrated independently at each prediction horizon step $t_k \in \{0.20\text{ s}, 0.40\text{ s}, \dots, 2.80\text{ s}\}$ ($K = 14$ steps).
   - Nonconformity scores: $s_e(c, t_k) = \max_{j \in \mathcal{J}_e(c)} s_{e, j}(c, t_k)$.
   - Quantile: $\hat{q}_{1-\alpha}^{\text{pt}}(c, t_k) = s_{(m)}(c, t_k)$.
   - **Pointwise Guarantee**:
     $$\forall k \in \{1, \dots, K\}, \quad P\left(\mathbf{p}_{\text{true}}(t_k) \in \mathcal{C}_{1-\alpha}^{\text{pt}}(c, t_k)\right) \ge 1 - \alpha$$
   - **Use Case**: Step-wise risk field potential calculation and frame-by-frame telemetry logging.

2. **Simultaneous Conformal Coverage (Trajectory-Wide Horizon $H = 2.80\text{ s}$)**:
   - Calibrated across the entire 14-step trajectory rollout to control Family-Wise Error Rate (FWER) across time.
   - Episode trajectory supremum score:
     $$s_e^{\text{sim}}(c) = \max_{j \in \mathcal{J}_e(c)} \max_{k \in \{1, \dots, K\}} s_{e, j}(c, t_k)$$
   - Quantile: $\hat{q}_{1-\alpha}^{\text{sim}}(c) = s_{(m)}^{\text{sim}}(c)$.
   - Simultaneous envelope semi-axes:
     $$r_{\text{long}}^{\text{sim}}(c, t_k) = \hat{q}_{1-\alpha}^{\text{sim}}(c) \cdot \sigma_{\text{long}}(c, t_k)$$
     $$r_{\text{lat}}^{\text{sim}}(c, t_k) = \hat{q}_{1-\alpha}^{\text{sim}}(c) \cdot \sigma_{\text{lat}}(c, t_k)$$
   - **Simultaneous Trajectory Guarantee**:
     $$P\left(\forall k \in \{1, \dots, K\}, \quad \mathbf{p}_{\text{true}}(t_k) \in \mathcal{C}_{1-\alpha}^{\text{sim}}(c, t_k)\right) \ge 1 - \alpha$$
   - **Use Case**: Event replanning trigger evaluation (`CONFORMAL_VIOLATION`), ensuring that an obstacle trajectory departure triggers replanning with a bounded $5\%$ false alarm / breach probability over the full planning horizon.

### 2.6 Calibrated Dynamic Encroachment Kernel ($K_j(x, y, t_k)$)
To translate the statistical prediction set into a continuous, differentiable risk potential for the trajectory optimizer, the spatial kernel is defined using the calibrated envelope semi-axes:

$$K_j(x, y, t_k) = \exp\left( -\frac{1}{2} \left[ \left(\frac{\Delta x_{\text{local}}}{r_{\text{long}}(c_j, t_k)}\right)^2 + \left(\frac{\Delta y_{\text{local}}}{r_{\text{lat}}(c_j, t_k)}\right)^2 \right] \right) \in [0.0, 1.0]$$

- **Boundary Invariant**: On the exact boundary of the $(1-\alpha)$ conformal prediction set $\partial \mathcal{C}_{1-\alpha}$, the bracketed Mahalanobis term equals $1.0$, giving:
  $$K_j \Big|_{\partial \mathcal{C}_{1-\alpha}} = \exp(-0.50) \approx 0.6065$$
  This establishes an exact physical correspondence: candidate trajectories clipping the 95% conformal uncertainty boundary encounter a defined base encroachment potential of $0.6065$.

---

## 3. Vulnerability Severity Multipliers & Clipping

### 3.1 Severity Multipliers ($w_{\text{vuln}}$)
Derived from the Vulnerable Road User (VRU) structural injury severity hierarchy:

| Agent Class ($c_j$) | Severity Multiplier $w_{\text{vuln}}$ | Justification |
| :--- | :---: | :--- |
| **Pedestrian** | $1.60$ | Unprotected human life; highest severity consequence. |
| **Cattle / Livestock** | $1.40$ | High mass ($350\text{--}500\text{ kg}$), sudden unpredictable halts, severe windshield intrusion risk. |
| **Handcart / Street Vendor**| $1.30$ | Low speed, manual operator, exposed cargo. |
| **Two-Wheeler (Motorbike)** | $1.20$ | High velocity capability, vulnerable rider, rapid lateral swerving. |
| **Auto-Rickshaw (Three-Wheeler)** | $1.10$ | Open-sided light chassis, high tip-over/rollover likelihood. |
| **Car / Passenger Vehicle** | $1.00$ | Baseline structural passenger compartment with passive safety. |
| **Heavy Commercial (Truck/Bus)** | $1.00$ | High vehicle structural damage to ego; standard active avoidance baseline. |

### 3.2 Per-Agent Risk Evaluation & Individual Saturation Clipping
Each detected obstacle $j$ contributes an individual risk potential $R_j(x, y, t)$. Because $w_{\text{vuln}} > 1.0$, individual risk is passed through an **individual saturation function** to prevent individual agent potentials from exceeding unity:

$$R_j(x, y, t) = \min\left(1.00, \; w_{\text{vuln}}(c_j) \cdot K_j(x, y, t) \cdot T_{\text{decay}}(\text{TTC}_j)\right)$$

Where temporal decay is evaluated from the closing range rate:
$$T_{\text{decay}}(\text{TTC}_j) = \begin{cases}
\frac{1}{1.0 + 0.50 \cdot \max(0.0, \text{TTC}_j)} & \text{if closing } (\dot{r} < 0) \\
\exp(-0.20 \cdot \|\mathbf{r}\|) & \text{if diverging / stationary } (\dot{r} \ge 0)
\end{cases}$$

---

## 4. Multi-Agent Risk Aggregation & Road Boundary Composition

### 4.1 Multi-Agent Dynamic Risk Aggregation (Probabilistic Independent Union)
When $M$ dynamic agents are present simultaneously, their individual risk potentials are aggregated using the **Probabilistic Independent Union (Soft Maximum)**:

$$R_{\text{dynamic, total}}(x, y, t) = 1.0 - \prod_{j=1}^M \Big(1.0 - R_j(x, y, t)\Big)$$

#### Qualification of the Independence Assumption
- **Statistical Independence Qualification**: The product form $1 - \prod (1 - R_j)$ models the union probability under the assumption that individual agent encroachment events are conditionally independent given their instantaneous state.
- **Physical Reality**: In dense Indian traffic, obstacles often exhibit positive spatial correlation (e.g. two-wheelers clustering behind an auto-rickshaw or cattle moving as a herd).
- **Mathematical Justification**:
  1. **Monotonicity**: Adding an obstacle never decreases risk: $R_{\text{total}}(A \cup B) \ge \max(R_A, R_B)$.
  2. **Boundedness**: Unlike linear addition ($R_A + R_B$), the independent union is strictly bounded in $[0.0, 1.0]$.
  3. **Super-Maximum Sensitivity**: For two approaching vehicles each contributing moderate risk $R = 0.50$, the independent union evaluates to $1.0 - (0.5)(0.5) = 0.75$, correctly recognizing that navigating between two moderate hazards is more dangerous than encountering either in isolation.

---

### 4.2 Road Boundary Potential & Oriented Rectangular Footprint Feasibility

#### 1. The Oriented Rectangular Vehicle Footprint
The ego vehicle is an oriented 2D rectangle with length $L_{\text{veh}} = 4.20\text{ m}$ and width $W_{\text{veh}} = 1.80\text{ m}$, centered at pose $(x, y)$ with heading yaw $\psi$.  
In global coordinates, the four corners of the chassis are:
$$\mathbf{p}_{\text{corner}, k} = \begin{bmatrix} x \\ y \end{bmatrix} + \begin{bmatrix} \cos \psi & -\sin \psi \\ \sin \psi & \cos \psi \end{bmatrix} \begin{bmatrix} \pm L_{\text{veh}} / 2 \\ \pm W_{\text{veh}} / 2 \end{bmatrix}$$

The extreme lateral coordinates reached by the rectangular footprint are:
$$y_{\text{max, ego}}(y, \psi) = y + \left(\frac{L_{\text{veh}}}{2} |\sin \psi| + \frac{W_{\text{veh}}}{2} |\cos \psi|\right)$$
$$y_{\text{min, ego}}(y, \psi) = y - \left(\frac{L_{\text{veh}}}{2} |\sin \psi| + \frac{W_{\text{veh}}}{2} |\cos \psi|\right)$$

Let the **effective lateral half-width** under heading $\psi$ be:
$$W_{\text{eff}}(\psi) = \frac{L_{\text{veh}}}{2} |\sin \psi| + \frac{W_{\text{veh}}}{2} |\cos \psi|$$

- At straight cruise ($\psi = 0$): $W_{\text{eff}}(0) = \frac{1.80}{2} = 0.900\text{ m}$.
- At an evasive yaw angle $\psi = 15^\circ$ ($0.262\text{ rad}$):
  $$W_{\text{eff}}(15^\circ) = 2.10 |\sin 15^\circ| + 0.90 |\cos 15^\circ| = 2.10(0.2588) + 0.90(0.9659) = 0.5435 + 0.8693 = \mathbf{1.413\text{ m}}$$
- At an assertive swerve angle $\psi = 30^\circ$ ($0.524\text{ rad}$):
  $$W_{\text{eff}}(30^\circ) = 2.10(0.5000) + 0.90(0.8660) = 1.0500 + 0.7794 = \mathbf{1.829\text{ m}}$$

#### 2. Full Polygon Boundary Feasibility Condition
The driveable corridor extends to the outer edge of the stabilized shoulder at $Y_{\text{limit}} = \pm 4.70\text{ m}$. Beyond $4.70\text{ m}$ lies the unpaved roadside ditch.  
The **Full Oriented Footprint Invariant** requires:
$$|y| + W_{\text{eff}}(\psi) \le 4.70\text{ m}$$
$$\iff |y| \le Y_{\text{max\_center}}(\psi) = 4.70\text{ m} - \left(\frac{L_{\text{veh}}}{2} |\sin \psi| + \frac{W_{\text{veh}}}{2} |\cos \psi|\right)$$

- **Physical Impact on Planning**:
  - For straight driving ($\psi = 0$), the center can travel up to $|y| \le 3.80\text{ m}$.
  - During a $15^\circ$ turn, the vehicle center is constrained to $|y| \le 3.287\text{ m}$.
  - During a $30^\circ$ turn, the vehicle center is constrained to $|y| \le 2.871\text{ m}$.
- **Application Invariant**: This full oriented polygon boundary check is enforced at every point of candidate trajectory rollout, turning maneuvers, and exploratory lateral creep.

#### 3. Continuous Road Boundary Potential ($R_{\text{boundary}}(y, \psi)$)
Let paved asphalt boundary be $Y_{\text{asphalt}} = 3.50\text{ m}$.
$$R_{\text{boundary}}(y, \psi) = \begin{cases}
0.00 & \text{if } |y| + W_{\text{eff}}(\psi) \le 3.50\text{ m} \quad (\text{Footprint fully on asphalt}) \\
0.40 \cdot \left(\frac{|y| + W_{\text{eff}}(\psi) - 3.50}{4.70 - 3.50}\right)^2 & \text{if } 3.50\text{ m} < |y| + W_{\text{eff}}(\psi) \le 4.70\text{ m} \quad (\text{Shoulder bypass penalty}) \\
1.00 & \text{if } |y| + W_{\text{eff}}(\psi) > 4.70\text{ m} \quad (\text{Hard ditch boundary barrier})
\end{cases}$$

### 4.4 Composite Field Aggregation
$$R(x, y, t, \psi) = \min\left(1.00, \; R_{\text{dynamic, total}}(x, y, t) + R_{\text{static}}(x, y) + R_{\text{boundary}}(y, \psi)\right)$$

---

## 5. Polygon-to-Polygon Clearance vs. Point Risk

Trajectory optimization in ADAPTIVE-PATH separates **soft risk evaluation** from **hard collision avoidance**:
1. **Soft Trajectory Cost ($J_{\text{risk}}$)**: Evaluated point-wise at sampled trajectory coordinates $\mathbf{p}_k$:
   $$J_{\text{risk}}(\mathcal{T}) = \sum_{k=1}^K R(\mathbf{p}_k, t_k, \psi_k) \cdot \Delta t$$
2. **Hard Invariant Clearance ($d_{\min}$)**: Evaluated polygon-to-polygon using the oriented bounding box of the ego vehicle ($\mathcal{P}_{\text{ego}}(t_k)$) against all obstacles ($\mathcal{P}_{\text{obs}, j}(t_k)$):
   $$d_k = \text{dist}_{\text{poly}}\Big(\mathcal{P}_{\text{ego}}(t_k), \mathcal{P}_{\text{obs}, j}(t_k)\Big)$$
   If $d_k = 0.00\text{ m}$ (SAT intersection) OR $|y| + W_{\text{eff}}(\psi) > 4.70\text{ m}$ (footprint encroaches into ditch), the candidate trajectory is **strictly discarded** ($\text{Cost} \equiv +\infty$).

---

## 6. CRITICAL Persistence, MRM Recovery & Candidate Deadlock Prevention

> **Notice**: The deadlock prevention mechanism below is explicitly documented as an **Unvalidated Candidate Correction (Design Proposal for Post-G2 Validation)**. It addresses the verified cause of Finding F3 (permanent vehicle halting) and will be tested strictly on Validation Sub-Split B (Seeds 2005–2009) following F4 calibration integration.

### 6.1 State Machine Persistence & Hysteresis
1. **CRITICAL Trigger**: Fires when $R_{\text{ego}}(t_k) \ge 0.85$ or an unresolvable conformal cone intersection occurs. Demands emergency deceleration $a = -5.80\text{ m/s}^2$ (`EMERGENCY_BRAKE`).
2. **Hysteresis Recovery Predicate**: Transition back to nominal planning occurs only when:
   $$R_{\text{ego}}(t) < R_{\text{recovery}} = 0.40 \quad \text{for at least } \tau_{\text{dwell}} = 0.50\text{ s (5 consecutive cycles)}$$
   $$\land \quad \text{Forward line-of-sight clearance} \ge 8.00\text{ m}$$
   The gap between $0.85$ and $0.40$ strictly prevents actuator chattering.

### 6.2 Candidate Deadlock Prevention: Exploratory Lateral Creep

#### Problem Statement (Finding F3)
When an obstacle halts in the active lane (e.g. Scenario 5 cattle crossing), the high potential field ahead caused candidate speeds $v = 0$ to minimize cost. The planner chose $v = 0$, bringing the vehicle to a permanent halt ($0\%$ collisions, but $0\%$ goal completion).

#### Candidate Solution: Exploratory Lateral Creep
- **Stuck Detection**:
  $$\text{Stuck}(t) = \mathbb{I}\left(v_{\text{ego}} < 0.10\text{ m/s} \land t_{\text{stationary}} \ge 2.00\text{ s} \land x_{\text{ego}} < X_{\text{goal}}\right)$$
- **Objective Formulation during Creep**:
  When $\text{Stuck}(t) = \text{True}$ and obstacle speed $v_{\text{obs}} < 0.30\text{ m/s}$:
  $$J(\mathcal{T}) = w_{\text{prog}} J_{\text{prog}} + w_{\text{smooth}} J_{\text{smooth}} + w_{\text{risk}} J_{\text{risk}} + J_{\text{stationary}}$$
  - **Stationary Penalty**: $J_{\text{stationary}} = +10.0 \cdot t_{\text{stationary}} \cdot \mathbb{I}(v_{\text{cand}} = 0)$.
  - **Boosted Progress Reward**: $w_{\text{prog}} \leftarrow 3.5 \times w_{\text{prog}}$.
  - **Candidate Speed Ceiling**: Creep trajectories are evaluated at crawl speed $v_{\text{creep}} = 1.50\text{ m/s}$ ($5.4\text{ km/h}$).
  - **Candidate Offset**: Offsets onto the stabilized shoulder are evaluated under the full oriented polygon constraint $|y| + W_{\text{eff}}(\psi) \le 4.70\text{ m}$.
- **Strict Invariant: Hard Constraints Cannot Be Overridden**:
  Lateral creep **cannot override hard constraints**. If a candidate trajectory violates the physical shoulder footprint limit ($|y| + W_{\text{eff}}(\psi) > 4.70\text{ m}$) or has polygon distance $d_{\min} < 1.00\text{ m}$ to the obstacle, its cost remains $+\infty$. Creep only breaks the tie among collision-free paths in favor of slow lateral bypass over permanent paralysis.

---

## 7. Hand-Calculated Mathematical Test Cases

### Test Case 1: Multi-Agent Independent Union Aggregation
- **Location**: $(x, y) = (20.0, 0.0)\text{ m}$.
- **Obstacle 1 (Auto-Rickshaw)**: $R_1(20.0, 0.0) = 0.500$.
- **Obstacle 2 (Two-Wheeler)**: $R_2(20.0, 0.0) = 0.400$.
- **Independent Union Aggregation**:
  $$R_{\text{dynamic, total}} = 1.0 - (1.0 - 0.500)(1.0 - 0.400) = 1.0 - (0.500)(0.600) = 1.0 - 0.300 = \mathbf{0.700}$$

### Test Case 2: Oriented Vehicle Footprint Shoulder Feasibility
- **Vehicle Dimensions**: $L = 4.20\text{ m}, W = 1.80\text{ m}$.
- **Scenario A (Straight Cruise on Shoulder, $\psi = 0^\circ$)**:
  - $y_{\text{ego}} = 3.50\text{ m}, \psi = 0$.
  - $W_{\text{eff}} = 0.90\text{ m}$.
  - Lateral extent: $3.50 + 0.90 = 4.40\text{ m} \le 4.70\text{ m}$ (**Feasible on Shoulder**).
  - Boundary potential:
    $$R_{\text{boundary}} = 0.40 \cdot \left(\frac{4.40 - 3.50}{4.70 - 3.50}\right)^2 = 0.40 \cdot \left(\frac{0.90}{1.20}\right)^2 = 0.40 \cdot (0.75)^2 = 0.40 \cdot 0.5625 = \mathbf{0.225}$$
- **Scenario B (Assertive Turn on Shoulder, $\psi = 20^\circ \approx 0.349\text{ rad}$)**:
  - $y_{\text{ego}} = 3.50\text{ m}, \psi = 20^\circ$.
  - $\sin 20^\circ = 0.3420, \cos 20^\circ = 0.9397$.
  - $W_{\text{eff}} = 2.10(0.3420) + 0.90(0.9397) = 0.7182 + 0.8457 = 1.564\text{ m}$.
  - Lateral extent: $3.50 + 1.564 = 5.064\text{ m} > 4.70\text{ m}$ (**Violates Ditch Limit!**).
  - Result: Center coordinate $y=3.50\text{ m}$ at $\psi = 20^\circ$ is **Infeasible**; $R_{\text{boundary}} \equiv \mathbf{1.000}$ ($\text{Cost} = +\infty$).
  - Maximum allowable center at $20^\circ$ is $y = 4.70 - 1.564 = \mathbf{3.136\text{ m}}$.
