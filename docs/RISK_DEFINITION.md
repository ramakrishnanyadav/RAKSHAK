# ADAPTIVE-PATH — Formal Potential Risk Field Definition

> **Version**: 1.0.0-draft  
> **Status**: Proposed for Gate G2 Review  
> **Date**: 2026-11-03  
> **Scope**: Mathematical specification of the continuous potential risk field $R(x, y, t)$, distinguishing collision probability, vulnerability severity, road boundary constraints, and conformal epistemic uncertainty.

---

## 1. Conceptual Framework: Probability, Severity & Dimensionless Risk

Autonomous path planning in unstructured Indian traffic requires quantifying risk beyond simple binary obstacle occupancy. The ADAPTIVE-PATH risk formulation separates risk into three distinct physical and probabilistic layers:

1. **Collision Likelihood ($P_{\text{collision}}$)**: The spatial-temporal probability that the ego vehicle's bounding geometry will intersect the obstacle or road boundary within the prediction horizon.
2. **Hazard Severity ($S$)**: The expected damage, kinetic energy transfer, or human vulnerability in the event of an impact, parameterized by obstacle classification and closing speed.
3. **Continuous Potential Risk Field ($R(x, y, t)$)**: A normalized, dimensionless scalar field $\in [0.0, 1.0]$ defined over the Cartesian road plane $(x, y)$ that serves as an artificial repulsive potential in trajectory evaluation.

$$\text{Risk}(x, y, t) = f\Big(P_{\text{collision}}(x, y, t), S(\text{class}, v_{\text{rel}}), U_{\text{epistemic}}(t), \mathcal{B}_{\text{road}}(y)\Big)$$

---

## 2. Mathematical Formulation of the Risk Components

The total continuous risk $R(x, y)$ evaluated at any spatial point $(x, y)$ at time $t$ is the bounded supremum of four interacting components:

$$R(x, y) = \min\left(1.0, \max\Big(R_{\text{dynamic}}(x, y), R_{\text{static}}(x, y), R_{\text{boundary}}(y)\Big) + R_{\text{uncertainty}}(x, y)\right)$$

### 2.1 Dynamic Agent Risk ($R_{\text{dynamic}}$)
For each detected dynamic agent $j \in \{1, \dots, M\}$ with position $(x_j, y_j)$, velocity $(v_{x, j}, v_{y, j})$, dimensions $(L_j, W_j)$, and class $c_j$:

$$R_{\text{dynamic}, j}(x, y) = w_{\text{vuln}}(c_j) \cdot \exp\left(-\frac{d_j^2(x, y)}{2 \sigma_{j}^2}\right) \cdot \frac{1}{1.0 + \gamma \cdot \max(0, \text{TTC}_j)}$$

#### 1. Vulnerability Severity Weights ($w_{\text{vuln}}$)
Derived from road user vulnerability hierarchy (vulnerable road users VRU prioritized):

| Agent Class ($c_j$) | Weight $w_{\text{vuln}}$ | Physical Justification |
| :--- | :---: | :--- |
| **Pedestrian** | $1.60$ | Unprotected human life; maximum severity penalty. |
| **Cattle / Livestock** | $1.40$ | High mass, unpredictable sudden halts, large collision hazard. |
| **Handcart / Vendor** | $1.30$ | Low speed, manual operator, lateral vulnerability. |
| **Two-Wheeler (Motorbike/Bicycle)** | $1.20$ | High speed variability, high injury vulnerability to rider. |
| **Auto-Rickshaw (Three-Wheeler)** | $1.10$ | Semi-enclosed light chassis, high rollover risk on side impact. |
| **Car / Light Vehicle** | $1.00$ | Standard enclosed collision baseline. |
| **Heavy Truck / Bus** | $1.00$ | High mass hazard to ego, standard passive structural safety. |

#### 2. Dynamic Spatial Dispersion ($\sigma_j$)
The Gaussian spatial kernel expands with agent speed and bounding size:
$$\sigma_j = \max\left(1.20, 0.50(L_j + W_j) + 0.15 \sqrt{v_{x, j}^2 + v_{y, j}^2}\right)$$

#### 3. Temporal Discount Factor ($\text{TTC}_j$)
Closing speed towards the evaluation point:
$$v_{\text{closing}} = \max\left(0.50, v_{\text{ego}} + \sqrt{v_{x, j}^2 + v_{y, j}^2}\right)$$
$$\text{TTC}_j = \frac{d_j(x, y)}{v_{\text{closing}}}$$
With temporal discount coefficient $\gamma = 0.50\text{ s}^{-1}$.

