# ADAPTIVE-PATH — Formal Potential Risk Field Definition

> **Version**: 2.2.0-draft (Final G2 Patch — Geometric & Statistical Precision)  
> **Status**: Proposed / Under Final G2 Review  
> **Date**: 2026-11-03  
> **Scope**: Mathematical specification of the continuous potential risk field $R(x, y, t)$, distinguishing collision probability, vulnerability severity, road boundary constraints, oriented rectangular vehicle-footprint feasibility, 2D conformal epistemic uncertainty covariance, qualified multi-agent aggregation, MRM recovery hysteresis, and candidate deadlock prevention.

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

## 2. Dynamic Obstacle Kernel & 2D Conformal Covariance Inflation

Let dynamic obstacle $j \in \{1, \dots, M\}$ be located at $(x_j, y_j)$ with heading $\psi_j$, speed $v_j = \sqrt{v_{x, j}^2 + v_{y, j}^2}$, length $L_j$, width $W_j$, and agent category $c_j$.

### 2.1 Anisotropic Coordinate Transformation
To model the physical reality that vehicles and pedestrians have higher motion uncertainty along their longitudinal heading than laterally, evaluation point $(x, y)$ is transformed into the obstacle's local body frame:

$$\begin{bmatrix} \Delta x_{\text{local}} \\ \Delta y_{\text{local}} \end{bmatrix} = \begin{bmatrix} \cos \psi_j & \sin \psi_j \\ -\sin \psi_j & \cos \psi_j \end{bmatrix} \begin{bmatrix} x - x_j \\ y - y_j \end{bmatrix}$$

### 2.2 Base Spatial Dispersion ($\sigma_{\text{long}}, \sigma_{\text{lat}}$)
The spatial dispersion parameters expand with agent speed:
$$\sigma_{\text{long}, j} = \max\left(1.20, 0.50 L_j + 0.30 v_j\right)$$
$$\sigma_{\text{lat}, j} = \max\left(0.80, 0.50 W_j + 0.10 v_j\right)$$

### 2.3 Mathematical Relationship: Scalar Conformal Quantiles to Anisotropic Covariance Inflation
The split-conformal calibration protocol computes a scalar Euclidean non-conformity score:
$$s_i(c, t) = \|\mathbf{p}_{\text{true}, i}(t) - \mathbf{p}_{\text{pred}, i}(t)\|_2$$
The calibrated $(1 - \alpha) = 0.95$ quantile $\hat{q}(c, t) \in \mathbb{R}^+$ defines an isotropic 2D Euclidean ball guaranteeing marginal coverage:
$$P\left(\|\Delta \mathbf{p}(t)\|_2 \le \hat{q}(c, t)\right) \ge 0.95$$

However, trajectory forecast errors on roadways are physically anisotropic: longitudinal braking and acceleration timing variability is empirically larger than lateral lane/corridor deviation. To map the isotropic scalar radius $\hat{q}(c, t)$ into an oriented body-frame uncertainty covariance ellipse while preserving coverage guarantees:
$$\mathbf{\Sigma}_{\text{conf}, j}(t) = \begin{bmatrix} (\beta_{\text{long}} \cdot \hat{q}(c_j, t))^2 & 0 \\ 0 & (\beta_{\text{lat}} \cdot \hat{q}(c_j, t))^2 \end{bmatrix}$$

- **Anisotropic Scaling Ratios**: $\beta_{\text{long}} = 0.50$, $\beta_{\text{lat}} = 0.35$.
- **Geometric Invariant**: Along the major longitudinal axis, the kernel expands by $0.50 \hat{q}$, while along the lateral axis it expands by $0.35 \hat{q}$, ensuring the dynamic potential encloses empirical trajectory variance without creating excessively wide lateral virtual barriers.

### 2.4 Inflated Covariance & Dynamic Encroachment Kernel ($K_j(x, y, t)$)
$$\sigma_{\text{long}, j}(t) = \sigma_{\text{long}, j} + \beta_{\text{long}} \cdot \hat{q}(c_j, t)$$
$$\sigma_{\text{lat}, j}(t) = \sigma_{\text{lat}, j} + \beta_{\text{lat}} \cdot \hat{q}(c_j, t)$$
$$K_j(x, y, t) = \exp\left( -\frac{1}{2} \left[ \left(\frac{\Delta x_{\text{local}}}{\sigma_{\text{long}, j}(t)}\right)^2 + \left(\frac{\Delta y_{\text{local}}}{\sigma_{\text{lat}, j}(t)}\right)^2 \right] \right) \in [0.0, 1.0]$$

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
