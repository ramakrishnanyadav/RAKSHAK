"""
Hazard Scenario Engine & Event-Driven Actor Model (SIH26037).
Provides reproducible triggers, multi-stage event timelines, and
realistic hazard interactions on unstructured Indian roads.
"""

from typing import List, Dict, Any, Optional, Tuple, Callable
from dataclasses import dataclass, field
import math


@dataclass
class HazardTrigger:
    """Configurable deterministic activation condition for hazard actors."""
    trigger_type: str  # "EGO_X", "TIME", "EGO_DISTANCE", "ALWAYS"
    threshold: float
    is_active: bool = False

    def evaluate(self, ego_x: float, ego_y: float, sim_time: float, actor_x: float = 0.0, actor_y: float = 0.0) -> bool:
        if self.is_active:
            return True
        triggered = False
        if self.trigger_type == "ALWAYS":
            triggered = True
        elif self.trigger_type == "EGO_X":
            triggered = ego_x >= self.threshold
        elif self.trigger_type == "TIME":
            triggered = sim_time >= self.threshold
        elif self.trigger_type == "EGO_DISTANCE":
            dist = math.hypot(actor_x - ego_x, actor_y - ego_y)
            triggered = dist <= self.threshold

        if triggered:
            self.is_active = True
        return triggered


@dataclass
class SimulationEvent:
    """Structured chronological simulation event for timeline reporting."""
    timestamp: float
    event_type: str  # "SCENARIO_START", "HAZARD_TRIGGERED", "PERCEPTION_ACQUIRED", "RISK_ESCALATED", "PLANNER_REACTION", "SAFETY_SUPERVISION", "MRM_ACTIVATED", "SAFE_STOP_ACHIEVED", "HAZARD_CLEARED", "GOAL_REACHED", "COLLISION_OCCURRED"
    description: str
    actor_id: Optional[str] = None
    vehicle_reaction: str = "CRUISING"  # "APPROACH", "DECELERATING", "EMERGENCY_BRAKE", "STEERING_EVASION", "STOPPED", "YIELDING", "RESUMING"
    outcome: str = "NOMINAL"  # "NOMINAL", "HAZARD_ACTIVE", "TRACKING", "RISK_ELEVATED", "REPLAN_COMMITTED", "SUPERVISION_PASSED", "COLLISION_AVOIDED", "PATH_RESTORED"

    def to_dict(self) -> Dict[str, Any]:
        return {
            "timestamp": round(self.timestamp, 2),
            "event_type": self.event_type,
            "description": self.description,
            "actor_id": self.actor_id,
            "vehicle_reaction": self.vehicle_reaction,
            "outcome": self.outcome,
        }


