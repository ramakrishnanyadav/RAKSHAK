"""
Radar Sensor Model: Long-range Doppler radar with direct radial velocity measurement.
"""

import math
from typing import List, Tuple, Any
from .base import BaseSensor, RawDetection


class RadarSensor(BaseSensor):
    """
    Automotive Doppler Radar Model:
    - Long-range forward cone (75m range, 45-degree FOV)
    - Direct radial Doppler velocity measurement (low velocity noise ~ 0.04 m/s)
    - Moderate angular/lateral resolution (~ 0.15m lateral noise)
    - Robust against rain, dust, and partial occlusion (can see past light stalls)
    - Minimal transport delay (0-1 frame)
    """

    def __init__(
        self,
        sensor_id: str = "radar_front",
        range_m: float = 75.0,
        fov_deg: float = 45.0,
        noise_pos_std: float = 0.15,
        noise_yaw_std: float = 0.05,
        noise_vel_std: float = 0.04,  # Direct Doppler velocity measurement
        dropout_prob: float = 0.005,
        delay_steps: int = 0,
        seed: int = 44,
    ):
        super().__init__(
            sensor_id=sensor_id,
            sensor_type="radar",
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
        # Radar penetrates small wooden stalls/vegetation, only occluded by heavy metal containers/trucks
        heavy_occluders: List[Tuple[float, float, float]] = []
        for obj in static_obstacles:
            if getattr(obj, "kind", "") in ["barrier", "concrete_wall"]:
                heavy_occluders.append((obj.x, obj.y, max(obj.length, obj.width) / 2.0))
        for ag in agents:
            if ag.class_name in ["truck", "bus"]:
                heavy_occluders.append((ag.x, ag.y, ag.profile.length / 2.0))

        detections: List[RawDetection] = []
        for ag in agents:
            in_view, dist = self.is_in_fov_and_range(ego_x, ego_y, ego_yaw, ag.x, ag.y)
            if not in_view:
                continue

            if self.check_occlusion(ego_x, ego_y, ag.x, ag.y, dist, heavy_occluders):
                continue

            if self.rng.random() < self.dropout_prob:
                continue

            # Radar measurement: high velocity accuracy
            meas_x = ag.x + self.rng.gauss(0, self.noise_pos_std)
            meas_y = ag.y + self.rng.gauss(0, self.noise_pos_std)
            meas_yaw = ag.yaw + self.rng.gauss(0, self.noise_yaw_std)
            meas_vx = ag.v_x + self.rng.gauss(0, self.noise_vel_std)
            meas_vy = ag.v_y + self.rng.gauss(0, self.noise_vel_std)

            # Radar classification confidence is typically slightly lower for VRUs without optical
            vru_classes = ["pedestrian", "cattle", "two_wheeler"]
            confidence = round(
                self.rng.uniform(0.75, 0.88) if ag.class_name in vru_classes else self.rng.uniform(0.90, 0.98),
                3,
            )

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
