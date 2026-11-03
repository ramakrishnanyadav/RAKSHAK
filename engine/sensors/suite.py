"""
Sensor Suite Manager: Coordinates Camera, LiDAR, and Radar with synchronized seeds and transport delay queues.
"""

from typing import List, Dict, Any, Optional
from .base import BaseSensor, RawDetection, SensorReading
from .camera import CameraSensor
from .lidar import LiDARSensor
from .radar import RadarSensor


class SensorSuite:
    """
    Coordinates multi-modal automotive sensor suite (Camera, LiDAR, Radar).
    Maintains deterministic seeding and synchronous stepped reads.
    """

    def __init__(
        self,
        camera_config: Optional[Dict[str, Any]] = None,
        lidar_config: Optional[Dict[str, Any]] = None,
        radar_config: Optional[Dict[str, Any]] = None,
        seed: int = 1000,
    ):
        c_cfg = camera_config or {}
        l_cfg = lidar_config or {}
        r_cfg = radar_config or {}

        self.camera = CameraSensor(
            sensor_id=c_cfg.get("sensor_id", "camera_front"),
            range_m=c_cfg.get("range_m", 55.0),
            fov_deg=c_cfg.get("fov_deg", 120.0),
            noise_pos_std=c_cfg.get("noise_pos_std", 0.08),
            noise_yaw_std=c_cfg.get("noise_yaw_std", 0.03),
            noise_vel_std=c_cfg.get("noise_vel_std", 0.12),
            dropout_prob=c_cfg.get("dropout_prob", 0.02),
            delay_steps=c_cfg.get("delay_steps", 1),
            seed=seed + 101,
        )

        self.lidar = LiDARSensor(
            sensor_id=l_cfg.get("sensor_id", "lidar_roof"),
            range_m=l_cfg.get("range_m", 45.0),
            fov_deg=l_cfg.get("fov_deg", 360.0),
            noise_pos_std=l_cfg.get("noise_pos_std", 0.03),
            noise_yaw_std=l_cfg.get("noise_yaw_std", 0.015),
            noise_vel_std=l_cfg.get("noise_vel_std", 0.10),
            dropout_prob=l_cfg.get("dropout_prob", 0.01),
            delay_steps=l_cfg.get("delay_steps", 1),
            seed=seed + 202,
        )

        self.radar = RadarSensor(
            sensor_id=r_cfg.get("sensor_id", "radar_front"),
            range_m=r_cfg.get("range_m", 75.0),
            fov_deg=r_cfg.get("fov_deg", 45.0),
            noise_pos_std=r_cfg.get("noise_pos_std", 0.15),
            noise_yaw_std=r_cfg.get("noise_yaw_std", 0.05),
            noise_vel_std=r_cfg.get("noise_vel_std", 0.04),
            dropout_prob=r_cfg.get("dropout_prob", 0.005),
            delay_steps=r_cfg.get("delay_steps", 0),
            seed=seed + 303,
        )

        self.sensors: List[BaseSensor] = [self.camera, self.lidar, self.radar]

    def reset(self, seed: int):
        self.camera.reset(seed + 101)
        self.lidar.reset(seed + 202)
        self.radar.reset(seed + 303)

    def step(
        self,
        ego_x: float,
        ego_y: float,
        ego_yaw: float,
        agents: List[Any],
        static_obstacles: List[Any],
        current_time: float,
    ) -> List[RawDetection]:
        """
        Executes sensing across all sensors and aggregates delayed detections.
        """
        all_detections: List[RawDetection] = []
        for sensor in self.sensors:
            reading = sensor.step(
                ego_x=ego_x,
                ego_y=ego_y,
                ego_yaw=ego_yaw,
                agents=agents,
                static_obstacles=static_obstacles,
                current_time=current_time,
            )
            all_detections.extend(reading.detections)
        return all_detections
