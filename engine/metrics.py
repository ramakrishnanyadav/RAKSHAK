"""
Statistical Evaluation, Metric Computation, and Bootstrap Confidence Intervals.
Authoritative Single Source of Truth for ADAPTIVE-PATH (SIH26037).

Strict Compliance with docs/METRICS.md (Version 2.2.0):
1. Discrete Separating Axis Theorem (SAT) collision detection across the full trajectory.
2. Exact polygon-to-polygon minimum clearance distance (d_min).
3. Exact 2D constant-relative-velocity Time-to-Collision (TTC) with full case-handling table.
4. Near-miss detection: d_min < 1.00m or TTC < 1.20s.
5. Causal 3-step moving average filtered variable-timestep longitudinal jerk.
6. Goal completion predicate: x_term >= 65.0m and |y_term| <= 4.70m and CollisionFree and t_term <= 20.0s and v_term >= 0.50 m/s.
7. Standard bootstrap confidence interval estimation.
"""

import math
from typing import List, Dict, Any, Optional, Tuple
import numpy as np

from engine.apath_log.schema import RunMetrics, Frame, EgoState


# ---------------------------------------------------------------------------
# 1. Geometry & Separating Axis Theorem (SAT)
# ---------------------------------------------------------------------------

def get_oriented_box_corners(
    x: float, y: float, yaw: float, length: float, width: float
) -> List[Tuple[float, float]]:
    """
    Computes the 4 corners of an oriented bounding rectangle centered at (x, y) with heading yaw.
    Returns counter-clockwise vertices.
    """
    cos_yaw = math.cos(yaw)
    sin_yaw = math.sin(yaw)
    hl = length / 2.0
    hw = width / 2.0

    # Local corners: Front-Right, Front-Left, Rear-Left, Rear-Right
    local_corners = [
        (hl, -hw),
        (hl, hw),
        (-hl, hw),
        (-hl, -hw),
    ]

    corners = []
    for lx, ly in local_corners:
        gx = x + lx * cos_yaw - ly * sin_yaw
        gy = y + lx * sin_yaw + ly * cos_yaw
        corners.append((gx, gy))
    return corners


def sat_polygons_intersect(
    poly1: List[Tuple[float, float]], poly2: List[Tuple[float, float]]
) -> bool:
    """
    Determines whether two 2D convex polygons intersect using the Separating Axis Theorem (SAT).
    Returns True if overlapping on all axes, False if a separating axis exists.
    """
    for poly in (poly1, poly2):
        n_pts = len(poly)
        for i in range(n_pts):
            p1 = poly[i]
            p2 = poly[(i + 1) % n_pts]
            edge = (p2[0] - p1[0], p2[1] - p1[1])
            # Normal perpendicular to edge
            axis = (-edge[1], edge[0])
            norm = math.hypot(axis[0], axis[1])
            if norm < 1e-9:
                continue
            axis = (axis[0] / norm, axis[1] / norm)

            # Project poly1
            dots1 = [p[0] * axis[0] + p[1] * axis[1] for p in poly1]
            min1, max1 = min(dots1), max(dots1)

            # Project poly2
            dots2 = [p[0] * axis[0] + p[1] * axis[1] for p in poly2]
            min2, max2 = min(dots2), max(dots2)

            # Check for separation
            if max1 < min2 or max2 < min1:
                return False  # Separating axis found
    return True


def point_segment_distance(
    px: float, py: float, x1: float, y1: float, x2: float, y2: float
) -> float:
    """Computes the shortest Euclidean distance from point (px, py) to line segment (x1, y1)-(x2, y2)."""
    dx = x2 - x1
    dy = y2 - y1
    seg_len_sq = dx * dx + dy * dy
    if seg_len_sq < 1e-12:
        return math.hypot(px - x1, py - y1)

    # Project point onto segment: t = dot(P-A, B-A) / |B-A|^2
    t = ((px - x1) * dx + (py - y1) * dy) / seg_len_sq
    t = max(0.0, min(1.0, t))
    proj_x = x1 + t * dx
    proj_y = y1 + t * dy
    return math.hypot(px - proj_x, py - proj_y)


