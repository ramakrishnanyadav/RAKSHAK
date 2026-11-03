"""
Calibrated Continuous Risk Field & Dynamic Replan Trigger Evaluator.
Synthesizes collision probability, time-to-collision (TTC), vulnerability weighting,
and conformal prediction uncertainty.
"""

import math
from typing import List, Tuple, Optional, Dict
from dataclasses import dataclass
from engine.simulation.obstacles import TrafficAgent
from engine.apath_log.schema import RiskFieldSummary, AgentTrack


@dataclass
class RiskThresholds:
    low: float = 0.20
    medium: float = 0.45
    high: float = 0.70
    critical_trigger: float = 0.65
    delta_risk_trigger: float = 0.22  # Sudden change in anticipated risk
    uncertainty_mrm_limit: float = 2.8 # Epistemic limit for Minimal-Risk Manoeuvre


class CalibratedRiskField:
    r"""
    Evaluates risk $R(x, y)$ as a smooth field over the driving surface:
    $R(x, y) = \max_i \left( w_i \cdot \exp\left(-\frac{d_i^2}{2 \sigma_i^2}\right) \cdot \frac{1}{1 + \text{TTC}_i} \right)$
    """

    def __init__(self, thresholds: Optional[RiskThresholds] = None):
        self.thresholds = thresholds or RiskThresholds()

    def evaluate_point_risk(
        self,
        x: float,
        y: float,
        ego_v: float,
        agents: List[AgentTrack],
        static_obstacles: List[Tuple[float, float, float]], # (x, y, radius)
    ) -> float:
        """Computes aggregate scalar risk at coordinates (x, y). Range [0.0, 1.0]."""
        max_agent_risk = 0.0

        for ag in agents:
            dx = ag.x - x
            dy = ag.y - y
            dist = math.hypot(dx, dy)

            # Class vulnerability factor
            vuln_weights = {
                "cattle": 1.4,
                "pedestrian": 1.6,
                "two_wheeler": 1.2,
                "auto_rickshaw": 1.1,
                "truck": 1.0,
                "car": 1.0,
                "handcart": 1.3,
            }
            w_vuln = vuln_weights.get(ag.class_name, 1.0)

            # Relative speed towards point
            closing_speed = max(0.5, ego_v + math.hypot(ag.v_x, ag.v_y))
            ttc = dist / closing_speed

            # Spatial sigma scaled by vehicle velocity and agent length
            sigma = max(1.2, 0.5 * (ag.length + ag.width) + 0.15 * math.hypot(ag.v_x, ag.v_y))

            spatial_term = math.exp(-(dist ** 2) / (2.0 * (sigma ** 2)))
            temporal_term = 1.0 / (1.0 + 0.5 * max(0.0, ttc))

            agent_risk = min(1.0, w_vuln * spatial_term * temporal_term)
            if agent_risk > max_agent_risk:
                max_agent_risk = agent_risk

        # Static obstacle risk
        max_static_risk = 0.0
        for sx, sy, r in static_obstacles:
            dist = math.hypot(sx - x, sy - y)
            if dist < r:
                max_static_risk = 1.0
            else:
                max_static_risk = max(max_static_risk, math.exp(-((dist - r) ** 2) / 2.0))

        return min(1.0, max(max_agent_risk, max_static_risk * 0.8))

    def evaluate_ego_field(
        self,
        ego_x: float,
        ego_y: float,
        ego_v: float,
        agents: List[AgentTrack],
        static_obstacles: List[Tuple[float, float, float]],
    ) -> RiskFieldSummary:
        """Evaluates risk at ego position and identifies critical threat."""
        ego_risk = self.evaluate_point_risk(ego_x, ego_y, ego_v, agents, static_obstacles)

        critical_agent_id = None
        max_risk = ego_risk

        for ag in agents:
            # Check risk along forward projection
            ag_risk = self.evaluate_point_risk(
                ag.x, ag.y, ego_v, [a for a in agents if a.id == ag.id], []
            )
            dist_to_ego = math.hypot(ag.x - ego_x, ag.y - ego_y)
            if dist_to_ego < 25.0 and ag_risk > max_risk:
                max_risk = ag_risk
                critical_agent_id = ag.id

        level = "LOW"
        if ego_risk >= self.thresholds.high:
            level = "CRITICAL" if ego_risk >= self.thresholds.critical_trigger else "HIGH"
        elif ego_risk >= self.thresholds.medium:
            level = "MEDIUM"

        return RiskFieldSummary(
            max_risk=round(min(1.0, max_risk), 3),
            ego_risk=round(min(1.0, ego_risk), 3),
            critical_agent_id=critical_agent_id,
            risk_level=level,
        )

    def check_replan_trigger(
        self,
        current_risk: float,
        previous_risk: float,
        ego_path: List[Tuple[float, float]],
        agents: List[AgentTrack],
        time_since_last_replan_s: float,
        min_replan_interval_s: float = 0.20,
        max_replan_interval_s: float = 1.50,
    ) -> Tuple[bool, Optional[str]]:
        """
        Analytical risk-adaptive replanning trigger.
        Replanning fires dynamically if:
        1. Delta risk exceeds adaptive jump threshold (sudden obstacle appearance)
        2. Absolute risk enters CRITICAL tier
        3. Conformal envelope of any dynamic agent intersects future planned ego path
        4. Max replan time interval expired (watchdog timeout)
        """
        # Minimum cooldown to prevent thrashing
        if time_since_last_replan_s < min_replan_interval_s:
            return False, None

        # Watchdog timeout
        if time_since_last_replan_s >= max_replan_interval_s:
            return True, "PERIODIC"

        # Sudden jump in risk
        delta_risk = current_risk - previous_risk
        if delta_risk >= self.thresholds.delta_risk_trigger:
            return True, "RISK_THRESHOLD_EXCEEDED"

        # Critical risk violation
        if current_risk >= self.thresholds.critical_trigger:
            return True, "RISK_THRESHOLD_EXCEEDED"

        # Conformal envelope intersection check with ego trajectory
        if ego_path and len(ego_path) > 2:
            for ag in agents:
                # Check if agent or its uncertainty envelope intersects ego path within 3.0s horizon
                for pt_idx, (px, py) in enumerate(ego_path[:30]): # Full horizon
                    t_horizon = pt_idx * 0.1
                    pred_ag_x = ag.x + ag.v_x * t_horizon
                    pred_ag_y = ag.y + ag.v_y * t_horizon
                    dist = math.hypot(px - pred_ag_x, py - pred_ag_y)

                    # Lookup conformal radius
                    cone_r = 1.0
                    is_valid_calib = False
                    if ag.conformal_envelope:
                        for cp in ag.conformal_envelope:
                            if cp.t_rel >= t_horizon:
                                if getattr(cp, "coverage_guarantee_valid", True):
                                    cone_r = cp.radius_m
                                    is_valid_calib = True
                                break

                    # Only claim CONFORMAL_VIOLATION if envelope has a valid mathematical coverage guarantee
                    if is_valid_calib and dist < (1.1 + cone_r):
                        return True, "CONFORMAL_VIOLATION"

        return False, None
