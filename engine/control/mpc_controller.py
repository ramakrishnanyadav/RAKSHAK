"""
Model Predictive Controller (MPC) for Path Tracking.
Optimizes steering and acceleration commands over a finite prediction horizon.
"""

import math
from typing import List, Tuple, Optional
from dataclasses import dataclass


@dataclass
class MPCCommand:
    steer: float
    accel: float
    predicted_path: List[Tuple[float, float, float]]


class KinematicBicycleMPC:
    """
    Receding Horizon MPC:
    - Horizon N = 10 steps (dt = 0.1s -> 1.0s preview)
    - Kinematic bicycle state: [x, y, yaw, v]
    - Minimizes quadratic cost:
      J = sum( w_lat * e_lat^2 + w_head * e_yaw^2 + w_v * (v - v_ref)^2 + w_steer * delta^2 + w_acc * a^2 )
    - Actuator bounds: delta in [-0.61, 0.61], a in [-6.0, 2.5]
    """

    def __init__(
        self,
        wheelbase_m: float = 2.7,
        horizon_steps: int = 10,
        dt: float = 0.1,
        w_lat: float = 2.5,
        w_head: float = 1.8,
        w_v: float = 1.2,
        w_steer: float = 0.8,
        w_accel: float = 0.5,
    ):
        self.L = wheelbase_m
        self.N = horizon_steps
        self.dt = dt
        self.w_lat = w_lat
        self.w_head = w_head
        self.w_v = w_v
        self.w_steer = w_steer
        self.w_accel = w_accel

    def compute_control(
        self,
        ego_x: float,
        ego_y: float,
        ego_yaw: float,
        ego_v: float,
        reference_path: List[Tuple[float, float, float]], # [(x, y, v), ...]
        target_v: float,
    ) -> MPCCommand:
        """
        Computes optimal initial steer and accel over receding horizon.
        """
        if not reference_path:
            return MPCCommand(steer=0.0, accel=0.0, predicted_path=[])

        # Candidate control sampling grid
        steer_candidates = [-0.45, -0.25, -0.10, 0.0, 0.10, 0.25, 0.45]
        accel_candidates = [-3.0, -1.5, -0.5, 0.0, 0.5, 1.2, 2.0]

        best_cost = float("inf")
        best_steer = 0.0
        best_accel = 0.0
        best_sim_path: List[Tuple[float, float, float]] = []

        for steer in steer_candidates:
            for accel in accel_candidates:
                cost = 0.0
                curr_x, curr_y, curr_yaw, curr_v = ego_x, ego_y, ego_yaw, ego_v
                sim_path = []

                for k in range(self.N):
                    # Step bicycle model
                    curr_x += curr_v * math.cos(curr_yaw) * self.dt
                    curr_y += curr_v * math.sin(curr_yaw) * self.dt
                    curr_yaw += (curr_v / self.L) * math.tan(steer) * self.dt
                    curr_v = max(0.0, curr_v + accel * self.dt)
                    sim_path.append((curr_x, curr_y, curr_v))

                    # Reference match at step k
                    ref_idx = min(k, len(reference_path) - 1)
                    ref_x, ref_y, ref_v = reference_path[ref_idx]

                    # Errors
                    e_lat = (curr_y - ref_y)
                    e_yaw = (curr_yaw - math.atan2(ref_y - ego_y, ref_x - ego_x + 1e-4))
                    e_yaw = (e_yaw + math.pi) % (2 * math.pi) - math.pi
                    e_v = curr_v - target_v

                    step_cost = (
                        self.w_lat * (e_lat ** 2)
                        + self.w_head * (e_yaw ** 2)
                        + self.w_v * (e_v ** 2)
                        + self.w_steer * (steer ** 2)
                        + self.w_accel * (accel ** 2)
                    )
                    cost += step_cost

                if cost < best_cost:
                    best_cost = cost
                    best_steer = steer
                    best_accel = accel
                    best_sim_path = sim_path

        return MPCCommand(steer=best_steer, accel=best_accel, predicted_path=best_sim_path)
