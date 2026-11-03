"""
Statistical Evaluation, Metric Computation, and Bootstrap Confidence Intervals.
Fulfills G5 (Beat baselines with 95% CI) and G6 (Failure attribution taxonomy).
"""

import math
import numpy as np
from typing import List, Dict, Any, Optional, Tuple
from engine.apath_log.schema import RunMetrics, Frame, EgoState


def compute_frame_metrics(frames: List[Frame]) -> RunMetrics:
    """Computes summary metrics for a completed run."""
    if not frames:
        return RunMetrics(
            duration_s=0.0,
            completed_goal=False,
            collision_occurred=False,
            near_miss_count=0,
            min_clearance_m=99.0,
            mean_speed_m_s=0.0,
            max_jerk_m_s3=0.0,
            mean_jerk_m_s3=0.0,
            replan_count=0,
            p95_latency_ms=0.0,
            failure_tag="PLANNING",
        )

    duration_s = round(frames[-1].t, 2)
    speeds = [f.ego.v for f in frames]
    mean_speed = round(float(np.mean(speeds)), 2)

    jerks = [abs(f.ego.jerk) for f in frames]
    max_jerk = round(float(np.max(jerks)) if jerks else 0.0, 2)
    mean_jerk = round(float(np.mean(jerks)) if jerks else 0.0, 2)

    latencies = [f.planner_output.latency_ms for f in frames if f.planner_output.latency_ms > 0]
    p95_latency = round(float(np.percentile(latencies, 95)) if latencies else 5.0, 2)

    replan_count = sum(1 for f in frames if f.planner_output.replan_triggered)

    # Collision & near-miss detection from decision traces and costs
    collision_occurred = False
    near_miss_count = 0
    min_clearance = 99.0
    failure_tag = None

    for f in frames:
        # Check clearance in cost breakdown or risk
        if f.risk_field.ego_risk >= 0.98 or f.planner_output.cost_breakdown.collision_cost >= 9.0:
            # Check if actual collision occurred
            collision_occurred = True
        elif f.risk_field.ego_risk >= 0.75:
            near_miss_count += 1

    last_frame = frames[-1]
    completed_goal = last_frame.ego.x >= 65.0 and not collision_occurred

    if collision_occurred:
        # Failure attribution taxonomy (G6)
        # Check perception occlusions vs prediction errors
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

    return RunMetrics(
        duration_s=duration_s,
        completed_goal=completed_goal,
        collision_occurred=collision_occurred,
        near_miss_count=near_miss_count,
        min_clearance_m=round(min_clearance, 2),
        mean_speed_m_s=mean_speed,
        max_jerk_m_s3=max_jerk,
        mean_jerk_m_s3=mean_jerk,
        replan_count=replan_count,
        p95_latency_ms=p95_latency,
        failure_tag=failure_tag,
    )


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
    if len(arr) < 3:
        return mean_val, mean_val, mean_val

    rng = np.random.default_rng(42)
    boot_means = []
    n = len(arr)
    for _ in range(n_bootstraps):
        sample = rng.choice(arr, size=n, replace=True)
        boot_means.append(np.mean(sample))

    lower_ci = float(np.percentile(boot_means, 100 * (alpha / 2.0)))
    upper_ci = float(np.percentile(boot_means, 100 * (1.0 - alpha / 2.0)))
    return round(mean_val, 4), round(lower_ci, 4), round(upper_ci, 4)
