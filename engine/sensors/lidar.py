"""
LiDAR Sensor Model: 360-degree point-cloud/bounding box spatial perception with low position noise.
"""

import math
from typing import List, Tuple, Any
from .base import BaseSensor, RawDetection


class LiDARSensor(BaseSensor):
    """
    360-Degree LiDAR Model:
    - 360-degree azimuth coverage, 45m range
    - High spatial precision (low noise_pos_std ~ 0.03m)
    - Occlusion modeling based on physical bounding boxes
    - Atmospheric/dust dropout probability
    - Transport delay (typically 1 frame / 100ms)
    """

    def __init__(
        self,
        sensor_id: str = "lidar_roof",
        range_m: float = 45.0,
        fov_deg: float = 360.0,
        noise_pos_std: float = 0.03,
        noise_yaw_std: float = 0.015,
        noise_vel_std: float = 0.10,
        dropout_prob: float = 0.01,
        delay_steps: int = 1,
        seed: int = 43,
    ):
        super().__init__(
            sensor_id=sensor_id,
            sensor_type="lidar",
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
        occluders: List[Tuple[float, float, float]] = []
        for obj in static_obstacles:
            occluders.append((obj.x, obj.y, max(obj.length, obj.width) / 2.0))
        for ag in agents:
            if ag.class_name in ["truck", "bus", "car"]:
                occluders.append((ag.x, ag.y, ag.profile.length / 2.0))

        detections: List[RawDetection] = []
        for ag in agents:
            in_view, dist = self.is_in_fov_and_range(ego_x, ego_y, ego_yaw, ag.x, ag.y)
            if not in_view:
                continue

            if self.check_occlusion(ego_x, ego_y, ag.x, ag.y, dist, occluders):
                continue

            if self.rng.random() < self.dropout_prob:
                continue

            # LiDAR measurement noise
            meas_x = ag.x + self.rng.gauss(0, self.noise_pos_std)
            meas_y = ag.y + self.rng.gauss(0, self.noise_pos_std)
            meas_yaw = ag.yaw + self.rng.gauss(0, self.noise_yaw_std)
            meas_vx = ag.v_x + self.rng.gauss(0, self.noise_vel_std)
            meas_vy = ag.v_y + self.rng.gauss(0, self.noise_vel_std)

            confidence = round(self.rng.uniform(0.92, 0.99), 3)

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
