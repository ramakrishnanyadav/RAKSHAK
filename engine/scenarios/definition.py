"""
Scenario Definitions and Protocol for Unstructured Indian Road Driving.
"""

from typing import Dict, Any, List, Optional, Tuple
from dataclasses import dataclass, field
from engine.simulation.world import SimulationWorld
from engine.apath_log.schema import EgoState


@dataclass
class ScenarioConfig:
    id: str
    name: str
    description: str
    target_distance_m: float = 80.0
    timeout_s: float = 20.0
    nominal_speed_m_s: float = 8.0
    road_width_m: float = 8.0
    ego_start_x: float = 0.0
    ego_start_y: float = 0.0
    ego_start_yaw: float = 0.0
    ego_start_v: float = 6.0
    params: Dict[str, Any] = field(default_factory=dict)


class ScenarioBuilder:
    """Interface for generating world and ego states for a given seed and split."""

    def __init__(self, config: ScenarioConfig):
        self.config = config

    def build(self, seed: int, split: str = "tune") -> Tuple[SimulationWorld, EgoState]:
        raise NotImplementedError
