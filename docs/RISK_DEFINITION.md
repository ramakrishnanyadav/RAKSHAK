# ADAPTIVE-PATH — Formal Potential Risk Field Definition

> **Version**: 2.0.0-draft (Revised for Second Gate G2 Review)  
> **Status**: Proposed / Under G2 Review  
> **Date**: 2026-11-03  
> **Scope**: Mathematical specification of the continuous potential risk field $R(x, y, t)$, distinguishing collision probability, vulnerability severity, road boundary constraints, conformal epistemic uncertainty, MRM recovery hysteresis, and deadlock prevention.

---

## 1. Physical Foundations: Probability, Severity & Dimensionless Potential

Classical automotive risk assessment defines risk as:
$$\text{Classical Risk} = \text{Probability of Collision} \times \text{Severity of Consequence}$$

In ADAPTIVE-PATH, this formulation is formalized into a continuous, normalized potential field $R(x, y, t) \in [0.0, 1.0]$:

1. **Spatial-Temporal Encroachment Likelihood ($P_{\text{encroach}}(x, y, t)$)**:
   - A dimensionless probability $\in [0.0, 1.0]$ modeling the spatial likelihood that an obstacle will occupy point $(x, y)$ at future time $t$, derived from vehicle kinematics and stochastic motion dispersion.
2. **Impact Severity Multiplier ($S(\text{class}, v_{\text{rel}})$)**:
   - A dimensionless scaling factor $S \ge 1.0$ capturing kinetic energy potential and road user physical vulnerability (e.g., pedestrian vs. heavy commercial vehicle).
3. **Continuous Potential Field ($R(x, y, t)$)**:
   - A smooth, repulsive potential landscape evaluated across the Cartesian road surface that guides candidate trajectory selection and dynamic replanning triggers.

---

## 2. Dynamic Obstacle Kernel & Anisotropic Spatial Dispersion

Let dynamic obstacle $j \in \{1, \dots, M\}$ be located at $(x_j, y_j)$ with heading $\psi_j$, speed $v_j = \sqrt{v_{x, j}^2 + v_{y, j}^2}$, length $L_j$, width $W_j$, and agent category $c_j$.

### 2.1 Anisotropic Coordinate Transformation
To model the physical reality that vehicles and pedestrians have higher motion uncertainty along their longitudinal heading than laterally, evaluation point $(x, y)$ is transformed into the obstacle's local body frame:

$$\begin{bmatrix} \Delta x_{\text{local}} \\ \Delta y_{\text{local}} \end{bmatrix} = \begin{bmatrix} \cos \psi_j & \sin \psi_j \\ -\sin \psi_j & \cos \psi_j \end{bmatrix} \begin{bmatrix} x - x_j \\ y - y_j \end{bmatrix}$$

### 2.2 Longitudinal & Lateral Spatial Dispersion ($\sigma_{\text{long}}, \sigma_{\text{lat}}$)
The spatial kernel variances expand dynamically with agent velocity:
$$\sigma_{\text{long}, j} = \max\left(1.20, 0.50 L_j + 0.30 v_j\right)$$
$$\sigma_{\text{lat}, j} = \max\left(0.80, 0.50 W_j + 0.10 v_j\right)$$

### 2.3 Spatial Encroachment Probability Kernel ($K_j(x, y)$)
$$K_j(x, y) = \exp\left( -\frac{1}{2} \left[ \left(\frac{\Delta x_{\text{local}}}{\sigma_{\text{long}, j}}\right)^2 + \left(\frac{\Delta y_{\text{local}}}{\sigma_{\text{lat}, j}}\right)^2 \right] \right) \in [0.0, 1.0]$$

---

## 3. Vulnerability Severity Multipliers & Normalization

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

### 3.2 Normalization & Saturation Function
Because severity multipliers exceed $1.0$, the product $w_{\text{vuln}} \cdot K_j(x, y)$ can exceed unity near the obstacle center. The combined dynamic risk is passed through a **saturating clipping function**:

$$R_{\text{dynamic}, j}(x, y, t) = \min\left(1.00, \; w_{\text{vuln}}(c_j) \cdot K_j(x, y) \cdot T_{\text{decay}}(t, \text{TTC}_j)\right)$$

- **Mathematical Behavior**:
  - For a pedestrian ($w_{\text{vuln}} = 1.60$), the core contact zone saturates cleanly at $R = 1.00$, and the repulsive potential decays to $0.50$ at a larger distance than for an enclosed passenger car ($w_{\text{vuln}} = 1.00$).
  - **No Unbounded Growth**: Saturation guarantees $R(x, y) \in [0.0, 1.0]$ globally.

