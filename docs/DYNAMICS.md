# ADAPTIVE-PATH — Vehicle Dynamics Audit

> **Scope**: Mathematical & physical constraint audit of simulated ego vehicle, kinematic bicycle model, controllers, and trajectory planners.  
> **Date**: 2026-11-03  
> **Status**: Phase 0 Baseline Audit

---

## 1. Kinematic Model & Physical Parameter Specifications

The ego vehicle dynamics are modeled in [`engine/simulation/vehicle.py`](file:///c:/Users/Ramakrishna/Downloads/MINI/engine/simulation/vehicle.py) via a Kinematic Bicycle Model parameterized at the center of gravity (CG):

$$\dot{x} = v \cos(\psi + \beta)$$
$$\dot{y} = v \sin(\psi + \beta)$$
$$\dot{\psi} = \frac{v}{L} \cos(\beta) \tan(\delta)$$
$$\dot{v} = a$$
$$\beta = \arctan\left(\frac{l_r}{L} \tan(\delta)\right)$$

### Parameter Specifications Table

| Parameter | Symbol | Nominal Value | Enforced at Model (`vehicle.py`) | Enforced at Controller | Enforced at Planner (`P3`) |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Length** | $L_{\text{veh}}$ | $4.2\text{ m}$ | SAT Polygon | SAT Polygon | SAT / Point distance |
| **Width** | $W_{\text{veh}}$ | $1.8\text{ m}$ | SAT Polygon | SAT Polygon | SAT / Point distance |
| **Wheelbase** | $L$ | $2.6\text{ m}$ | Yes ($\dot{\psi}$ derivative) | Kinematic equations | Kinematic rollout |
| **CG to Rear Axle** | $l_r$ | $1.3\text{ m}$ | Yes ($\beta$ slip angle) | N/A | Kinematic rollout |
| **Max Steering Angle** | $\delta_{\max}$ | $\pm 0.60\text{ rad}$ ($\approx 34.38^\circ$) | **Yes** (`max(-0.60, min(0.60, \delta))`) | Saturated in Pure Pursuit | Clamped |
| **Max Steering Rate** | $\dot{\delta}_{\max}$ | $0.80\text{ rad/s}$ | **NO (Unenforced)** | **NO (Unenforced)** | **NO (Unenforced)** |
| **Max Acceleration** | $a_{\max}$ | $+2.5\text{ m/s}^2$ | **Yes** (Clamped in `step`) | Clamped in PID | Target velocity step |
| **Max Deceleration** | $a_{\min}$ | $-6.5\text{ m/s}^2$ | **Yes** (Clamped in `step`) | MRM uses $-5.8\text{ m/s}^2$ | Heuristic braking |
| **Max Longitudinal Jerk** | $j_{\max}$ | $10.0\text{ m/s}^3$ | **NO (Unenforced)** | **NO (Unenforced)** | **NO (Unenforced)** |
| **Max Forward Velocity** | $v_{\max}$ | Scenario dependent ($8\text{--}12\text{ m/s}$) | Non-negative only ($v \ge 0$) | Clamped by target | Sampled ($s_{\text{ratio}} \le 1.0$) |
| **Min Forward Velocity** | $v_{\min}$ | $0.0\text{ m/s}$ | **Yes** (`max(0.0, ...)`) | No reverse gear | Non-negative |
| **Max Path Curvature** | $\kappa_{\max}$ | $\approx 0.231\text{ m}^{-1}$ ($R_{\min} \approx 4.33\text{ m}$) | Implicit through $\delta_{\max}$ | Pure pursuit lookahead | Dependent on rollout |

---

## 2. Enforced vs. Unenforced Physical Constraints

### 2.1 Enforced Constraints
1. **Steering Angle Saturation**: Clamped strictly to $[-0.60, +0.60]$ radians in [`engine/simulation/vehicle.py:59`](file:///c:/Users/Ramakrishna/Downloads/MINI/engine/simulation/vehicle.py#L59).
2. **Acceleration Saturation**: Clamped to $[-6.5, +2.5]\text{ m/s}^2$ in [`engine/simulation/vehicle.py:60`](file:///c:/Users/Ramakrishna/Downloads/MINI/engine/simulation/vehicle.py#L60).
3. **No-Reverse Invariant**: Velocity bounded below by $0.0\text{ m/s}$ in [`engine/simulation/vehicle.py:72`](file:///c:/Users/Ramakrishna/Downloads/MINI/engine/simulation/vehicle.py#L72).
4. **Collision Geometry**: Full oriented bounding box SAT polygon intersection checked in [`engine/simulation/vehicle.py:94-118`](file:///c:/Users/Ramakrishna/Downloads/MINI/engine/simulation/vehicle.py#L94-L118).

### 2.2 Unenforced Constraints & Known Physical Vulnerabilities
1. **Steering Rate Limits ($\dot{\delta}$)**:
   - While `VehicleParameters.max_steer_rate_rad_s = 0.8` is defined in [`engine/simulation/vehicle.py:22`](file:///c:/Users/Ramakrishna/Downloads/MINI/engine/simulation/vehicle.py#L22), the integration method `step()` does **not** limit $\frac{\Delta \delta}{\Delta t}$.
   - *Impact*: In a single simulation cycle of $\Delta t = 0.1\text{ s}$, the steering angle can theoretically jump from $-0.60$ to $+0.60$ rad, implying an instantaneous steering rate of $12.0\text{ rad/s}$ ($15\times$ physical vehicle actuator limits).
2. **Jerk Limiting ($j = \dot{a}$)**:
   - `VehicleParameters.max_jerk_m_s3 = 10.0` is defined in [`engine/simulation/vehicle.py:23`](file:///c:/Users/Ramakrishna/Downloads/MINI/engine/simulation/vehicle.py#L23), but neither `vehicle.step()` nor the PID controllers enforce rate of change on acceleration.
   - Sudden transitions (e.g. from cruise $+1.5\text{ m/s}^2$ to MRM emergency braking $-5.8\text{ m/s}^2$ in $0.1\text{ s}$) produce instantaneous numerical jerks of up to $73.0\text{ m/s}^3$.
3. **Lateral Tire Friction & Centripetal Acceleration**:
   - The kinematic model does not include a dynamic tire slip friction circle ($a_y = v^2 \kappa \le \mu g$).
   - Sharp cornering at higher speeds can exceed typical friction limits ($\mu \approx 0.7$ dry, $\mu \approx 0.3$ unpaved shoulder).

---

## 3. P3 Planned Trajectory Feasibility Audit

### Evidence from `engine/planners/p3_adaptive.py`:
1. **Discontinuous Velocity Steps**:
   - In [`engine/planners/p3_adaptive.py:86`](file:///c:/Users/Ramakrishna/Downloads/MINI/engine/planners/p3_adaptive.py#L86), acceleration is computed as:
     $$\text{accel} = \min(1.5, \max(-3.5, (\text{target\_pt}[2] - \text{ego.v}) \times 0.95))$$
   - While this prevents exceeding $[-3.5, +1.5]\text{ m/s}^2$ during regular tracking, MRM intervention ([line 121](file:///c:/Users/Ramakrishna/Downloads/MINI/engine/planners/p3_adaptive.py#L121)) immediately demands $-5.8\text{ m/s}^2$ without rate limiting.
2. **Candidate Trajectory Generation**:
   - Candidate rollouts in [`p3_adaptive.py:165-168`](file:///c:/Users/Ramakrishna/Downloads/MINI/engine/planners/p3_adaptive.py#L165-L168) use `steer_cmd = -0.38 * ey - 0.75 * curr_yaw` stepped via `vehicle_model.step()`.
   - Because `vehicle_model.step()` enforces $\delta \in [-0.60, +0.60]$, the candidate waypoints themselves obey steering angle limits.
   - However, they do not account for steering rate lag or actuation delays.
3. **Completion vs Collision Trade-Off (Finding F3 Correlation)**:
   - When risk ahead exceeds thresholds, candidate speeds with $s_{\text{ratio}} = 0.0$ are selected to minimize risk integral $\int R(t) dt$.
   - Because the risk field penalty dominates over progress reward, the vehicle frequently stops permanently, leading to $0.0\%$ collisions but $0.0\%$ goal completion on test runs.

