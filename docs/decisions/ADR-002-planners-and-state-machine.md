# ADR-002: Planners Taxonomy, Behaviour State Machine, and Vehicle Kinematics

- **Status**: Accepted
- **Date**: 2026-10-14
- **Deciders**: Autonomous Systems Lead & Research Engineering Team

## Context
To evaluate the research hypothesis (G5: "P3 has lower collision and false-safe rates than B1 and P1, with 95% confidence intervals over at least 30 seeds per variant"), we need a rigorous ablation ladder comparing classical baselines against predictive and risk-adaptive planners.

## Decision

### 1. Six Planners Architecture:
- **B0 (Baseline 0 - Shortest Path / Constant Speed)**:
  Fixed kinematic rollout along the road center line at nominal speed with zero reactive avoidance. Serves as reference minimum-intelligence baseline.
- **B1 (Baseline 1 - DWA + Velocity Obstacles)**:
  Classical reactive crowd navigation using Dynamic Window Approach (DWA) coupled with Velocity Obstacles (VO). Reacts only within a short temporal horizon (1.0 - 1.5s) without multi-hypothesis predictive intent or risk fields.
- **B2 (Baseline 2 - Kinematic Hybrid A*)**:
  Kinematic graph search in continuous SE(2) space taking vehicle non-holonomic constraints into account with distance transforms to detected obstacles. Recomputed at low frequency.
- **P1 (Predictive Path Planning - Nominal Horizon)**:
  Uses constant-velocity / constant turn-rate trajectory prediction (CTRV) for dynamic agents. Evaluates candidate trajectory rollouts on a fixed periodic replanning cycle (e.g. every 0.5s or 1.0s).
- **P2 (Risk-Aware Path Planning)**:
  Multi-hypothesis trajectory prediction with conformal uncertainty envelopes (calibrated cones). Cost function integrates a continuous risk field $R(x, y, t)$ penalizing high-risk interaction zones. Runs on a fixed time clock.
- **P3 (Adaptive Replanning on Risk Trigger + Minimal-Risk Manoeuvre MRM)**:
  Continuously monitors an analytical risk-trigger condition $\Delta R = R_{\text{envelope}} - R_{\text{nominal}}$ and conformal coverage violation. Replanning is triggered dynamically whenever risk crosses an adaptive threshold ($\tau_{\text{risk}}$), bypassing the fixed clock. Includes a calibrated Minimal-Risk Manoeuvre (MRM) fallback: if epistemic uncertainty exceeds $\sigma_{\max}$, execution switches to an emergency brake / controlled stop safe stop.

### 2. Vehicle Model:
Kinematic bicycle model:
$$\dot{x} = v \cos(\psi + \beta)$$
$$\dot{y} = v \sin(\psi + \beta)$$
$$\dot{\psi} = \frac{v}{L} \sin(\beta)$$
$$\dot{v} = a$$
where slip angle $\beta = \arctan\left(\frac{l_r}{L} \tan(\delta)\right)$, subject to steering angle limits $|\delta| \le \delta_{\max}$, acceleration limits $a_{\min} \le a \le a_{\max}$, and jerk rate limits.

### 3. Behaviour State Machine:
States:
1. `FOLLOW`: Clear ahead, track optimal progress speed.
2. `SLOW`: Impending interaction or increased background risk.
3. `YIELD`: Predicted conflicting trajectory; slow or pause to allow other road user right-of-way.
4. `BYPASS`: Sufficient road free space outside vehicle path; navigate around stationary or slow obstacle without lane boundaries.
5. `STOP`: Object blocking driveable corridor; controlled brake to 0 m/s.
6. `EMERGENCY_BRAKE (MRM)`: High imminent risk or extreme sensor uncertainty; apply maximum deceleration within traction limits.

## Consequences
- Every planner shares the identical vehicle interface: given current state, world boundaries, detected agents, and predictions, return selected steering $\delta$ and acceleration $a$.
- Determinism is preserved by strictly seeding all stochastic processes (agent perturbations, initial speeds).