def polygon_polygon_clearance(
    poly1: List[Tuple[float, float]], poly2: List[Tuple[float, float]]
) -> float:
    """
    Computes minimum Euclidean distance between the boundaries of two 2D convex polygons.
    Returns 0.0 if polygons intersect.
    """
    if sat_polygons_intersect(poly1, poly2):
        return 0.0

    min_dist = float("inf")
    # Distance from vertices of poly1 to edges of poly2
    n2 = len(poly2)
    for p in poly1:
        for j in range(n2):
            q1 = poly2[j]
            q2 = poly2[(j + 1) % n2]
            d = point_segment_distance(p[0], p[1], q1[0], q1[1], q2[0], q2[1])
            if d < min_dist:
                min_dist = d

    # Distance from vertices of poly2 to edges of poly1
    n1 = len(poly1)
    for p in poly2:
        for i in range(n1):
            q1 = poly1[i]
            q2 = poly1[(i + 1) % n1]
            d = point_segment_distance(p[0], p[1], q1[0], q1[1], q2[0], q2[1])
            if d < min_dist:
                min_dist = d

    return min_dist


# ---------------------------------------------------------------------------
# 2. Time-to-Collision (TTC) Calculation (docs/METRICS.md Section 2.3)
# ---------------------------------------------------------------------------

def compute_2d_ttc(
    ego_pos: Tuple[float, float],
    ego_vel: Tuple[float, float],
    obs_pos: Tuple[float, float],
    obs_vel: Tuple[float, float],
    r_ego: float = 2.10,
    r_obs: float = 1.10,
) -> Optional[float]:
    """
    Exact 2D Constant-Relative-Velocity Time-to-Collision (TTC).
    Solves A * tau^2 + B * tau + C = 0 according to complete case-handling table.
    
    Returns:
    - 0.000 if initial overlap (C <= 0)
    - None if zero relative velocity (A == 0), diverging (r . v_rel <= 0), or missing (D < 0)
    - Smaller positive root tau > 0 if future collision occurs.
    """
    rx = obs_pos[0] - ego_pos[0]
    ry = obs_pos[1] - ego_pos[1]
    r_sq = rx * rx + ry * ry

    vx_rel = ego_vel[0] - obs_vel[0]
    vy_rel = ego_vel[1] - obs_vel[1]
    v_rel_sq = vx_rel * vx_rel + vy_rel * vy_rel

    r_eff = r_ego + r_obs
    r_eff_sq = r_eff * r_eff

    # C = ||r(0)||^2 - R_eff^2
    C = r_sq - r_eff_sq
    if C <= 0.0:
        # Case 1: Initial overlap
        return 0.000

    if v_rel_sq < 1e-9:
        # Case 2: Zero relative velocity (parallel cruise or both stationary)
        return None

    r_dot_v = rx * vx_rel + ry * vy_rel
    if r_dot_v <= 0.0:
        # Case 3: Diverging or static range (dot product non-positive)
        return None

    # Coefficients: A * tau^2 + B * tau + C = 0
    A = v_rel_sq
    B = -2.0 * r_dot_v
    D = B * B - 4.0 * A * C

    if D < 0.0:
        # Case 4: Lateral pass (miss, closest point of approach > R_eff)
        return None

    # Case 5: Future contact at smaller positive root
    sqrt_D = math.sqrt(D)
    tau = (-B - sqrt_D) / (2.0 * A)
    return max(0.0, tau)


# ---------------------------------------------------------------------------
# 3. Variable-Timestep Jerk (docs/METRICS.md Section 4)
# ---------------------------------------------------------------------------

