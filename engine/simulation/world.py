"""
World Environment, Driveable Free-Space Boundaries, and Sensor Perception Model.
Provides non-lane-based continuous boundaries and realistic sensor noise/occlusion.
"""

import math
from typing import List, Tuple, Optional, Dict
from dataclasses import dataclass, field
import random

from .vehicle import KinematicBicycleModel
from .obstacles import TrafficAgent
from engine.apath_log.schema import WorldMap, RoadBoundary, StaticObstacle, WorldBounds


@dataclass
class PerceptionConfig:
    range_m: float = 55.0
    fov_deg: float = 140.0
    noise_pos_std: float = 0.05
    noise_yaw_std: float = 0.02
    noise_vel_std: float = 0.1
    dropout_prob: float = 0.01
    occlusion_enabled: bool = True


class SimulationWorld:
    """
    Continuous driveable space without lane markers.
    Includes road boundaries, static clutter, and perception simulation.
    """

    def __init__(
        self,
        bounds: Optional[WorldBounds] = None,
        road_boundaries: Optional[List[RoadBoundary]] = None,
        static_obstacles: Optional[List[StaticObstacle]] = None,
        perception_config: Optional[PerceptionConfig] = None,
        seed: int = 42,
    ):
        self.bounds = bounds or WorldBounds()
        self.road_boundaries = road_boundaries or []
        self.static_obstacles = static_obstacles or []
        self.dynamic_agents: List[TrafficAgent] = []
        self.perception_config = perception_config or PerceptionConfig()
        self.rng = random.Random(seed)

    def add_agent(self, agent: TrafficAgent):
        self.dynamic_agents.append(agent)

    def step(self, dt: float):
        """Step all dynamic agents."""
        bounds_tuple = (self.bounds.x_min, self.bounds.x_max, self.bounds.y_min, self.bounds.y_max)
        for agent in self.dynamic_agents:
            agent.step(dt, bounds_tuple)

    def perceive(self, ego_x: float, ego_y: float, ego_yaw: float) -> List[Dict]:
        """
        Simulate sensor perception from ego pose:
        - Filters out of range / FOV
        - Raycasts for occlusions from stalls/trucks (Occluded Emergence)
        - Injects calibrated sensor measurement noise
        - Simulates intermittent dropouts
        """
        visible_agents = []
        half_fov = math.radians(self.perception_config.fov_deg / 2.0)

        # Build list of potential occluders (stalls + large trucks)
        occluders = []
        for obj in self.static_obstacles:
            if obj.kind in ["stall", "parked_vehicle", "barrier"]:
                occluders.append((obj.x, obj.y, max(obj.length, obj.width) / 2.0))
        for agent in self.dynamic_agents:
            if agent.class_name in ["truck", "bus"]:
                occluders.append((agent.x, agent.y, agent.profile.length / 2.0))

        for agent in self.dynamic_agents:
            dx = agent.x - ego_x
            dy = agent.y - ego_y
            dist = math.hypot(dx, dy)

            # Range check
            if dist > self.perception_config.range_m or dist < 0.1:
                continue

            # FOV check
            angle_to_agent = math.atan2(dy, dx)
            relative_bearing = (angle_to_agent - ego_yaw + math.pi) % (2 * math.pi) - math.pi
            if abs(relative_bearing) > half_fov:
                continue

            # Occlusion check: ray from ego to agent
            is_occluded = False
            if self.perception_config.occlusion_enabled:
                for ox, oy, r in occluders:
                    # Don't let agent occlude itself
                    if math.hypot(agent.x - ox, agent.y - oy) < 0.5:
                        continue
                    # Distance of occluder from line segment ego -> agent
                    d_line = KinematicBicycleModel._point_to_segment_dist((ox, oy), (ego_x, ego_y), (agent.x, agent.y))
                    dist_occluder = math.hypot(ox - ego_x, oy - ego_y)
                    # If occluder is between ego and agent and radius touches ray
                    if d_line < r and dist_occluder < dist:
                        is_occluded = True
                        break

            # Simulated sensor dropout
            if self.rng.random() < self.perception_config.dropout_prob:
                is_occluded = True

            agent.is_occluded = is_occluded
            if is_occluded:
                continue

            # Add sensor measurement noise
            noisy_x = agent.x + self.rng.gauss(0, self.perception_config.noise_pos_std)
            noisy_y = agent.y + self.rng.gauss(0, self.perception_config.noise_pos_std)
            noisy_yaw = agent.yaw + self.rng.gauss(0, self.perception_config.noise_yaw_std)
            noisy_vx = agent.v_x + self.rng.gauss(0, self.perception_config.noise_vel_std)
            noisy_vy = agent.v_y + self.rng.gauss(0, self.perception_config.noise_vel_std)

            visible_agents.append({
                "agent": agent,
                "measured_x": noisy_x,
                "measured_y": noisy_y,
                "measured_yaw": noisy_yaw,
                "measured_vx": noisy_vx,
                "measured_vy": noisy_vy,
                "measured_speed": math.hypot(noisy_vx, noisy_vy),
            })

        return visible_agents

    def to_world_map_schema(self) -> WorldMap:
        return WorldMap(
            bounds=self.bounds,
            road_boundaries=self.road_boundaries,
            static_obstacles=self.static_obstacles,
        )
