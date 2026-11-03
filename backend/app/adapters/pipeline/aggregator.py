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
        Recalculates RunMetrics from frame time-series using the authoritative
        single source of truth in engine.metrics.
        """
        from engine.metrics import compute_frame_metrics
        return compute_frame_metrics(frames)

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
