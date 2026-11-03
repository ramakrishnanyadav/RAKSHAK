"""
Base Sensor Abstraction Interface with Noise, Dropout, Occlusion, and Transport Delay.
"""

import math
import random
from abc import ABC, abstractmethod
from typing import List, Tuple, Dict, Any, Optional
from dataclasses import dataclass, field
from collections import deque
from engine.simulation.vehicle import KinematicBicycleModel


@dataclass
class RawDetection:
    """Individual sensor measurement of an observed object."""
    sensor_id: str
    sensor_type: str
    agent_id: str
    class_name: str
    confidence: float
    x: float
    y: float
    yaw: float
    vx: float
    vy: float
    length: float
    width: float
    covariance: List[List[float]] = field(default_factory=list)


@dataclass
class SensorReading:
    sensor_id: str
    sensor_type: str
    timestamp: float
    detections: List[RawDetection] = field(default_factory=list)


class BaseSensor(ABC):
    """
    Abstract sensor base class providing:
    - Configurable Gaussian noise on position, heading, velocity
    - Configurable dropout probability (Pd)
    - Geometric raycast line-of-sight occlusion modeling
    - FIFO transport delay buffer (delay_steps)
    """

    def __init__(
        self,
        sensor_id: str,
        sensor_type: str,
        range_m: float,
        fov_deg: float,
        noise_pos_std: float,
        noise_yaw_std: float,
        noise_vel_std: float,
        dropout_prob: float = 0.01,
        delay_steps: int = 1,
        seed: int = 42,
    ):
        self.sensor_id = sensor_id
        self.sensor_type = sensor_type
        self.range_m = range_m
        self.fov_deg = fov_deg
        self.noise_pos_std = noise_pos_std
        self.noise_yaw_std = noise_yaw_std
        self.noise_vel_std = noise_vel_std
        self.dropout_prob = dropout_prob
        self.delay_steps = max(0, delay_steps)
        self.rng = random.Random(seed)
        self._delay_buffer: deque = deque()

    def reset(self, seed: Optional[int] = None):
        """Reset sensor internal state and delay buffers."""
        if seed is not None:
            self.rng = random.Random(seed)
        self._delay_buffer.clear()

    def is_in_fov_and_range(
        self, ego_x: float, ego_y: float, ego_yaw: float, target_x: float, target_y: float
    ) -> Tuple[bool, float]:
        """Checks if target point lies within sensor range and azimuth FOV."""
        dx = target_x - ego_x
        dy = target_y - ego_y
        dist = math.hypot(dx, dy)
        if dist > self.range_m or dist < 0.1:
            return False, dist

        half_fov = math.radians(self.fov_deg / 2.0)
        bearing = math.atan2(dy, dx)
        rel_angle = (bearing - ego_yaw + math.pi) % (2.0 * math.pi) - math.pi
        if abs(rel_angle) > half_fov:
            return False, dist

        return True, dist

    def check_occlusion(
        self,
        ego_x: float,
        ego_y: float,
        target_x: float,
        target_y: float,
        target_dist: float,
        occluders: List[Tuple[float, float, float]], # (x, y, radius)
    ) -> bool:
        """Raycasts from ego pose to target to detect if line-of-sight is blocked."""
        for ox, oy, r in occluders:
            # Skip if occluder is the target itself
            if math.hypot(target_x - ox, target_y - oy) < 0.6:
                continue
            dist_to_occluder = math.hypot(ox - ego_x, oy - ego_y)
            if dist_to_occluder >= target_dist:
                continue
            d_line = KinematicBicycleModel._point_to_segment_dist(
                (ox, oy), (ego_x, ego_y), (target_x, target_y)
            )
            if d_line < r:
                return True
        return False

    @abstractmethod
    def sense_raw(
        self,
        ego_x: float,
        ego_y: float,
        ego_yaw: float,
        agents: List[Any],
        static_obstacles: List[Any],
        current_time: float,
    ) -> List[RawDetection]:
        """Perform raw sensing without transport delay."""
        pass

    def step(
        self,
        ego_x: float,
        ego_y: float,
        ego_yaw: float,
        agents: List[Any],
        static_obstacles: List[Any],
        current_time: float,
    ) -> SensorReading:
        """
        Steps sensor: executes sense_raw, pushes to FIFO delay buffer,
        and returns reading delayed by self.delay_steps.
        """
        raw_detections = self.sense_raw(
            ego_x, ego_y, ego_yaw, agents, static_obstacles, current_time
        )
        current_reading = SensorReading(
            sensor_id=self.sensor_id,
            sensor_type=self.sensor_type,
            timestamp=current_time,
            detections=raw_detections,
        )

        if self.delay_steps == 0:
            return current_reading

        self._delay_buffer.append(current_reading)
        if len(self._delay_buffer) > self.delay_steps:
            return self._delay_buffer.popleft()
        else:
            # During warm-up frames before buffer fills, return current reading directly
            return current_reading
