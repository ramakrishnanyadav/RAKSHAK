"""
Unit tests for Object Tracking & Non-Lane World Model.
Tests EKF updates, nearest-neighbor gating, track confirmation, and free-space boundary lookups.
"""

import math
import pytest
from engine.sensors.base import RawDetection
from engine.tracker.track import ObjectTrack
from engine.tracker.tracker import MultiObjectTracker
from engine.tracker.world_model import NonLaneWorldModel, LocalOccupancyGrid
from engine.apath_log.schema import RoadBoundary, StaticObstacle, WorldBounds


def test_object_track_ekf_filtering():
    det1 = RawDetection(
        sensor_id="lidar_1",
        sensor_type="lidar",
        agent_id="test_ag",
        class_name="two_wheeler",
        confidence=0.90,
        x=10.0,
        y=0.0,
        yaw=0.0,
        vx=4.0,
        vy=0.0,
        length=2.0,
        width=0.8,
        covariance=[[0.05, 0, 0, 0, 0], [0, 0.05, 0, 0, 0], [0, 0, 0.02, 0, 0], [0, 0, 0, 0.1, 0], [0, 0, 0, 0, 0.1]],
    )
    track = ObjectTrack(det1)
    assert track.x == 10.0
    assert track.hits == 1
    assert not track.is_confirmed

    # Predict 0.1s forward
    track.predict(dt=0.1)
    assert round(track.x, 2) == 10.4

    # Measurement update with slightly noisy observation
    det2 = RawDetection(
        sensor_id="lidar_1",
        sensor_type="lidar",
        agent_id="test_ag",
        class_name="two_wheeler",
        confidence=0.95,
        x=10.42,
        y=0.01,
        yaw=0.01,
        vx=4.1,
        vy=0.05,
        length=2.0,
        width=0.8,
    )
    track.update(det2)
    assert track.hits == 2
    assert track.is_confirmed
    assert len(track.history) == 2


def test_multi_object_tracker_lifecycle():
    tracker = MultiObjectTracker(gating_threshold_m=4.0, max_coast_frames=3, min_hits_to_confirm=2)

    # Frame 1: Detection of auto-rickshaw
    d1 = RawDetection(
        sensor_id="cam_1",
        sensor_type="camera",
        agent_id="auto_1",
        class_name="auto_rickshaw",
        confidence=0.90,
        x=25.0,
        y=1.0,
        yaw=0.0,
        vx=5.0,
        vy=0.0,
        length=2.8,
        width=1.3,
    )
    active_1 = tracker.step([d1], dt=0.1)
    assert len(active_1) == 1
    assert not active_1[0].is_confirmed

    # Frame 2: Matched detection
    d2 = RawDetection(
        sensor_id="cam_1",
        sensor_type="camera",
        agent_id="auto_1",
        class_name="auto_rickshaw",
        confidence=0.92,
        x=25.5,
        y=1.0,
        yaw=0.0,
        vx=5.0,
        vy=0.0,
        length=2.8,
        width=1.3,
    )
    active_2 = tracker.step([d2], dt=0.1)
    assert len(active_2) == 1
    assert active_2[0].is_confirmed

    # Frame 3-6: Missed detections (coasting then deletion)
    tracker.step([], dt=0.1)
    tracker.step([], dt=0.1)
    tracker.step([], dt=0.1)
    active_dead = tracker.step([], dt=0.1)
    assert len(active_dead) == 0, "Track should be pruned after exceeding max_coast_frames"


def test_non_lane_world_model_corridor_bounds():
    left_pts = [[-10.0, 4.0], [50.0, 5.0], [100.0, 4.0]]
    right_pts = [[-10.0, -4.0], [50.0, -5.0], [100.0, -4.0]]
    boundaries = [
        RoadBoundary(side="left", points=left_pts),
        RoadBoundary(side="right", points=right_pts),
    ]
    world_model = NonLaneWorldModel(road_boundaries=boundaries)

    # At x = 20.0, left bound should interpolate between 4.0 and 5.0
    y_min, y_max = world_model.get_road_corridor_bounds(20.0)
    assert 4.0 < y_max < 5.0
    assert -5.0 < y_min < -4.0

    # Clearance query
    clearance = world_model.compute_free_space_clearance(20.0, 0.0)
    assert clearance > 4.0
