# ADAPTIVE-PATH — Formal Potential Risk Field Definition

> **Version**: 2.1.0-draft (Final G2 Scientific Revisions)  
> **Status**: Proposed / Under Final G2 Review  
> **Date**: 2026-11-03  
> **Scope**: Mathematical specification of the continuous potential risk field $R(x, y, t)$, distinguishing collision probability, vulnerability severity, road boundary constraints, 2D conformal epistemic uncertainty covariance, multi-agent aggregation, MRM recovery hysteresis, and candidate deadlock prevention.

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

### 2.3 Mathematically Supported Two-Dimensional Conformal Covariance Inflation
Let the calibrated split-conformal non-conformity quantile for class $c_j$ at prediction horizon $t$ be $r_{\text{conf}}(c_j, t) \in \mathbb{R}^+$, representing the non-parametric spatial uncertainty radius guaranteeing 95% marginal coverage in the Cartesian plane.

Because tracking and motion forecasting errors on roads are anisotropic (lateral deviation from path vs. longitudinal timing/speed error), the 2D covariance matrix $\mathbf{\Sigma}_j(t)$ in the obstacle local frame is inflated along both axes:

$$\mathbf{\Sigma}_j(t) = \begin{bmatrix} \sigma_{\text{long}, j}^2(t) & 0 \\ 0 & \sigma_{\text{lat}, j}^2(t) \end{bmatrix}$$
$$\sigma_{\text{long}, j}^2(t) = \left(\sigma_{\text{long}, j} + \beta_{\text{long}} \cdot r_{\text{conf}}(c_j, t)\right)^2$$
$$\sigma_{\text{lat}, j}^2(t) = \left(\sigma_{\text{lat}, j} + \beta_{\text{lat}} \cdot r_{\text{conf}}(c_j, t)\right)^2$$

- **Anisotropic Inflation Coefficients**: $\beta_{\text{long}} = 0.50$, $\beta_{\text{lat}} = 0.35$.
- **Mathematical Justification**: Longitudinal braking and acceleration timing variability on unstructured roads is consistently higher than lateral path deviation. Expanding both axes in the local body frame guarantees that the uncertainty ellipse encloses the calibrated 95% empirical error boundary while respecting the vehicle's non-holonomic orientation.

### 2.4 Dynamic Encroachment Kernel ($K_j(x, y, t)$)
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

## 4. Multi-Agent Risk Aggregation & Global Boundary Composition

### 4.1 Multi-Agent Dynamic Risk Aggregation
When $M$ dynamic agents are present simultaneously, their individual risk potentials are aggregated using the **Probabilistic Independent Union (Soft Maximum)**:

$$R_{\text{dynamic, total}}(x, y, t) = 1.0 - \prod_{j=1}^M \Big(1.0 - R_j(x, y, t)\Big)$$

- **Mathematical Properties**:
  1. **Monotonicity**: Adding another agent strictly increases (or maintains) total risk.
  2. **Boundedness**: If all $R_j \in [0.0, 1.0]$, then $R_{\text{dynamic, total}} \in [0.0, 1.0]$ strictly.
  3. **Non-Additive**: Two adjacent agents each with $R = 0.50$ combine to $1.0 - (0.5)(0.5) = 0.75$, rather than exceeding $1.0$ artificially.

### 4.2 Road Boundary Potential & Full Vehicle-Footprint Feasibility
The road cross-section consists of:
- Paved asphalt lane: $y \in [-3.50\text{ m}, +3.50\text{ m}]$ (width $7.0\text{ m}$).
- Stabilized unpaved shoulder: $3.50\text{ m} < |y| \le 4.70\text{ m}$ (shoulder width $1.20\text{ m}$ each side).
- Roadside ditch boundary: $|y| > 4.70\text{ m}$.

#### Full Vehicle Footprint Feasibility
The ego vehicle has full rectangular width $W_{\text{veh}} = 1.80\text{ m}$.  
When the vehicle center is at lateral offset $y_{\text{ego}}$, the outer wheel/fender boundaries reach $y_{\text{ego}} \pm \frac{W_{\text{veh}}}{2} = y_{\text{ego}} \pm 0.90\text{ m}$.
Therefore:
1. **Asphalt Feasibility (Entire Footprint on Paved Road)**:
   $$|y_{\text{ego}}| \le 3.50\text{ m} - 0.90\text{ m} = \mathbf{2.60\text{ m}}$$
2. **Driveable Shoulder Feasibility (Entire Footprint on Road + Shoulder)**:
   $$|y_{\text{ego}}| \le 4.70\text{ m} - 0.90\text{ m} = \mathbf{3.80\text{ m}}$$
3. **Ditch Encroachment (Hard Invariant Boundary)**:
   If $|y_{\text{ego}}| > 3.80\text{ m}$, the outer wheel departs the shoulder into the ditch, violating the physical driveability boundary.

#### Continuous Road Boundary Potential ($R_{\text{boundary}}(y)$)
$$R_{\text{boundary}}(y) = \begin{cases}
0.00 & \text{if } |y| \le 2.60\text{ m} \quad (\text{Footprint fully on asphalt}) \\
0.40 \cdot \left(\frac{|y| - 2.60}{3.80 - 2.60}\right)^2 & \text{if } 2.60\text{ m} < |y| \le 3.80\text{ m} \quad (\text{Shoulder bypass penalty}) \\
1.00 & \text{if } |y| > 3.80\text{ m} \quad (\text{Hard ditch boundary barrier})
\end{cases}$$

