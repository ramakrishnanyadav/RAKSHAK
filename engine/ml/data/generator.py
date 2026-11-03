"""
Synthetic Trajectory Dataset Generator for All 5 Scenario Families.
Generates multi-modal sequences with physics kinematics, realistic intent modes,
and sequence-level dataset splitting.
"""

import math
import random
from typing import List, Dict, Any, Tuple, Optional
from .idd_adapter import TrajectorySequence


CLASS_NAMES = ["auto_rickshaw", "two_wheeler", "pedestrian", "cattle", "truck", "handcart"]


def simulate_single_trajectory(
    class_name: str,
    scenario_family: str,
    seq_idx: int,
    rng: random.Random,
    split_prefix: str = "seq",
    dt: float = 0.2,
    hist_len: int = 10,
    fut_len: int = 15,
) -> TrajectorySequence:
    """
    Simulates past 2.0s history and future 3.0s ground truth for an agent.
    """
    # Nominal speed profiles per class
    speed_ranges = {
        "auto_rickshaw": (3.5, 6.5),
        "two_wheeler": (4.5, 8.5),
        "pedestrian": (0.9, 1.6),
        "cattle": (0.4, 1.4),
        "truck": (4.0, 7.0),
        "handcart": (0.7, 1.2),
    }
    vmin, vmax = speed_ranges.get(class_name, (2.0, 5.0))
    v0 = rng.uniform(vmin, vmax)

    # Intent modes
    if class_name == "cattle":
        intent = rng.choice(["continue", "stop_midroad", "turn_back"])
    elif class_name == "two_wheeler":
        intent = rng.choice(["continue", "swerve_left", "swerve_right", "overtake"])
    elif class_name == "pedestrian":
        intent = rng.choice(["cross", "hesitate_stop", "deviate"])
    elif class_name == "auto_rickshaw":
        intent = rng.choice(["continue", "swerve", "slow_curb"])
    else:
        intent = rng.choice(["continue", "slow", "slight_veer"])

    total_steps = hist_len + fut_len

    # Trajectory generation in vehicle local coordinate system at t=0
    # Steps 0..hist_len-1 are past; step hist_len is t=0; steps hist_len..total_steps-1 are future
    curr_x = 0.0
    curr_y = 0.0
    curr_yaw = 0.0
    curr_v = v0

    xs = []
    ys = []
    vxs = []
    vys = []
    yaws = []

    # Backward rollout for history
    hist_xs = [0.0] * hist_len
    hist_ys = [0.0] * hist_len
    hist_vxs = [curr_v] * hist_len
    hist_vys = [0.0] * hist_len
    hist_yaws = [0.0] * hist_len

    # Past points: straight or slight historical curvature
    hist_yaw_rate = rng.gauss(0.0, 0.04)
    hx, hy, hyaw = 0.0, 0.0, 0.0
    for k in reversed(range(hist_len)):
        hist_xs[k] = hx
        hist_ys[k] = hy
        hist_vxs[k] = curr_v * math.cos(hyaw)
        hist_vys[k] = curr_v * math.sin(hyaw)
        hist_yaws[k] = hyaw
        hyaw -= hist_yaw_rate * dt
        hx -= curr_v * math.cos(hyaw) * dt
        hy -= curr_v * math.sin(hyaw) * dt

    # Forward rollout for future (t > 0)
    fut_xs = []
    fut_ys = []
    fx, fy, fyaw, fv = 0.0, 0.0, 0.0, curr_v

    yaw_rate = 0.0
    accel = 0.0

    if intent == "stop_midroad" or intent == "hesitate_stop":
        accel = -fv / (fut_len * dt * 0.7)
    elif "swerve_left" in intent or intent == "deviate":
        yaw_rate = rng.uniform(0.15, 0.35)
    elif "swerve_right" in intent:
        yaw_rate = -rng.uniform(0.15, 0.35)
    elif intent == "turn_back":
        yaw_rate = rng.uniform(0.40, 0.70)
        accel = -0.3
    elif intent == "slow_curb" or intent == "slow":
        accel = -rng.uniform(0.4, 0.9)
    else:
        # Continue
        accel = rng.gauss(0.0, 0.1)
        yaw_rate = rng.gauss(0.0, 0.03)

    for step in range(fut_len):
        fv = max(0.0, fv + accel * dt)
        fyaw += yaw_rate * dt
        fx += fv * math.cos(fyaw) * dt
        fy += fv * math.sin(fyaw) * dt
        # Add slight stochastic Brownian noise
        fx += rng.gauss(0.0, 0.02)
        fy += rng.gauss(0.0, 0.02)
        fut_xs.append(round(fx, 3))
        fut_ys.append(round(fy, 3))

    # Format history features: [x, y, vx, vy, yaw]
    history_feats = [
        [round(hist_xs[i], 3), round(hist_ys[i], 3), round(hist_vxs[i], 3), round(hist_vys[i], 3), round(hist_yaws[i], 3)]
        for i in range(hist_len)
    ]
    future_pts = [[fut_xs[i], fut_ys[i]] for i in range(fut_len)]

    class_id_map = {name: i for i, name in enumerate(CLASS_NAMES)}

    return TrajectorySequence(
        seq_id=f"{split_prefix}_{scenario_family.lower()}_seq_{seq_idx}",
        scenario_family=scenario_family,
        agent_id=f"{class_name}_{seq_idx}",
        class_name=class_name,
        history_xyv=history_feats,
        future_xy=future_pts,
        class_id=class_id_map.get(class_name, 0),
        corridor_bounds=[3.8, -3.8],
    )


def generate_benchmark_dataset(
    split: str = "train",
    count: Optional[int] = None,
    seed: int = 1000,
) -> List[TrajectorySequence]:
    """
    Generates deterministic benchmark sequences partitioned strictly by sequence ID / seed.
    """
    split_counts = {
        "train": 952,
        "val": 320,
        "calib": 320,
        "test": 410,
        "frozen_test": 410,
    }
    split_offsets = {
        "train": 1000,
        "val": 2000,
        "calib": 2500,
        "test": 3000,
        "frozen_test": 3000,
    }

    n_samples = count or split_counts.get(split, 100)
    base_seed = split_offsets.get(split, seed)
    rng = random.Random(base_seed)

    scenarios = [
        "SCENARIO_1_VILLAGE_ROAD",
        "SCENARIO_2_URBAN_INTERSECTION",
        "SCENARIO_3_HIGHWAY_MERGE",
        "SCENARIO_4_DENSE_MARKET",
        "SCENARIO_5_CATTLE_CROSSING",
    ]

    sequences: List[TrajectorySequence] = []
    for idx in range(n_samples):
        sc_fam = scenarios[idx % len(scenarios)]
        cls_name = CLASS_NAMES[idx % len(CLASS_NAMES)]
        seq = simulate_single_trajectory(
            class_name=cls_name,
            scenario_family=sc_fam,
            seq_idx=base_seed + idx,
            rng=rng,
            split_prefix=split,
        )
        sequences.append(seq)

    return sequences