### 3.3 Temporal Decay Function ($T_{\text{decay}}$)
Let $\mathbf{r} = \mathbf{p}_j - (x, y)$ and relative closing speed $\dot{r} = -\frac{\mathbf{r} \cdot \mathbf{v}_{\text{rel}}}{\|\mathbf{r}\|_2}$.
$$T_{\text{decay}}(t, \text{TTC}_j) = \begin{cases}
\frac{1}{1.0 + \gamma_{\text{time}} \cdot \max(0.0, \text{TTC}_j)} & \text{if } \dot{r} > 0 \quad (\text{Closing threat}) \\
\exp\left(-\lambda_{\text{div}} \cdot \|\mathbf{r}\|\right) & \text{if } \dot{r} \le 0 \quad (\text{Diverging / Stationary})
\end{cases}$$
Where temporal discount rate $\gamma_{\text{time}} = 0.50\text{ s}^{-1}$ and spatial divergence attenuation $\lambda_{\text{div}} = 0.20\text{ m}^{-1}$.

---

## 4. Conformal Uncertainty Inflation

When the motion predictor outputs calibrated non-parametric conformal uncertainty envelopes with radius $r_{\text{conf}, j}(t)$ at time horizon $t$, this epistemic uncertainty directly inflates the repulsive field.

### Mathematical Formulation
The spatial dispersion parameters are inflated additively by the calibrated conformal radius:
$$\sigma_{\text{long}, j}^{\text{conf}}(t) = \sigma_{\text{long}, j} + \beta_{\text{conf}} \cdot r_{\text{conf}, j}(t)$$
$$\sigma_{\text{lat}, j}^{\text{conf}}(t) = \sigma_{\text{lat}, j} + \beta_{\text{conf}} \cdot r_{\text{conf}, j}(t)$$

Where $\beta_{\text{conf}} = 0.40$ is the uncertainty coupling factor.

- **Conformal Bounding Guarantee**:
  If the conformal predictor guarantees $95\%$ marginal coverage ($P(\|\mathbf{p}_{\text{true}} - \mathbf{p}_{\text{pred}}\| \le r_{\text{conf}}) \ge 0.95$), inflating $\sigma$ guarantees that the spatial potential field repels trajectories away from the entire high-probability region of obstacle occupancy.

---

## 5. Spatial & Temporal Discretization

- **Simulation Rate**: $\Delta t = 0.10\text{ s}$ ($10\text{ Hz}$).
- **Local Evaluation Grid (ROI)**:
  - Longitudinal span: $[x_{\text{ego}} - 10.0\text{ m}, \; x_{\text{ego}} + 40.0\text{ m}]$ (total $50\text{ m}$).
  - Lateral span: $[-5.0\text{ m}, \; +5.0\text{ m}]$ (total $10\text{ m}$, spanning both ditches).
  - Spatial resolution: $\Delta x = 0.50\text{ m}$, $\Delta y = 0.25\text{ m}$ ($100 \times 40 = 4,000$ grid points).
- **Trajectory Candidate Evaluation**: Point-wise line integration along candidate trajectory waypoints $\mathcal{T} = \{(\mathbf{p}_k, v_k)\}_{k=1}^K$:
  $$J_{\text{risk}}(\mathcal{T}) = \sum_{k=1}^K R(\mathbf{p}_k, t_k) \cdot \Delta t$$

---

## 6. CRITICAL Persistence, MRM Recovery & Deadlock Prevention

> **Key Discovery from Finding F3**: In previous iterations, P3 achieved 0% goal completion because whenever an obstacle entered the lane, the high risk penalty caused candidate speeds $v = 0$ to minimize cost $J_{\text{risk}}$. The vehicle came to a dead halt and never moved again, producing $0\%$ collisions but $0\%$ progress.

To solve this livelock while guaranteeing safety, the risk evaluator and planner state machine enforce the following rigorous hysteresis and progress-preservation rules:

### 6.1 State Machine Persistence & Hysteresis

```
                Risk >= 0.85 OR Conformal Conflict
    ┌────────────────────────────────────────────────────────┐
    │                                                        │
    ▼                                                        │
┌──────────────┐   Risk < 0.40 for >= 0.5s AND Path Clear  ┌──┴───────────┐
│  EMERGENCY   ├──────────────────────────────────────────►│   NOMINAL    │
│  BRAKE (MRM) │                                           │   CRUISE     │
└──────┬───────┘                                           └──▲───────────┘
       │                                                      │
       │ Stopped (v < 0.1 m/s) for >= 2.0s                    │
       │ Path blocked ahead, shoulder clear                   │
       ▼                                                      │
┌──────────────┐           Bypass Completed                   │
│ EXPLORATORY  ├──────────────────────────────────────────────┘
│ LATERAL CREEP│ (Slow lateral nudge: v = 1.5 m/s around hazard)
└──────────────┘
```

