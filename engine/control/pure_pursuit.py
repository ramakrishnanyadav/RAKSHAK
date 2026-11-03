"""
Adaptive Lookahead Pure Pursuit Steering Controller.
Computes front-wheel steering command based on kinematic bicycle geometry.
"""

import math
from typing import List, Tuple, Optional


class PurePursuitController:
    """
    Adaptive Lookahead Pure Pursuit:
    - Lookahead distance: L_d = max(L_min, k_look * v)
    - Steering angle: delta = atan2(2 * L * sin(alpha), L_d)
    - Wheelbase L = 2.7m (standard compact sedan/SUV)
    """

    def __init__(
        self,
        wheelbase_m: float = 2.7,
        k_look: float = 0.55,
        min_lookahead_m: float = 3.5,
        max_lookahead_m: float = 25.0,
        max_steer_rad: float = 0.61, # ~35 degrees
        max_steer_rate_rad_s: float = 0.65, # ~37 deg/s
    ):
        self.L = wheelbase_m
        self.k_look = k_look
        self.min_lookahead_m = min_lookahead_m
        self.max_lookahead_m = max_lookahead_m
        self.max_steer_rad = max_steer_rad
        self.max_steer_rate_rad_s = max_steer_rate_rad_s
        self.prev_steer: float = 0.0

    def reset(self):
        self.prev_steer = 0.0

    def compute_steering(
        self,
        ego_x: float,
        ego_y: float,
        ego_yaw: float,
        ego_v: float,
        trajectory: List[Tuple[float, float, float]], # [(x, y, v), ...]
        dt: float,
    ) -> float:
        """Computes saturated front-wheel steering angle in radians."""
        if not trajectory:
            return 0.0

        # Calculate adaptive lookahead distance
        lookahead = max(self.min_lookahead_m, min(self.max_lookahead_m, self.k_look * max(0.5, ego_v)))

        # Find target waypoint on trajectory ahead of ego at distance >= lookahead
        target_pt = trajectory[-1]
        cos_yaw = math.cos(ego_yaw)
        sin_yaw = math.sin(ego_yaw)
        for pt in trajectory:
            dx = pt[0] - ego_x
            dy = pt[1] - ego_y
            forward_dist = dx * cos_yaw + dy * sin_yaw
            dist = math.hypot(dx, dy)
            if forward_dist > 0.0 and dist >= lookahead:
                target_pt = pt
                break

        dx = target_pt[0] - ego_x
        dy = target_pt[1] - ego_y
        dist = math.hypot(dx, dy)
        if dist < 0.1:
            return self.prev_steer

        # Heading angle to target in vehicle frame (alpha)
        target_angle = math.atan2(dy, dx)
        alpha = (target_angle - ego_yaw + math.pi) % (2 * math.pi) - math.pi

        # Pure Pursuit geometric curvature
        curvature = 2.0 * math.sin(alpha) / dist
        steer_target = math.atan(self.L * curvature)

        # Apply steering angle saturation limits
        steer_clamped = max(-self.max_steer_rad, min(self.max_steer_rad, steer_target))

        # Apply steering rate limit
        max_d_steer = self.max_steer_rate_rad_s * dt
        steer_rate_limited = max(
            self.prev_steer - max_d_steer, min(self.prev_steer + max_d_steer, steer_clamped)
        )

        self.prev_steer = steer_rate_limited
        return steer_rate_limited
