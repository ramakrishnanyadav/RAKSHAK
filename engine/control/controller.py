"""
Unified Vehicle Controller Interface.
Provides seamless selection between Pure Pursuit + PID or Kinematic MPC.
"""

from typing import List, Tuple, Dict, Any, Optional
from dataclasses import dataclass
from .pure_pursuit import PurePursuitController
from .longitudinal_pid import LongitudinalPIDController
from .mpc_controller import KinematicBicycleMPC


@dataclass
class VehicleControlCommand:
    steer_rad: float
    accel_m_s2: float


class VehicleController:
    """
    Closed-loop path tracking and longitudinal velocity controller.
    Supports:
    - "pure_pursuit_pid" (default robust baseline)
    - "mpc" (receding horizon optimization)
    """

    def __init__(
        self,
        mode: str = "pure_pursuit_pid",
        wheelbase_m: float = 2.7,
        k_look: float = 0.55,
        kp_long: float = 1.10,
        ki_long: float = 0.15,
        kd_long: float = 0.08,
    ):
        self.mode = mode
        self.pure_pursuit = PurePursuitController(wheelbase_m=wheelbase_m, k_look=k_look)
        self.longitudinal_pid = LongitudinalPIDController(kp=kp_long, ki=ki_long, kd=kd_long)
        self.mpc = KinematicBicycleMPC(wheelbase_m=wheelbase_m)

    def reset(self):
        self.pure_pursuit.reset()
        self.longitudinal_pid.reset()

    def step(
        self,
        ego_x: float,
        ego_y: float,
        ego_yaw: float,
        ego_v: float,
        trajectory: List[Tuple[float, float, float]], # [(x, y, v), ...]
        target_v: float,
        dt: float,
    ) -> VehicleControlCommand:
        """
        Executes one control cycle and produces rate-limited steer and accel.
        """
        if self.mode == "mpc":
            cmd = self.mpc.compute_control(ego_x, ego_y, ego_yaw, ego_v, trajectory, target_v)
            return VehicleControlCommand(steer_rad=cmd.steer, accel_m_s2=cmd.accel)
        else:
            steer = self.pure_pursuit.compute_steering(
                ego_x=ego_x,
                ego_y=ego_y,
                ego_yaw=ego_yaw,
                ego_v=ego_v,
                trajectory=trajectory,
                dt=dt,
            )
            accel = self.longitudinal_pid.compute_acceleration(
                current_v=ego_v,
                target_v=target_v,
                dt=dt,
            )
            return VehicleControlCommand(steer_rad=steer, accel_m_s2=accel)