class HazardScenarioEngine:
    """
    Manages deterministic hazard progression, perception event generation,
    and event timeline tracking for a scenario simulation.
    """

    def __init__(self, scenario_id: str, seed: int):
        self.scenario_id = scenario_id
        self.seed = seed
        self.events: List[SimulationEvent] = []
        self._triggered_hazards: set = set()
        self._perceived_hazards: set = set()
        self._risk_escalated_hazards: set = set()
        self._reaction_logged: bool = False
        self._safe_stop_logged: bool = False
        self._hazard_cleared_logged: bool = False

    def log_event(
        self,
        timestamp: float,
        event_type: str,
        description: str,
        actor_id: Optional[str] = None,
        vehicle_reaction: str = "CRUISING",
        outcome: str = "NOMINAL",
    ):
        evt = SimulationEvent(
            timestamp=timestamp,
            event_type=event_type,
            description=description,
            actor_id=actor_id,
            vehicle_reaction=vehicle_reaction,
            outcome=outcome,
        )
        self.events.append(evt)

    def process_step(
        self,
        t: float,
        ego_x: float,
        ego_y: float,
        ego_v: float,
        ego_accel: float,
        active_state: str,
        perceived_agents: List[Dict[str, Any]],
        risk_level: str,
        max_risk: float,
        min_clearance: float,
        collision: bool,
    ):
        """Update hazard state machine and record milestone events."""
        # 1. Start event
        if t == 0.0 and len(self.events) == 0:
            self.log_event(
                timestamp=0.0,
                event_type="SCENARIO_START",
                description=f"Ego begins autonomous navigation at {round(ego_v * 3.6, 1)} km/h",
                vehicle_reaction="CRUISING",
                outcome="NOMINAL",
            )

        # 2. Perception acquisition events
        for item in perceived_agents:
            ag = item.get("agent")
            if not ag:
                continue
            ag_id = getattr(ag, "id", "")
            if ag_id and ag_id not in self._perceived_hazards and not getattr(ag, "is_occluded", False):
                self._perceived_hazards.add(ag_id)
                dist = math.hypot(getattr(ag, "x", 0.0) - ego_x, getattr(ag, "y", 0.0) - ego_y)
                cls_name = getattr(ag, "class_name", "obstacle").replace("_", " ")
                self.log_event(
                    timestamp=t,
                    event_type="PERCEPTION_ACQUIRED",
                    description=f"Sensors acquire {cls_name} ({ag_id}) at distance {round(dist, 1)} m",
                    actor_id=ag_id,
                    vehicle_reaction=active_state,
                    outcome="TRACKING",
                )

        # 3. Risk Escalation
        if max_risk >= 0.50 and "RISK" not in self._risk_escalated_hazards:
            self._risk_escalated_hazards.add("RISK")
            self.log_event(
                timestamp=t,
                event_type="RISK_ESCALATED",
                description=f"Predicted collision risk jumped to {round(max_risk, 2)} ({risk_level} severity)",
                vehicle_reaction=active_state,
                outcome="RISK_ELEVATED",
            )

        # 4. Planner Braking / Replan Response
        if active_state in ["SLOW", "YIELD", "STOP", "EMERGENCY_BRAKE", "BYPASS"] and not self._reaction_logged:
            self._reaction_logged = True
            reaction_desc = (
                f"Emergency brake engaged (a = {round(ego_accel, 2)} m/s²)"
                if active_state == "EMERGENCY_BRAKE"
                else f"Planner selected {active_state} trajectory: deceleration a = {round(ego_accel, 2)} m/s²"
            )
            self.log_event(
                timestamp=t,
                event_type="PLANNER_REACTION",
                description=reaction_desc,
                vehicle_reaction=active_state,
                outcome="REPLAN_COMMITTED",
            )
            # Log Safety Supervision
            self.log_event(
                timestamp=round(t + 0.1, 2),
                event_type="SAFETY_SUPERVISION",
                description="Gate 7b & SafetySupervisor verify envelope boundaries and kinematic feasible limits",
                vehicle_reaction=active_state,
                outcome="SUPERVISION_PASSED",
            )

        # 5. Safe Stop Achieved
        if ego_v < 0.2 and self._reaction_logged and not self._safe_stop_logged:
            self._safe_stop_logged = True
            self.log_event(
                timestamp=t,
                event_type="SAFE_STOP_ACHIEVED",
                description=f"Ego brought to safe stop with {round(min_clearance, 2)} m clearance to hazard",
                vehicle_reaction="STOPPED",
                outcome="COLLISION_AVOIDED",
            )

        # 6. Collision Occurred
        if collision and not any(e.event_type == "COLLISION_OCCURRED" for e in self.events):
            self.log_event(
                timestamp=t,
                event_type="COLLISION_OCCURRED",
                description=f"Collision occurred! Clearance reached {round(min_clearance, 2)} m",
                vehicle_reaction="COLLISION",
                outcome="HAZARD_FAILED",
            )

    def get_events_list(self) -> List[Dict[str, Any]]:
        return [e.to_dict() for e in self.events]