### 4.3 Static Hazards & Composite Field Aggregation
For static obstacles $s \in \{1, \dots, S\}$ with center $(s_x, s_y)$ and radius $r_s$:
$$R_{\text{static}}(x, y) = \max_s \begin{cases} 
1.00 & \text{if } d(x, y) \le r_s \\
\exp\left(-\frac{(d(x, y) - r_s)^2}{2 \sigma_{\text{static}}^2}\right) & \text{if } d(x, y) > r_s
\end{cases}$$

The final composite potential field across the road surface is clipped globally:
$$R(x, y, t) = \min\left(1.00, \; R_{\text{dynamic, total}}(x, y, t) + R_{\text{static}}(x, y) + R_{\text{boundary}}(y)\right)$$

---

## 5. Polygon-to-Polygon Clearance vs. Point Risk

Trajectory optimization in ADAPTIVE-PATH separates **soft risk evaluation** from **hard collision avoidance**:
1. **Soft Trajectory Cost ($J_{\text{risk}}$)**: Evaluated point-wise at sampled trajectory coordinates $\mathbf{p}_k$:
   $$J_{\text{risk}}(\mathcal{T}) = \sum_{k=1}^K R(\mathbf{p}_k, t_k) \cdot \Delta t$$
2. **Hard Invariant Clearance ($d_{\min}$)**: Evaluated polygon-to-polygon using the oriented bounding box of the ego vehicle ($\mathcal{P}_{\text{ego}}(t_k)$) against all obstacles ($\mathcal{P}_{\text{obs}, j}(t_k)$):
   $$d_k = \text{dist}_{\text{poly}}\Big(\mathcal{P}_{\text{ego}}(t_k), \mathcal{P}_{\text{obs}, j}(t_k)\Big)$$
   If $d_k = 0.00\text{ m}$ (SAT intersection) OR $|y_{\text{ego}}| > 3.80\text{ m}$ (footprint off-shoulder), the candidate trajectory is **strictly discarded** ($\text{Cost} \equiv +\infty$).

---

## 6. CRITICAL Persistence, MRM Recovery & Candidate Deadlock Prevention

> **Notice**: The deadlock prevention mechanism below is explicitly documented as an **Unvalidated Candidate Correction (Design Proposal for Post-G2 Validation)**. It addresses the verified cause of Finding F3 (permanent vehicle halting) and will be tested on the Validation Split (Seeds 2005–2009) following F4 calibration integration.

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
  - **Candidate Offset**: Offsets onto the stabilized shoulder ($y \in [\pm 2.0\text{ m}, \pm 3.2\text{ m}]$) are evaluated.
- **Strict Invariant: Hard Constraints Cannot Be Overridden**:
  Lateral creep **cannot override hard constraints**. If a candidate trajectory violates the physical shoulder footprint limit ($|y_{\text{ego}}| > 3.80\text{ m}$) or has polygon clearance $d_{\min} < 1.00\text{ m}$ to the obstacle, its cost remains $+\infty$. Creep only breaks the tie among collision-free paths in favor of slow lateral bypass over permanent paralysis.

---

## 7. Hand-Calculated Mathematical Test Cases

### Test Case 1: Multi-Agent Independent Union Aggregation
- **Location**: $(x, y) = (20.0, 0.0)\text{ m}$.
- **Obstacle 1 (Auto-Rickshaw)**: $R_1(20.0, 0.0) = 0.500$.
- **Obstacle 2 (Two-Wheeler)**: $R_2(20.0, 0.0) = 0.400$.
- **Independent Union Aggregation**:
  $$R_{\text{dynamic, total}} = 1.0 - (1.0 - 0.500)(1.0 - 0.400) = 1.0 - (0.500)(0.600) = 1.0 - 0.300 = \mathbf{0.700}$$
  *(Notice: Linear sum would yield $0.900$; probabilistic union correctly yields $0.700$ bounded below unity).*

### Test Case 2: Full Footprint Shoulder Boundary Feasibility
- **Ego Lateral Coordinate**: $y_{\text{ego}} = 3.20\text{ m}$, width $W_{\text{veh}} = 1.80\text{ m}$.
- **Outer Edge Coordinate**: $y_{\text{outer}} = 3.20 + 0.90 = 4.10\text{ m}$.
- **Shoulder Limit**: $Y_{\text{limit}} = 4.70\text{ m} \implies y_{\text{outer}} \le 4.70\text{ m}$ (**Feasible on Shoulder**).
- **Centerline Bound**: $y_{\text{ego}} = 3.20\text{ m} \le 3.80\text{ m}$ (**Passes Driveable Envelope**).
- **Boundary Risk Potential**:
  $$R_{\text{boundary}}(3.20) = 0.40 \cdot \left(\frac{3.20 - 2.60}{3.80 - 2.60}\right)^2 = 0.40 \cdot \left(\frac{0.60}{1.20}\right)^2 = 0.40 \cdot (0.50)^2 = 0.40 \cdot 0.25 = \mathbf{0.100}$$
- **Ego Lateral Coordinate 2 (Ditch Encroachment)**: $y_{\text{ego}} = 4.00\text{ m}$.
  - Outer edge: $4.00 + 0.90 = 4.90\text{ m} > 4.70\text{ m}$ (in ditch).
  - Centerline $4.00\text{ m} > 3.80\text{ m} \implies R_{\text{boundary}} \equiv \mathbf{1.000}$ (Hard Barrier!).