1. **Trigger Condition**:
   - `CRITICAL` state fires if $R_{\text{ego}} \ge 0.85$ or an unresolvable conformal cone intersection occurs.
   - Demands controlled emergency deceleration: $a_{\text{cmd}} = -5.80\text{ m/s}^2$.
2. **Recovery Hysteresis Predicate**:
   Transition back to nominal planning occurs only when:
   $$R_{\text{ego}}(t) < R_{\text{recovery}} = 0.40 \quad \text{for at least } \tau_{\text{dwell}} = 0.50\text{ s (5 consecutive cycles)}$$
   $$\land \quad \text{Clearance ahead along reference corridor} \ge 8.00\text{ m}$$
   - **Hysteresis Gap**: The gap between trigger ($0.85$) and recovery ($0.40$) strictly prevents actuator chattering and infinite limit cycles.

### 6.2 Deadlock Prevention: Exploratory Lateral Creep

To prevent permanent halting (Finding F3):
- **Stuck Predicate**:
  $$\text{Stuck}(t) = \mathbb{I}\left(v_{\text{ego}} < 0.10\text{ m/s} \land t_{\text{stationary}} \ge 2.00\text{ s} \land x_{\text{ego}} < X_{\text{goal}}\right)$$
- **Resolution Behavior (Exploratory Creep)**:
  - When $\text{Stuck}(t) = \text{True}$ and the obstacle ahead is stationary (e.g. stalled cattle in lane):
    1. The progress weight in the cost function is boosted: $w_{\text{progress}} \leftarrow 3.5 \times w_{\text{progress}}$.
    2. Zero-speed candidates ($v = 0$) receive an incremental penalty: $J_{\text{stationary}} = +10.0 \cdot t_{\text{stationary}}$.
    3. The planner evaluates candidate bypass trajectories onto the stabilized shoulder ($y \in [\pm 2.0\text{ m}, \pm 3.8\text{ m}]$) at a cautious crawl speed $v_{\text{creep}} = 1.50\text{ m/s}$ ($5.4\text{ km/h}$).
    4. Clearance constraint to the stationary obstacle is maintained at $\ge 1.00\text{ m}$.
- **Result**: P3 safely creeps around the halted obstacle onto the shoulder rather than halting permanently until simulation timeout!

---

## 7. Hand-Calculated Mathematical Test Cases

### Test Case 1: Point Risk Calculation (Pedestrian vs Car)
- **Evaluation Point**: $(x, y) = (10.0, 0.0)\text{ m}$, Ego speed $v_{\text{ego}} = 6.0\text{ m/s}$.
- **Obstacle 1 (Pedestrian)**:
  - Pose: $(13.0, 0.0)$, $\psi = 0$, $v = 0.0\text{ m/s}$.
  - $\Delta x = 3.0\text{ m}, \Delta y = 0.0\text{ m}$.
  - $L = 0.5\text{ m}, W = 0.5\text{ m} \implies \sigma_{\text{long}} = \max(1.20, 0.25) = 1.20\text{ m}$.
  - Kernel: $K = \exp\left(-\frac{1}{2}\left(\frac{3.0}{1.20}\right)^2\right) = \exp(-3.125) \approx 0.0439$.
  - Closing speed: $\dot{r} = 6.0\text{ m/s}$. $\text{TTC} = \frac{3.0 - 2.1 - 0.3}{6.0} = 0.10\text{ s}$.
  - $T_{\text{decay}} = \frac{1}{1.0 + 0.5(0.10)} = \frac{1}{1.05} \approx 0.9524$.
  - Scaled Risk: $R = \min(1.0, 1.60 \times 0.0439 \times 0.9524) = 1.60 \times 0.0418 = \mathbf{0.0669}$.
- **Obstacle 2 (Pedestrian directly at ego front bumper, $d = 0.5\text{ m}$)**:
  - $\Delta x = 0.5\text{ m} \implies K = \exp\left(-\frac{1}{2}\left(\frac{0.5}{1.20}\right)^2\right) = \exp(-0.0868) \approx 0.9168$.
  - Closing speed $6.0\text{ m/s} \implies \text{TTC} = 0.0\text{ s} \implies T_{\text{decay}} = 1.0$.
  - Raw product: $w_{\text{vuln}} \cdot K = 1.60 \times 0.9168 = 1.4669$.
  - Saturated Risk: $R = \min(1.0, 1.4669) = \mathbf{1.0000}$ (Saturates cleanly at unity!).
