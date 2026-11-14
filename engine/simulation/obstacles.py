"""
Indian Mixed-Traffic Road Agents.
Models realistic, non-lane-bound, heterogeneous vehicles, animals, and pedestrians.
"""

import math
from typing import Tuple, List, Optional
from dataclasses import dataclass, field
import random


@dataclass
class AgentProfile:
    class_name: str
    length: float
    width: float
    nominal_speed: float
    max_accel: float
    max_yaw_rate: float
    vulnerability_weight: float # Used for risk field weighting (cattle/pedestrians higher)


AGENT_PROFILES = {
    "auto_rickshaw": AgentProfile("auto_rickshaw", length=2.8, width=1.3, nominal_speed=6.0, max_accel=1.5, max_yaw_rate=0.8, vulnerability_weight=1.2),
    "two_wheeler": AgentProfile("two_wheeler", length=1.8, width=0.7, nominal_speed=8.0, max_accel=2.5, max_yaw_rate=1.2, vulnerability_weight=1.5),
    "pedestrian": AgentProfile("pedestrian", length=0.6, width=0.6, nominal_speed=1.2, max_accel=1.0, max_yaw_rate=1.5, vulnerability_weight=3.0),
    "cattle": AgentProfile("cattle", length=2.4, width=1.1, nominal_speed=1.0, max_accel=0.8, max_yaw_rate=0.4, vulnerability_weight=2.5),
    "truck": AgentProfile("truck", length=8.5, width=2.5, nominal_speed=7.0, max_accel=1.0, max_yaw_rate=0.3, vulnerability_weight=1.0),
    "car": AgentProfile("car", length=4.4, width=1.8, nominal_speed=9.0, max_accel=2.0, max_yaw_rate=0.6, vulnerability_weight=1.0),
    "handcart": AgentProfile("handcart", length=2.2, width=1.2, nominal_speed=0.9, max_accel=0.5, max_yaw_rate=0.3, vulnerability_weight=2.0),
}


class TrafficAgent:
    """
    Simulated dynamic traffic agent with behaviour state (crossing, swerving, stopping).
    """

    def __init__(
        self,
        id: str,
        class_name: str,
        x: float,
        y: float,
        yaw: float,
        speed: float,
        intent: str = "straight", # "cross", "stop_midroad", "swerve", "merge", "straight"
        profile: Optional[AgentProfile] = None,
        behavior_seed: int = 42,
    ):
        self.id = id
        self.class_name = class_name
        self.profile = profile or AGENT_PROFILES.get(class_name, AGENT_PROFILES["car"])
        self.x = x
        self.y = y
        self.yaw = yaw
        self.v = speed
        self.intent = intent
        self.rng = random.Random(behavior_seed)
        self.is_occluded = False
        self.state_timer = 0.0
        self.stopped = False

    @property
    def v_x(self) -> float:
        return self.v * math.cos(self.yaw)

    @property
    def v_y(self) -> float:
        return self.v * math.sin(self.yaw)

    def step(self, dt: float, road_bounds: Tuple[float, float, float, float]):
        """Update agent kinematics deterministically."""
        self.state_timer += dt

        if self.intent == "stop_midroad":
            # For cattle or hesitant pedestrians: walk into lane then halt mid-road
            if self.state_timer > 2.0 and not self.stopped:
                # Begin decelerating to zero
                self.v = max(0.0, self.v - 1.2 * dt)
                if self.v == 0.0:
                    self.stopped = True
            elif self.stopped:
                self.v = 0.0
                # Slight head turn jitter
                self.yaw += 0.05 * math.sin(self.state_timer * 1.5) * dt
        elif self.intent == "cross":
            # Direct crossing across road with minor lateral sway
            self.yaw += 0.02 * math.cos(self.state_timer * 2.0) * dt
        elif self.intent == "swerve":
            # Auto-rickshaw or two-wheeler opportunistic swerving
            yaw_delta = 0.25 * math.sin(self.state_timer * 1.8)
            self.yaw += yaw_delta * dt
        elif self.intent == "merge":
            # Gradual merge from ramp (y negative to y ~ 0)
            if self.y < 0:
                self.yaw = min(0.3, max(0.05, 0.3 - 0.05 * self.state_timer))
            else:
                self.yaw = 0.0
        elif self.intent == "cut_in":
            # Motorcycle cuts sharply into ego lane from adjacent corridor
            if self.state_timer > 1.0:
                target_y = 0.3
                dy = target_y - self.y
                if abs(dy) > 0.15:
                    self.yaw = -0.35 if dy < 0 else 0.35
                else:
                    self.yaw = 0.0
                    self.y = target_y
            else:
                self.yaw = 0.0
        elif self.intent == "sudden_brake":
            # Leading vehicle hard braking
            if self.state_timer > 1.4:
                self.v = max(0.0, self.v - 4.2 * dt)
                if self.v == 0.0:
                    self.stopped = True
            else:
                self.yaw = 0.0
        elif self.intent == "sudden_cross":
            # Pedestrian stepping out rapidly from sidewalk/curb
            if self.state_timer > 1.0:
                self.yaw = -math.pi / 2.0  # crossing laterally across road
                self.v = min(1.6, self.v + 0.9 * dt)

        # Update position
        self.x += self.v_x * dt
        self.y += self.v_y * dt

    def get_bounding_box(self) -> List[Tuple[float, float]]:
        half_l = self.profile.length / 2.0
        half_w = self.profile.width / 2.0
        cos_y = math.cos(self.yaw)
        sin_y = math.sin(self.yaw)

        corners_local = [
            (half_l, half_w),
            (half_l, -half_w),
            (-half_l, -half_w),
            (-half_l, half_w),
        ]
        return [
            (self.x + (lx * cos_y - ly * sin_y), self.y + (lx * sin_y + ly * cos_y))
            for lx, ly in corners_local
        ]
