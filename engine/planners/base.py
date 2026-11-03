"""
Base Planner Interface and Common Trajectory Representation.
"""

from abc import ABC, abstractmethod
from typing import List, Tuple, Dict, Any, Optional
from dataclasses import dataclass
from engine.simulation.vehicle import KinematicBicycleModel, VehicleParameters
from engine.simulation.world import SimulationWorld
from engine.apath_log.schema import EgoState, AgentTrack, PlannerOutput, CostBreakdown, PlannedPose


@dataclass
class PlannerStepResult:
    steer: float
    accel: float
    active_state: str # "FOLLOW", "SLOW", "YIELD", "STOP", "BYPASS", "EMERGENCY_BRAKE"
    planned_trajectory: List[Tuple[float, float, float]] # [(x, y, v), ...]
    replan_triggered: bool
    trigger_reason: Optional[str]
    cost_breakdown: CostBreakdown
    decision_trace: str


class BasePlanner(ABC):
    """Abstract base class for autonomous path planners."""

    def __init__(self, id: str, name: str, params: Optional[Dict[str, Any]] = None):
        self.id = id
        self.name = name
        self.params = params or {}
        self.vehicle_model = KinematicBicycleModel()
        self.target_speed: float = self.params.get("target_speed", 8.0) # m/s (~29 km/h)
        self.last_planned_trajectory: List[Tuple[float, float, float]] = []
        self.time_since_replan: float = 999.0

    @abstractmethod
    def reset(self):
        """Reset internal planner state for a new run."""
        self.last_planned_trajectory = []
        self.time_since_replan = 999.0

    @abstractmethod
    def step(
        self,
        ego: EgoState,
        world: SimulationWorld,
        visible_agents: List[AgentTrack],
        dt: float,
        current_time: float,
    ) -> PlannerStepResult:
        """
        Execute one control cycle:
        Given current ego state, perceived world, and detected agents,
        compute steering, acceleration, and diagnostic trace.
        """
        pass