def compute_variable_timestep_jerk(
    times: List[float],
    speeds: List[float],
    filter_window: int = 3,
) -> Tuple[float, float, float]:
    """
    Computes filtered longitudinal jerk across variable discrete timesteps.
    Returns (max_jerk, mean_jerk, rms_jerk).
    Boundary samples k=0, 1 are strictly excluded from summations.
    """
    K = len(times)
    if K < 3:
        return 0.0, 0.0, 0.0

    # Step 1: Raw accelerations a_k = (v_k - v_{k-1}) / dt_k for k >= 1
    raw_accel: List[float] = [0.0]  # k=0 placeholder
    dt_list: List[float] = [0.0]    # k=0 placeholder
    for k in range(1, K):
        dt = times[k] - times[k - 1]
        dt = max(1e-4, dt)
        dt_list.append(dt)
        raw_accel.append((speeds[k] - speeds[k - 1]) / dt)

    # Step 2: Causal moving average filter of window M=3
    filt_accel: List[float] = [0.0] * K
    for k in range(1, K):
        window_size = min(k, filter_window)
        accel_sum = sum(raw_accel[k - m] for m in range(window_size))
        filt_accel[k] = accel_sum / window_size

    # Step 3: Variable-timestep jerk j_k for k >= 2
    jerk_values: List[float] = []
    for k in range(2, K):
        dt_denom = 0.5 * (dt_list[k] + dt_list[k - 1])
        if dt_denom < 1e-4:
            continue
        j_k = (filt_accel[k] - filt_accel[k - 1]) / dt_denom
        jerk_values.append(j_k)

    if not jerk_values:
        return 0.0, 0.0, 0.0

    abs_jerks = [abs(j) for j in jerk_values]
    max_j = float(np.max(abs_jerks))
    mean_j = float(np.mean(abs_jerks))
    rms_j = float(np.sqrt(np.mean([j * j for j in jerk_values])))

    return round(max_j, 3), round(mean_j, 3), round(rms_j, 3)


# ---------------------------------------------------------------------------
# 4. Authoritative Summary Metric Computation
# ---------------------------------------------------------------------------