---

### 2.2 Static Obstacle Risk ($R_{\text{static}}$)
For static road hazards (potholes, stalled vehicles, debris, barricades) defined by center $(s_x, s_y)$ and physical radius $r_s$:

$$R_{\text{static}}(x, y) = \begin{cases} 
1.0 & \text{if } d(x, y) \le r_s \\
\exp\left(-\frac{(d(x, y) - r_s)^2}{2 \sigma_{\text{static}}^2}\right) & \text{if } d(x, y) > r_s 
\end{cases}$$
Where $\sigma_{\text{static}} = 1.0\text{ m}$.

---

### 2.3 Road Boundary & Shoulder Repulsive Potential ($R_{\text{boundary}}$)
Unstructured Indian roads feature narrow asphalt ($y \in [-3.5, +3.5]\text{ m}$) bordered by unpaved, uneven dirt shoulders extending to lateral limits ($y = \pm 4.70\text{ m}$):

$$R_{\text{boundary}}(y) = \begin{cases}
0.0 & \text{if } |y| \le y_{\text{asphalt}} = 3.50\text{ m} \\
0.40 \cdot \left(\frac{|y| - 3.50}{4.70 - 3.50}\right)^2 & \text{if } 3.50\text{ m} < |y| \le 4.70\text{ m} \quad \text{(Shoulder penalty)} \\
1.0 & \text{if } |y| > 4.70\text{ m} \quad \text{(Off-road barrier)}
\end{cases}$$

- **Operational Meaning**: Driving on the unpaved shoulder is allowed during evasive bypass (e.g. oncoming truck on narrow road), but incurs a calibrated cost penalty ($R \le 0.40$) to prevent unnecessary shoulder riding.

---

### 2.4 Conformal Epistemic Uncertainty Component ($R_{\text{uncertainty}}$)
When dynamic agents have active conformal prediction cones with radius $r_{\text{cone}}(t_{\text{rel}})$, uncertainty directly inflates the potential field:

$$R_{\text{uncertainty}}(x, y) = \sum_{j=1}^M \alpha_{\text{conf}} \cdot \mathbb{I}\Big((x, y) \in \mathcal{C}_j(t_{\text{rel}})\Big) \cdot \left(\frac{r_{\text{cone}, j}(t_{\text{rel}})}{r_{\max}}\right)$$
Where $\alpha_{\text{conf}} = 0.25$ and $r_{\max} = 3.50\text{ m}$.

---

## 3. Coordinate Frame, Temporal Grid & Operational Tiers

### Coordinate Frame Conventions
- **Origin**: Initial ego vehicle start location $(0, 0)$.
- **X-Axis**: Forward longitudinal road centerline (eastbound, meters).
- **Y-Axis**: Lateral displacement (northbound positive, meters).
- **Temporal Resolution**: Evaluated at simulation rate $\Delta t = 0.10\text{ s}$ ($10\text{ Hz}$).

### Operational Risk Tiers & Replanning Thresholds

| Risk Tier | Potential Value $R$ | Vehicle State Behavior | Event Trigger Action |
| :--- | :---: | :--- | :--- |
| **LOW** | $0.00 \le R < 0.30$ | Nominal cruising | Execute planned trajectory without replan. |
| **MEDIUM** | $0.30 \le R < 0.60$ | Alert forward monitoring | Periodic trajectory check; no dynamic jump. |
| **HIGH** | $0.60 \le R < 0.85$ | Active collision mitigation | **Dynamic replan fired** ($\Delta R > 0.20$ or conformal cone intersection). |
| **CRITICAL** | $R \ge 0.85$ | **Emergency intervention** | **Immediate Replan / Minimal-Risk Manoeuvre (MRM)** emergency stop. |

### Dynamic Replan Jump Condition
Replanning fires dynamically at cycle $k$ if:
$$\Delta R_k = R_{\text{ego}}(t_k) - R_{\text{ego}}(t_{k-1}) \ge \Delta R_{\text{threshold}} = 0.20$$
$$\lor \quad \exists j, m : \mathcal{C}_j(t_m) \cap \mathcal{X}_{\text{planned}}(t_m) \neq \emptyset$$
$$\lor \quad R_{\text{ego}}(t_k) \ge 0.85 \quad (\text{Critical Tier})$$
Subject to a cooldown refractory period: $\Delta t_{\text{since\_last\_replan}} \ge 0.20\text{ s}$ to prevent actuator thrashing.
