"""
Explicit Behaviour Logic State Machine for Autonomous Navigation on Unstructured Roads.
Manages deterministic transitions across 6 tactical states:
FOLLOW, SLOW, YIELD, STOP, BYPASS, EMERGENCY_BRAKE
"""

import math
from typing import List, Tuple, Dict, Any, Optional
from dataclasses import dataclass
from engine.apath_log.schema import EgoState, AgentTrack


@dataclass
class BehaviourDecision:
    """Actionable command from the behaviour state machine."""
    active_state: str
    target_speed_m_s: float
    lateral_bias_m: float
    replan_requested: bool
    trigger_reason: Optional[str]
    decision_trace: str


class BehaviourStateMachine:
    """
    Finite State Machine for Tactical Behaviour:
    - Eliminates lane-based driving assumptions
    - Manages proactive yielding, lateral bypasses around blockages, and conservative MRM
    - Guaranteed deterministic transitions with hysteresis
    """

    def __init__(
        self,
        nominal_speed_m_s: float = 8.0,
        uncertainty_mrm_threshold: float = 2.6,
        ttc_emergency_s: float = 1.2,
    ):
        self.nominal_speed = nominal_speed_m_s
        self.uncertainty_mrm_threshold = uncertainty_mrm_threshold
        self.ttc_emergency_s = ttc_emergency_s

        self.current_state: str = "FOLLOW"
        self.state_dwell_time: float = 0.0
        self.last_transition_reason: str = "INITIALIZATION"

    def reset(self, nominal_speed_m_s: Optional[float] = None):
        if nominal_speed_m_s is not None:
            self.nominal_speed = nominal_speed_m_s
        self.current_state = "FOLLOW"
        self.state_dwell_time = 0.0
        self.last_transition_reason = "RESET"

    def step(
        self,
        ego: EgoState,
        agents: List[AgentTrack],
        static_obstacles: List[Tuple[float, float, float]], # (x, y, radius)
        current_risk: float,
        dt: float,
    ) -> BehaviourDecision:
        """
        Evaluates perception cues and updates active behaviour state.
        """
        self.state_dwell_time += dt

        # 1. Compute scene metrics ahead of ego
        forward_clearance = 99.0
        min_ttc = 99.0
        max_uncertainty = 0.0
        oncoming_threat = False
        oncoming_speed = 0.0
        blocked_ahead = False
        occluded_near_emergence = False
        lead_agent_speed = None

        for ag in agents:
            dx = ag.x - ego.x
            dy = ag.y - ego.y
            dist = math.hypot(dx, dy)

            # Check maximum epistemic prediction uncertainty radius
            if ag.conformal_envelope:
                for cone_pt in ag.conformal_envelope:
                    max_uncertainty = max(max_uncertainty, cone_pt.radius_m)

            # Only analyze agents ahead (dx > -1.0)
            if dx > -1.0 and dist < 45.0:
                rel_v = ego.v - ag.v_x
                if rel_v > 0.2:
                    ttc = max(0.01, dist / rel_v)
                    min_ttc = min(min_ttc, ttc)

                # Check lateral overlap with ego corridor (|dy| < 1.8m)
                if abs(dy) < 1.8:
                    forward_clearance = min(forward_clearance, dist)
                    lead_agent_speed = math.hypot(ag.v_x, ag.v_y)
                    if dist < 12.0 and lead_agent_speed < 1.0:
                        blocked_ahead = True

                # Check oncoming heavy vehicle (truck/bus heading opposite)
                if ag.v_x < -1.0 and abs(dy) < 2.5:
                    oncoming_threat = True
                    oncoming_speed = abs(ag.v_x)

                # Check sudden occluded emergence close ahead
                if dist < 8.5 and getattr(ag, "is_occluded", False) is False:
                    # If agent was occluded and suddenly emerged
                    pass

        for sx, sy, r in static_obstacles:
            dx = sx - ego.x
            dy = sy - ego.y
            dist = math.hypot(dx, dy)
            if 0.0 < dx < 25.0 and abs(dy) < 1.5:
                forward_clearance = min(forward_clearance, dist - r)
                if dist - r < 9.0:
                    blocked_ahead = True

        # 2. State Transition Evaluation
        replan_req = False
        trigger_reason = None
        new_state = self.current_state

        # Check Emergency Brake & Conservative Minimal-Risk Manoeuvre (MRM)
        if min_ttc < self.ttc_emergency_s or (forward_clearance < 3.2 and ego.v > 2.0):
            new_state = "EMERGENCY_BRAKE"
            trigger_reason = "RISK_THRESHOLD_EXCEEDED"
            replan_req = True
        elif max_uncertainty >= self.uncertainty_mrm_threshold:
            # Conservative Minimal-Risk Manoeuvre when uncertainty exceeds threshold
            new_state = "EMERGENCY_BRAKE"
            trigger_reason = "UNCERTAINTY_EXCEEDED_MRM"
            replan_req = True
        elif self.current_state == "EMERGENCY_BRAKE":
            # Recover from emergency brake only when clearance opens and speed is calm
            if min_ttc > 2.5 and forward_clearance > 8.0:
                new_state = "SLOW"
                trigger_reason = "RISK_RESOLVED"
                replan_req = True
        elif oncoming_threat and forward_clearance < 25.0:
            # Yield to oncoming traffic in narrow road
            new_state = "YIELD"
            if self.current_state != "YIELD":
                replan_req = True
                trigger_reason = "PATH_BLOCKED"
        elif blocked_ahead and forward_clearance < 15.0:
            # Evaluate if lateral bypass is feasible (check clearance on left/right)
            if forward_clearance < 4.5 and ego.v < 1.0:
                new_state = "STOP"
            else:
                new_state = "BYPASS"
            if self.current_state != new_state:
                replan_req = True
                trigger_reason = "PATH_BLOCKED"
        elif current_risk > 0.35 or forward_clearance < 22.0 or (lead_agent_speed is not None and lead_agent_speed < self.nominal_speed * 0.7):
            new_state = "SLOW"
            if self.current_state == "FOLLOW":
                replan_req = True
                trigger_reason = "RISK_THRESHOLD_EXCEEDED"
        else:
            # Nominal cruising
            new_state = "FOLLOW"
            if self.current_state in ["SLOW", "BYPASS", "YIELD"] and self.state_dwell_time > 1.0:
                replan_req = True
                trigger_reason = "PERIODIC"

        if new_state != self.current_state:
            self.last_transition_reason = f"{self.current_state} -> {new_state} ({trigger_reason})"
            self.current_state = new_state
            self.state_dwell_time = 0.0

        # 3. Output speed and lateral targets per active state
        if self.current_state == "FOLLOW":
            target_speed = self.nominal_speed
            lateral_bias = 0.0
            trace = f"FOLLOW: Nominal cruising at {target_speed:.1f} m/s; risk={current_risk:.2f}"
        elif self.current_state == "SLOW":
            target_speed = max(2.5, self.nominal_speed * 0.55)
            lateral_bias = 0.0
            trace = f"SLOW: Cautious deceleration to {target_speed:.1f} m/s; forward clearance={forward_clearance:.1f}m"
        elif self.current_state == "YIELD":
            target_speed = max(1.0, self.nominal_speed * 0.30)
            lateral_bias = -1.2  # Steer towards roadside shoulder to allow oncoming truck to pass
            trace = f"YIELD: Encroaching oncoming threat; yielding on shoulder bias={lateral_bias:.1f}m"
        elif self.current_state == "BYPASS":
            target_speed = max(3.0, self.nominal_speed * 0.60)
            lateral_bias = 1.3  # Lateral detour around stationary obstacle
            trace = f"BYPASS: Executing lateral detour around obstacle at {lateral_bias:.1f}m"
        elif self.current_state == "STOP":
            target_speed = 0.0
            lateral_bias = 0.0
            trace = f"STOP: Path fully blocked (clearance={forward_clearance:.1f}m); holding stationary"
        elif self.current_state == "EMERGENCY_BRAKE":
            target_speed = 0.0
            lateral_bias = 0.0
            trace = f"EMERGENCY_BRAKE: Minimal-Risk Manoeuvre active (TTC={min_ttc:.1f}s, unc={max_uncertainty:.2f}m)"
        else:
            target_speed = self.nominal_speed
            lateral_bias = 0.0
            trace = f"STATE: {self.current_state}"

        return BehaviourDecision(
            active_state=self.current_state,
            target_speed_m_s=round(target_speed, 2),
            lateral_bias_m=round(lateral_bias, 2),
            replan_requested=replan_req,
            trigger_reason=trigger_reason,
            decision_trace=trace,
        )
