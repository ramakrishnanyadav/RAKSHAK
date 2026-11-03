"""
Log Pipeline Step 5: Metrics Aggregator & Cross-Engine Parity Checker.
Aggregates summary performance metrics and audits cross-engine parity tolerances.
"""

import math
import numpy as np
from typing import Dict, Any, List, Optional, Tuple
from dataclasses import dataclass

from engine.apath_log.schema import RunLog, RunMetrics, Frame


@dataclass
class MetricParityReport:
    passed: bool
    tolerances: Dict[str, float]
    deltas: Dict[str, float]
    details: Dict[str, Any]


class MetricsAggregator:
    """
    Computes aggregated performance metrics and validates cross-engine parity tolerances.
    """

    DEFAULT_TOLERANCES = {
        "min_clearance_m": 0.35,  # 35 cm tolerance between kinematic and Simulink controllers
        "mean_speed_m_s": 0.50,   # 0.5 m/s longitudinal velocity tracking tolerance
        "max_jerk_m_s3": 1.50,    # 1.5 m/s^3 jerk transient envelope
        "p95_latency_ms": 25.0,   # Cycle latency envelope
    }

    @staticmethod
    def aggregate_from_frames(frames: List[Frame], duration_s: float, goal_reached: bool) -> RunMetrics:
        """
        Recalculates RunMetrics from frame time-series.
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
                failure_tag="NONE",
            )

        speeds = [f.ego.v for f in frames]
        jerks = [abs(f.ego.jerk) for f in frames]
        latencies = [f.planner_output.latency_ms for f in frames]

        # Clearance and collisions
        min_clear = 99.0
        near_misses = 0
        collision = False

        for f in frames:
            for ag in f.agents:
                dx = f.ego.x - ag.x
                dy = f.ego.y - ag.y
                dist = math.hypot(dx, dy)
                if dist < min_clear:
                    min_clear = dist
                if dist < 2.0:
                    near_misses += 1
                if dist < 1.0:
                    collision = True

        replan_count = sum(1 for f in frames if f.planner_output.replan_triggered)

        return RunMetrics(
            duration_s=round(duration_s, 2),
            completed_goal=goal_reached,
            collision_occurred=collision,
            near_miss_count=near_misses,
            min_clearance_m=round(min_clear, 3),
            mean_speed_m_s=round(float(np.mean(speeds)), 3),
            max_jerk_m_s3=round(float(np.max(jerks)), 3),
            mean_jerk_m_s3=round(float(np.mean(jerks)), 3),
            replan_count=replan_count,
            p95_latency_ms=round(float(np.percentile(latencies, 95)), 2),
            failure_tag="NONE" if not collision else "PLANNING",
        )

    def check_parity(
        self,
        log_python: RunLog,
        log_matlab: RunLog,
        custom_tolerances: Optional[Dict[str, float]] = None,
    ) -> MetricParityReport:
        """
        Validates whether Python and MATLAB runs for identical scenario + seed
        agree on qualitative outcomes and stay within documented numerical tolerances.
        """
        tols = {**self.DEFAULT_TOLERANCES, **(custom_tolerances or {})}

        mp = log_python.metrics
        mm = log_matlab.metrics

        # Qualitative requirements: must match exactly
        goal_match = (mp.completed_goal == mm.completed_goal)
        collision_match = (mp.collision_occurred == mm.collision_occurred)

        # Numerical differences
        delta_clearance = abs(mp.min_clearance_m - mm.min_clearance_m)
        delta_speed = abs(mp.mean_speed_m_s - mm.mean_speed_m_s)
        delta_jerk = abs(mp.max_jerk_m_s3 - mm.max_jerk_m_s3)

        passed = bool(
            goal_match
            and collision_match
            and delta_clearance <= tols["min_clearance_m"]
            and delta_speed <= tols["mean_speed_m_s"]
            and delta_jerk <= tols["max_jerk_m_s3"]
        )

        deltas = {
            "min_clearance_m": round(delta_clearance, 3),
            "mean_speed_m_s": round(delta_speed, 3),
            "max_jerk_m_s3": round(delta_jerk, 3),
        }

        details = {
            "goal_match": goal_match,
            "collision_match": collision_match,
            "python_metrics": mp.model_dump(),
            "matlab_metrics": mm.model_dump(),
        }

        return MetricParityReport(
            passed=passed,
            tolerances=tols,
            deltas=deltas,
            details=details,
        )
