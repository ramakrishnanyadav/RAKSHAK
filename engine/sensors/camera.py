"""
Camera Sensor Model: Optical sensing with FOV, classification confidence, and raycast occlusion.
"""

import math
from typing import List, Tuple, Any
from .base import BaseSensor, RawDetection


class CameraSensor(BaseSensor):
    """
    Monocular / Stereo Camera Model:
    - Forward-facing 120-degree FOV, 55m range
    - High classification fidelity, moderate depth noise
    - High sensitivity to visual occlusion and lighting dropout
    - Configurable transport delay (typically 1-2 frames for DNN inference)
    """

    def __init__(
        self,
        sensor_id: str = "camera_front",
        range_m: float = 55.0,
        fov_deg: float = 120.0,
        noise_pos_std: float = 0.08,
        noise_yaw_std: float = 0.03,
        noise_vel_std: float = 0.12,
        dropout_prob: float = 0.02,
        delay_steps: int = 1,
        seed: int = 42,
    ):
        super().__init__(
            sensor_id=sensor_id,
            sensor_type="camera",
            range_m=range_m,
            fov_deg=fov_deg,
            noise_pos_std=noise_pos_std,
            noise_yaw_std=noise_yaw_std,
            noise_vel_std=noise_vel_std,
            dropout_prob=dropout_prob,
            delay_steps=delay_steps,
            seed=seed,
        )

    def sense_raw(
        self,
        ego_x: float,
        ego_y: float,
        ego_yaw: float,
        agents: List[Any],
        static_obstacles: List[Any],
        current_time: float,
    ) -> List[RawDetection]:
        # Build occluders list (large trucks, buses, stalls, containers)
        occluders: List[Tuple[float, float, float]] = []
        for obj in static_obstacles:
            if getattr(obj, "kind", "") in ["stall", "parked_vehicle", "barrier"]:
                occluders.append((obj.x, obj.y, max(obj.length, obj.width) / 2.0))
        for ag in agents:
            if ag.class_name in ["truck", "bus"]:
                occluders.append((ag.x, ag.y, ag.profile.length / 2.0))

        detections: List[RawDetection] = []
        for ag in agents:
            in_view, dist = self.is_in_fov_and_range(ego_x, ego_y, ego_yaw, ag.x, ag.y)
            if not in_view:
                continue

            # Check optical occlusion
            if self.check_occlusion(ego_x, ego_y, ag.x, ag.y, dist, occluders):
                continue

            # Check stochastic dropout
            if self.rng.random() < self.dropout_prob:
                continue

            # Add camera measurement noise
            meas_x = ag.x + self.rng.gauss(0, self.noise_pos_std)
            meas_y = ag.y + self.rng.gauss(0, self.noise_pos_std)
            meas_yaw = ag.yaw + self.rng.gauss(0, self.noise_yaw_std)
            meas_vx = ag.v_x + self.rng.gauss(0, self.noise_vel_std)
            meas_vy = ag.v_y + self.rng.gauss(0, self.noise_vel_std)

            # Optical classification confidence
            confidence = round(self.rng.uniform(0.88, 0.99), 3)

            # Measurement covariance matrix (5x5: x, y, yaw, vx, vy)
            cov = [
                [self.noise_pos_std ** 2, 0.0, 0.0, 0.0, 0.0],
                [0.0, self.noise_pos_std ** 2, 0.0, 0.0, 0.0],
                [0.0, 0.0, self.noise_yaw_std ** 2, 0.0, 0.0],
                [0.0, 0.0, 0.0, self.noise_vel_std ** 2, 0.0],
                [0.0, 0.0, 0.0, 0.0, self.noise_vel_std ** 2],
            ]

            detections.append(
                RawDetection(
                    sensor_id=self.sensor_id,
                    sensor_type=self.sensor_type,
                    agent_id=ag.id,
                    class_name=ag.class_name,
                    confidence=confidence,
                    x=round(meas_x, 3),
                    y=round(meas_y, 3),
                    yaw=round(meas_yaw, 3),
                    vx=round(meas_vx, 3),
                    vy=round(meas_vy, 3),
                    length=ag.profile.length,
                    width=ag.profile.width,
                    covariance=cov,
                )
            )

        return detections
