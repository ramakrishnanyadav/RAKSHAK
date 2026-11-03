"""
IDD-3D Trajectory Dataset Adapter.
Normalizes real-world IDD-3D (India Driving Dataset) object trajectories
into the standard ADAPTIVE-PATH sequence format.
Licence: CC BY-NC-SA 4.0 (Non-commercial research use).
"""

import math
from typing import List, Dict, Any, Optional
from dataclasses import dataclass


CLASS_MAPPING = {
    "motorcycle": "two_wheeler",
    "scooter": "two_wheeler",
    "auto": "auto_rickshaw",
    "auto_rickshaw": "auto_rickshaw",
    "pedestrian": "pedestrian",
    "animal": "cattle",
    "cow": "cattle",
    "truck": "truck",
    "car": "car",
    "pushcart": "handcart",
    "handcart": "handcart",
}


@dataclass
class TrajectorySequence:
    seq_id: str
    scenario_family: str
    agent_id: str
    class_name: str
    history_xyv: List[List[float]] # 10 steps: [rel_x, rel_y, vx, vy, rel_yaw]
    future_xy: List[List[float]]   # 15 steps: [rel_x, rel_y]
    class_id: int
    corridor_bounds: List[float]   # [d_left, d_right]


def normalize_idd_track(
    raw_track: Dict[str, Any],
    seq_idx: int,
) -> Optional[TrajectorySequence]:
    """
    Converts raw IDD-3D box sequence into canonical relative trajectory representation.
    """
    raw_class = raw_track.get("class", "").lower()
    canonical_class = CLASS_MAPPING.get(raw_class, "auto_rickshaw")

    class_id_map = {
        "auto_rickshaw": 0,
        "two_wheeler": 1,
        "pedestrian": 2,
        "cattle": 3,
        "truck": 4,
        "handcart": 5,
    }
    class_idx = class_id_map.get(canonical_class, 0)

    timestamps = raw_track.get("timestamps", [])
    positions = raw_track.get("positions", []) # [(x, y), ...]
    if len(positions) < 25:
        return None

    # Pose at t=0 (index 9)
    origin_x, origin_y = positions[9]
    yaw0 = math.atan2(positions[10][1] - positions[9][1], positions[10][0] - positions[9][0])
    cos_y = math.cos(-yaw0)
    sin_y = math.sin(-yaw0)

    def to_relative(gx: float, gy: float):
        dx = gx - origin_x
        dy = gy - origin_y
        return [dx * cos_y - dy * sin_y, dx * sin_y + dy * cos_y]

    history_feats = []
    for i in range(10):
        rx, ry = to_relative(positions[i][0], positions[i][1])
        if i > 0:
            vx = (rx - history_feats[i - 1][0]) / 0.2
            vy = (ry - history_feats[i - 1][1]) / 0.2
        else:
            vx, vy = 0.0, 0.0
        history_feats.append([rx, ry, vx, vy, 0.0])

    future_pts = []
    for i in range(10, 25):
        rx, ry = to_relative(positions[i][0], positions[i][1])
        future_pts.append([rx, ry])

    return TrajectorySequence(
        seq_id=f"idd_seq_{seq_idx}",
        scenario_family="IDD_REAL_WORLD",
        agent_id=raw_track.get("id", f"ag_{seq_idx}"),
        class_name=canonical_class,
        history_xyv=history_feats,
        future_xy=future_pts,
        class_id=class_idx,
        corridor_bounds=[3.6, -3.6],
    )
