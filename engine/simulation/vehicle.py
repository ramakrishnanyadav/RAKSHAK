"""
Kinematic Bicycle Model & Vehicle Collision Geometry.
Accurate non-holonomic representation for autonomous vehicle dynamics.
"""

import math
from typing import Tuple, List, Optional
from dataclasses import dataclass


@dataclass
class VehicleParameters:
    length: float = 4.2       # meters
    width: float = 1.8        # meters
    wheelbase: float = 2.6    # meters (L)
    dist_cg_to_rear: float = 1.3 # meters (l_r)
    max_steer_rad: float = 0.60 # ~34 degrees
    max_accel_m_s2: float = 2.5
    max_decel_m_s2: float = -6.5 # Emergency braking capacity
    max_steer_rate_rad_s: float = 0.8
    max_jerk_m_s3: float = 10.0


class KinematicBicycleModel:
    """
    Kinematic bicycle model parameterized at vehicle center of gravity.
    dot(x) = v * cos(psi + beta)
    dot(y) = v * sin(psi + beta)
    dot(psi) = (v / L) * cos(beta) * tan(delta)
    dot(v) = a
    beta = arctan((l_r / L) * tan(delta))
    """

    def __init__(self, params: Optional[VehicleParameters] = None):
        self.params = params or VehicleParameters()

    def step(
        self,
        x: float,
        y: float,
        yaw: float,
        v: float,
        steer: float,
        accel: float,
        dt: float,
    ) -> Tuple[float, float, float, float, float]:
        """
        Step simulation by dt seconds.
        Returns: (new_x, new_y, new_yaw, new_v, actual_accel)
        """
        # Clamp inputs
        steer_clamped = max(-self.params.max_steer_rad, min(self.params.max_steer_rad, steer))
        accel_clamped = max(self.params.max_decel_m_s2, min(self.params.max_accel_m_s2, accel))

        # Vehicle slip angle
        beta = math.atan((self.params.dist_cg_to_rear / self.params.wheelbase) * math.tan(steer_clamped))

        # Kinematics derivatives
        dx = v * math.cos(yaw + beta)
        dy = v * math.sin(yaw + beta)
        d_yaw = (v / self.params.wheelbase) * math.cos(beta) * math.tan(steer_clamped)

        # Update
        new_x = x + dx * dt
        new_y = y + dy * dt
        new_yaw = (yaw + d_yaw * dt) % (2 * math.pi)
        new_v = max(0.0, v + accel_clamped * dt)

        return new_x, new_y, new_yaw, new_v, accel_clamped

    @staticmethod
    def get_bounding_box(x: float, y: float, yaw: float, length: float, width: float) -> List[Tuple[float, float]]:
        """Returns 4 oriented corner points [(x1,y1), (x2,y2), (x3,y3), (x4,y4)] in clockwise order."""
        half_l = length / 2.0
        half_w = width / 2.0
        cos_y = math.cos(yaw)
        sin_y = math.sin(yaw)

        corners_local = [
            (half_l, half_w),
            (half_l, -half_w),
            (-half_l, -half_w),
            (-half_l, half_w),
        ]

        corners_global = []
        for lx, ly in corners_local:
            gx = x + (lx * cos_y - ly * sin_y)
            gy = y + (lx * sin_y + ly * cos_y)
            corners_global.append((gx, gy))
        return corners_global

    @staticmethod
    def check_sat_collision(poly_a: List[Tuple[float, float]], poly_b: List[Tuple[float, float]]) -> bool:
        """
        Separating Axis Theorem (SAT) collision detection for two convex 2D polygons.
        Returns True if colliding, False otherwise.
        """
        for poly in [poly_a, poly_b]:
            n = len(poly)
            for i in range(n):
                p1 = poly[i]
                p2 = poly[(i + 1) % n]
                edge = (p2[0] - p1[0], p2[1] - p1[1])
                # Normal vector
                axis = (-edge[1], edge[0])
                length = math.hypot(axis[0], axis[1])
                if length == 0:
                    continue
                axis = (axis[0] / length, axis[1] / length)

                # Project poly_a
                proj_a = [p[0] * axis[0] + p[1] * axis[1] for p in poly_a]
                min_a, max_a = min(proj_a), max(proj_a)

                # Project poly_b
                proj_b = [p[0] * axis[0] + p[1] * axis[1] for p in poly_b]
                min_b, max_b = min(proj_b), max(proj_b)

                # Check gap
                if max_a < min_b or max_b < min_a:
                    return False
        return True

    @staticmethod
    def min_distance_polygons(poly_a: List[Tuple[float, float]], poly_b: List[Tuple[float, float]]) -> float:
        """
        Computes minimum Euclidean distance between two convex polygons.
        Uses fast bounding-circle pre-filter for real-time performance.
        Returns 0.0 if intersecting.
        """
        # Fast bounding center & radius
        ca_x = sum(p[0] for p in poly_a) / 4.0
        ca_y = sum(p[1] for p in poly_a) / 4.0
        ra = max(math.hypot(p[0] - ca_x, p[1] - ca_y) for p in poly_a)

        cb_x = sum(p[0] for p in poly_b) / 4.0
        cb_y = sum(p[1] for p in poly_b) / 4.0
        rb = max(math.hypot(p[0] - cb_x, p[1] - cb_y) for p in poly_b)

        center_dist = math.hypot(ca_x - cb_x, ca_y - cb_y)
        if center_dist > (ra + rb + 3.0):
            return center_dist - (ra + rb)

        if KinematicBicycleModel.check_sat_collision(poly_a, poly_b):
            return 0.0

        min_d = float("inf")
        # Point to edge distance across both polygons
        for p1, p2 in [(poly_a, poly_b), (poly_b, poly_a)]:
            for pt in p1:
                n = len(p2)
                for i in range(n):
                    e1 = p2[i]
                    e2 = p2[(i + 1) % n]
                    d = KinematicBicycleModel._point_to_segment_dist(pt, e1, e2)
                    if d < min_d:
                        min_d = d
        return min_d

    @staticmethod
    def _point_to_segment_dist(p: Tuple[float, float], a: Tuple[float, float], b: Tuple[float, float]) -> float:
        ab = (b[0] - a[0], b[1] - a[1])
        ab_sq = ab[0] ** 2 + ab[1] ** 2
        if ab_sq == 0:
            return math.hypot(p[0] - a[0], p[1] - a[1])
        ap = (p[0] - a[0], p[1] - a[1])
        t = max(0.0, min(1.0, (ap[0] * ab[0] + ap[1] * ab[1]) / ab_sq))
        proj = (a[0] + t * ab[0], a[1] + t * ab[1])
        return math.hypot(p[0] - proj[0], p[1] - proj[1])
