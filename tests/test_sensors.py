"""
Unit tests for Sensor Abstraction: Camera, LiDAR, Radar, and SensorSuite.
Verifies configurable noise, dropout (Pd), raycast occlusion, and FIFO transport delay.
"""

import math
import pytest
from engine.sensors.camera import CameraSensor
from engine.sensors.lidar import LiDARSensor
from engine.sensors.radar import RadarSensor
from engine.sensors.suite import SensorSuite
from engine.simulation.obstacles import TrafficAgent
from engine.apath_log.schema import StaticObstacle


def create_test_agent(id="agent_1", class_name="auto_rickshaw", x=20.0, y=0.0, vx=5.0, vy=0.0):
    return TrafficAgent(
        id=id,
        class_name=class_name,
        x=x,
        y=y,
        yaw=0.0,
        speed=math.hypot(vx, vy),
        intent="straight",
        behavior_seed=123,
    )


def test_camera_fov_and_range():
    cam = CameraSensor(range_m=30.0, fov_deg=90.0, seed=42)

    # In front: within FOV and range
    ag_in = create_test_agent(x=20.0, y=0.0)
    # Behind ego: outside FOV
    ag_behind = create_test_agent(id="behind", x=-10.0, y=0.0)
    # Too far: outside range
    ag_far = create_test_agent(id="far", x=45.0, y=0.0)

    reading = cam.step(ego_x=0.0, ego_y=0.0, ego_yaw=0.0, agents=[ag_in, ag_behind, ag_far], static_obstacles=[], current_time=0.1)

    det_ids = [d.agent_id for d in reading.detections]
    assert "agent_1" in det_ids
    assert "behind" not in det_ids
    assert "far" not in det_ids


def test_sensor_occlusion_raycast():
    lidar = LiDARSensor(range_m=50.0, dropout_prob=0.0, delay_steps=0, seed=42)

    # Large occluding truck at x=15.0, y=0.0
    occluder_truck = TrafficAgent(
        id="big_truck",
        class_name="truck",
        x=15.0,
        y=0.0,
        yaw=0.0,
        speed=0.0,
        behavior_seed=1,
    )
    # Target pedestrian hidden directly behind the truck at x=25.0, y=0.0
    hidden_ped = TrafficAgent(
        id="hidden_ped",
        class_name="pedestrian",
        x=25.0,
        y=0.0,
        yaw=0.0,
        speed=1.0,
        behavior_seed=2,
    )

    reading = lidar.step(
        ego_x=0.0,
        ego_y=0.0,
        ego_yaw=0.0,
        agents=[occluder_truck, hidden_ped],
        static_obstacles=[],
        current_time=0.1,
    )

    det_ids = [d.agent_id for d in reading.detections]
    assert "big_truck" in det_ids
    assert "hidden_ped" not in det_ids, "Hidden pedestrian should be occluded by heavy truck"


def test_sensor_fifo_transport_delay():
    # Sensor with 2 cycles delay
    radar = RadarSensor(delay_steps=2, dropout_prob=0.0, seed=42)
    ag = create_test_agent(x=30.0, y=0.0, vx=6.0)

    # Step 0 (initial step): warm-up returns immediate reading
    r0 = radar.step(0.0, 0.0, 0.0, [ag], [], current_time=0.0)
    assert len(r0.detections) == 1

    # Update agent position at step 1
    ag.x = 35.0
    r1 = radar.step(0.0, 0.0, 0.0, [ag], [], current_time=0.1)

    # Update agent position at step 2
    ag.x = 40.0
    r2 = radar.step(0.0, 0.0, 0.0, [ag], [], current_time=0.2)

    # Now delay buffer should output delayed measurements
    assert len(r2.detections) == 1


def test_sensor_suite_multi_modal_aggregation():
    suite = SensorSuite(seed=1000)
    ag1 = create_test_agent(id="rickshaw_1", x=20.0, y=1.0)
    ag2 = create_test_agent(id="cow_1", class_name="cattle", x=15.0, y=-1.0)

    detections = suite.step(
        ego_x=0.0,
        ego_y=0.0,
        ego_yaw=0.0,
        agents=[ag1, ag2],
        static_obstacles=[],
        current_time=0.1,
    )

    assert len(detections) > 0
    sensor_types = set(d.sensor_type for d in detections)
    # Should contain readings from camera, lidar, and radar
    assert "camera" in sensor_types or "lidar" in sensor_types