def compute_frame_metrics(frames: List[Frame]) -> RunMetrics:
    """
    Authoritative computation of RunMetrics from simulation frame sequence.
    Single Source of Truth fulfilling G5, G6, and docs/METRICS.md.
    """
    if not frames:
        return RunMetrics(
            duration_s=0.0,
            completed_goal=False,
            collision_occurred=False,
            near_miss_count=0,
            min_clearance_m=0.0,
            mean_speed_m_s=0.0,
            max_jerk_m_s3=0.0,
            mean_jerk_m_s3=0.0,
            replan_count=0,
            p95_latency_ms=0.0,
            failure_tag="PLANNING",
        )

    duration_s = round(frames[-1].t, 2)
    speeds = [f.ego.v for f in frames]
    times = [f.t for f in frames]
    mean_speed = round(float(np.mean(speeds)), 3)

    # Jerk via causal filtered variable-timestep formulation
    max_jerk, mean_jerk, _ = compute_variable_timestep_jerk(times, speeds, filter_window=3)

    latencies = [f.planner_output.latency_ms for f in frames if f.planner_output.latency_ms > 0]
    p95_latency = round(float(np.percentile(latencies, 95)) if latencies else 5.0, 2)

    replan_count = sum(1 for f in frames if f.planner_output.replan_triggered)

    # Collision detection and clearance measurement across full trajectory
    collision_occurred = False
    min_clearance = float("inf")
    near_miss_count = 0
    ego_l = 4.20
    ego_w = 1.80
    road_y_bound = 4.70

    for f in frames:
        ego_x = f.ego.x
        ego_y = f.ego.y
        ego_yaw = f.ego.yaw
        ego_v = f.ego.v
        ego_vx = ego_v * math.cos(ego_yaw)
        ego_vy = ego_v * math.sin(ego_yaw)

        # 1. Ego bounding box polygon
        ego_poly = get_oriented_box_corners(ego_x, ego_y, ego_yaw, ego_l, ego_w)

        # 2. Check road boundary containment
        for cx, cy in ego_poly:
            if abs(cy) > road_y_bound:
                collision_occurred = True
                min_clearance = 0.0

            # Distance to boundaries
            dist_left = road_y_bound - cy
            dist_right = cy - (-road_y_bound)
            min_clearance = min(min_clearance, dist_left, dist_right)

        frame_near_miss = False

        # 3. Dynamic obstacles
        for ag in f.agents:
            ag_l = ag.length if ag.length and ag.length > 0 else 2.0
            ag_w = ag.width if ag.width and ag.width > 0 else 1.0
            ag_poly = get_oriented_box_corners(ag.x, ag.y, ag.yaw, ag_l, ag_w)

            # Discrete SAT Collision check
            if sat_polygons_intersect(ego_poly, ag_poly):
                collision_occurred = True
                min_clearance = 0.0
                ag_clearance = 0.0
            else:
                ag_clearance = polygon_polygon_clearance(ego_poly, ag_poly)
                min_clearance = min(min_clearance, ag_clearance)

            # Time-to-Collision (TTC)
            r_ego = math.hypot(ego_l / 2.0, ego_w / 2.0)
            r_obs = math.hypot(ag_l / 2.0, ag_w / 2.0)
            ttc = compute_2d_ttc(
                (ego_x, ego_y), (ego_vx, ego_vy),
                (ag.x, ag.y), (ag.v_x, ag.v_y),
                r_ego=r_ego, r_obs=r_obs,
            )

            # Near-miss predicate: clearance < 1.00m or TTC < 1.20s
            if not collision_occurred:
                if ag_clearance < 1.00 or (ttc is not None and ttc < 1.20):
                    frame_near_miss = True

        if frame_near_miss:
            near_miss_count += 1

    if collision_occurred:
        min_clearance = 0.0
    elif min_clearance == float("inf"):
        min_clearance = road_y_bound

    # Goal completion predicate (Section 3.1)
    last_frame = frames[-1]
    completed_goal = (
        last_frame.ego.x >= 65.0
        and abs(last_frame.ego.y) <= 4.70
        and not collision_occurred
        and duration_s <= 20.0
        and last_frame.ego.v >= 0.50
    )

    # Failure attribution taxonomy (G6)
    failure_tag = None
    if not completed_goal:
        if collision_occurred:
            has_occluded_emerge = any(
                f.planner_output.trigger_reason == "OCCLUDED_EMERGENCE" for f in frames
            )
            has_conformal_violation = any(
                f.planner_output.trigger_reason == "CONFORMAL_VIOLATION" for f in frames
            )
            if has_occluded_emerge:
                failure_tag = "PERCEPTION"
            elif has_conformal_violation:
                failure_tag = "PREDICTION"
            elif any(f.risk_field.ego_risk > 0.8 for f in frames):
                failure_tag = "RISK"
            else:
                failure_tag = "PLANNING"
        elif abs(last_frame.ego.y) > 4.70:
            failure_tag = "OFF_ROAD"
        elif duration_s >= 20.0:
            # Livelock check: low speed for last 3 seconds
            recent_speeds = [f.ego.v for f in frames[-30:]] if len(frames) >= 30 else speeds
            if max(recent_speeds) < 0.20:
                failure_tag = "LIVELOCK"
            else:
                failure_tag = "TIMEOUT"
        else:
            failure_tag = "PLANNING"

    return RunMetrics(
        duration_s=duration_s,
        completed_goal=completed_goal,
        collision_occurred=collision_occurred,
        near_miss_count=near_miss_count,
        min_clearance_m=round(min_clearance, 3),
        mean_speed_m_s=mean_speed,
        max_jerk_m_s3=max_jerk,
        mean_jerk_m_s3=mean_jerk,
        replan_count=replan_count,
        p95_latency_ms=p95_latency,
        failure_tag=failure_tag,
    )


# ---------------------------------------------------------------------------
# 5. Bootstrap Confidence Intervals
# ---------------------------------------------------------------------------

def compute_bootstrap_confidence_interval(
    data: List[float], n_bootstraps: int = 1000, alpha: float = 0.05
) -> Tuple[float, float, float]:
    """
    Computes (mean, lower_ci_95, upper_ci_95) using bootstrap resampling.
    """
    if not data:
        return 0.0, 0.0, 0.0
    arr = np.array(data)
    mean_val = float(np.mean(arr))
    n = len(arr)

    rng = np.random.default_rng(42)
    boot_indices = rng.integers(0, n, size=(n_bootstraps, n))
    boot_means = np.mean(arr[boot_indices], axis=1)

    lower_ci = float(np.percentile(boot_means, 100 * (alpha / 2.0)))
    upper_ci = float(np.percentile(boot_means, 100 * (1.0 - alpha / 2.0)))

    return round(mean_val, 4), round(lower_ci, 4), round(upper_ci, 4)
